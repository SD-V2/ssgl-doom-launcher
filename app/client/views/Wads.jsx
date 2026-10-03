import { remote } from 'electron';
import { AnimatePresence } from 'framer-motion';
import React, { useContext, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useDebounce } from 'use-debounce';

import {
  Box,
  ConflictsModal,
  DuplicatesModal,
  ErrorItem,
  Flex,
  ModBox,
  ModFilter,
  ModItem,
  ModStats,
  PackageAreaNew,
  PlayIcon,
  PlayOverlay
} from '../components';
import { StoreContext } from '../state';
import { setTitle, sortList, useIpc, useToast, useTranslation } from '../utils';
import { useSound } from '../utils';
import { trackFirstSeen } from '../utils/firstSeen';
import { modsInFolder, sortByFolder } from '../utils/groupByFolder';
import AnimatedView from './AnimatedView';

const FAV_KEY = 'ssgl.favorites';
const MOD_MIME = 'application/x-ssgl-mod';

const NotesStyle = styled.div`
  margin-bottom: 10px;
  padding: 6px 10px;
  font-size: 14px;
  white-space: pre-wrap;
  color: #ddd;
  background: ${({ theme }) => theme.color.backdrop};
  border-left: 3px solid ${({ theme }) => theme.color.active};
  border-radius: ${({ theme }) => theme.border.radius};

  b {
    display: block;
    font-weight: normal;
    font-size: 12px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.meta};
  }
`;

const ToolbarStyle = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
  font-size: 14px;
  user-select: none;

  a {
    cursor: pointer;
    margin-left: 16px;
    color: ${({ theme }) => theme.color.active};
  }

  a:hover {
    text-decoration: underline;
  }
`;

const loadFavorites = () => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY)) || [];
  } catch (e) {
    return [];
  }
};

const FOLDERS_KEY = 'ssgl.openFolders';
const SORT_KEY = 'ssgl.sort';

const loadOpenFolders = () => {
  try {
    return JSON.parse(localStorage.getItem(FOLDERS_KEY)) || [];
  } catch (e) {
    return [];
  }
};

const loadSort = () => {
  try {
    // only the folder view is remembered, the other sorts start fresh
    return localStorage.getItem(SORT_KEY) === 'folder' ? 'folder' : 'new';
  } catch (e) {
    return 'new';
  }
};

const Wads = () => {
  setTitle('wads');
  const { gstate, dispatch } = useContext(StoreContext);
  const [poActive, setPoActive] = useState(false);
  const [sort, setSort] = useState(loadSort);
  const [openFolders, setOpenFolders] = useState(loadOpenFolders);
  const [dragging, setDragging] = useState(false);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [removeHover, setRemoveHover] = useState(false);
  const [dupesOpen, setDupesOpen] = useState(false);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [orderBackup, setOrderBackup] = useState(null);
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [conflicts, setConflicts] = useState({ loading: false, result: null, error: null, count: 0 });
  const [ipc, loading] = useIpc();
  const { t } = useTranslation(['common', 'wads']);
  const [toast] = useToast();
  const [play] = useSound();
  const [rawFilter, setFilter] = useState('');
  const [filter] = useDebounce(rawFilter, 200);
  const favSet = useMemo(() => new Set(favorites), [favorites]);
  // mods SSGL saw for the first time within the last week
  const recentIds = useMemo(() => trackFirstSeen(gstate.mods), [gstate.mods]);

  const onSelect = id => () => {
    play('soundModSelect');
    dispatch({ type: 'mod/select', id });
  };

  const onCircle = path => () => remote.shell.showItemInFolder(path);

  const onSort = (index, direction) => () =>
    dispatch({ type: 'mod/move', direction, index });

  // re-scan the WAD directory, the current load order stays as it is
  const refreshMods = async () => {
    const data = await ipc('main/init');
    dispatch({ type: 'mods/refresh', data });
    return data;
  };

  const onRefresh = async () => {
    await refreshMods();
    toast('ok', t('common:success'), t('wads:toastIndex'));
  };

  const onFavorite = id => () => {
    const next =
      favorites.indexOf(id) > -1
        ? favorites.filter(f => f !== id)
        : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch (e) {}
  };

  const onShowMod = path => () => remote.shell.showItemInFolder(path);

  // look inside the mods of the load order for files that more than one mod has
  const checkConflicts = async (ids = gstate.package.selected) => {
    const byId = new Map(gstate.mods.map(m => [m.id, m]));
    const items = ids
      .map(id => byId.get(id))
      .filter(Boolean)
      .map(m => ({ id: m.id, name: m.name, path: m.path }));

    setConflictsOpen(true);
    setConflicts({ loading: true, result: null, error: null, count: items.length });
    try {
      const result = await ipc('mods/conflicts', { items });
      setConflicts({ loading: false, result, error: null, count: items.length });
    } catch (err) {
      setConflicts({ loading: false, result: null, error: String(err), count: items.length });
    }
  };

  const onConflictSwap = (a, b) => {
    const order = [...gstate.package.selected];
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia < 0 || ib < 0) return;
    order[ia] = b;
    order[ib] = a;
    dispatch({ type: 'mods/setOrder', ids: order });
    checkConflicts(order);
  };

  const onConflictRemove = id => {
    dispatch({ type: 'mods/remove', ids: [id] });
    checkConflicts(gstate.package.selected.filter(i => i !== id));
  };

  // arrange the load order by folder (1_xx first); can be undone right after
  const onSortByFolder = () => {
    const before = gstate.package.selected;
    const sorted = sortByFolder(before, gstate.mods);
    setOrderBackup({ before, sorted });
    dispatch({ type: 'mods/setOrder', ids: sorted });
    play('soundModSelect');
    toast('ok', t('common:success'), t('wads:toastSorted'));
  };

  const onUndoSort = () => {
    dispatch({ type: 'mods/setOrder', ids: orderBackup.before });
    setOrderBackup(null);
    play('soundModSelect');
  };

  // undo is offered only while the order is still the one the sort produced
  const canUndoSort =
    orderBackup !== null &&
    orderBackup.sorted.join('|') === gstate.package.selected.join('|');

  // move a mod file to the Recycle Bin (after asking)
  const onDeleteMod = (path, name, id = null) => async () => {
    const res = await remote.dialog.showMessageBox({
      type: 'warning',
      buttons: [t('wads:deleteYes'), t('wads:deleteNo')],
      defaultId: 1,
      cancelId: 1,
      message: t('wads:confirmDelete', { name }),
      detail: path
    });
    if (res.response !== 0) return;

    if (!remote.shell.moveItemToTrash(path)) {
      toast('danger', t('common:error'), t('wads:toastDeleteFailed', { name }));
      return;
    }

    toast('ok', t('common:success'), t('wads:toastDeleted', { name }));
    try {
      const data = await refreshMods();
      // gone completely? then it leaves the load order too
      if (id && !data.mods.some(m => m.id === id)) {
        dispatch({ type: 'mods/remove', ids: [id] });
      }
    } catch (e) {}
  };

  // "+" / "-" on a folder row: whole folder into / out of the load order
  const onAddFolder = key => {
    const ids = modsInFolder(show, key).map(m => m.id);
    const fresh = ids.filter(id => gstate.package.selected.indexOf(id) < 0);
    if (!fresh.length) return;
    dispatch({ type: 'mods/drop', mods: [], ids });
    play('soundModSelect');
    toast('ok', t('common:success'), t('wads:toastDrop', { count: fresh.length }));
  };

  const onRemoveFolder = key => {
    const ids = modsInFolder(show, key).map(m => m.id);
    dispatch({ type: 'mods/remove', ids });
    play('soundModSelect');
  };

  const onSortList = ({ value }) => {
    setSort(value);
    try {
      localStorage.setItem(SORT_KEY, value);
    } catch (e) {}
  };

  const saveOpenFolders = list => {
    setOpenFolders(list);
    try {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(list));
    } catch (e) {}
  };

  const onToggleFolder = folder =>
    saveOpenFolders(
      openFolders.indexOf(folder) > -1
        ? openFolders.filter(f => f !== folder)
        : [...openFolders, folder]
    );

  const onFilterInput = (e, { value }) => {
    if (sort === 'tag') {
      setSort('asc');
    }
    setFilter(value);
  };
  const onTag = tag => () => {
    if (tag === '##BACK##') {
      setFilter('');
    } else {
      setSort('tag');
      setFilter(tag);
    }
  };

  const onClear = () => setFilter('');

  // Drag items of the load order up and down to reorder them
  const itemDragProps = index => ({
    draggable: true,
    onDragStart: e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      // defer so the drag image is taken before the item is dimmed
      setTimeout(() => setDragFrom(index), 0);
    },
    onDragOver: e => {
      if (dragFrom === null && !isModDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = dragFrom === null ? 'copy' : 'move';
      if (dragOver !== index) setDragOver(index);
    },
    onDrop: e => {
      // a mod dragged in from the mod list: lands in front of this item
      if (dragFrom === null && isModDrag(e)) {
        e.preventDefault();
        e.stopPropagation();
        dispatch({
          type: 'mod/insert',
          id: e.dataTransfer.getData(MOD_MIME),
          index
        });
        play('soundModSelect');
        setDragOver(null);
        setDragging(false);
        return;
      }
      if (dragFrom === null) return;
      e.preventDefault();
      if (dragFrom !== index) {
        dispatch({ type: 'mod/reorder', from: dragFrom, to: index });
        play('soundModSelect');
      }
      setDragFrom(null);
      setDragOver(null);
    },
    onDragEnd: () => {
      setDragFrom(null);
      setDragOver(null);
    }
  });

  const itemDragState = index => {
    if (dragFrom === null) return dragging && dragOver === index ? 'above' : null;
    if (index === dragFrom) return 'dragging';
    if (index === dragOver) return dragFrom < index ? 'below' : 'above';
    return null;
  };

  const hasFiles = e =>
    Array.from(e.dataTransfer.types || []).indexOf('Files') > -1;

  const isModDrag = e =>
    Array.from(e.dataTransfer.types || []).indexOf(MOD_MIME) > -1;

  const onDragOver = e => {
    if (!hasFiles(e) && !isModDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  };

  const onDragLeave = e => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragging(false);
      setDragOver(null);
    }
  };

  // Drop mod files from the file manager (or a mod from the list) into the load order
  const onDrop = async e => {
    if (isModDrag(e)) {
      e.preventDefault();
      setDragging(false);
      setDragOver(null);
      dispatch({
        type: 'mod/insert',
        id: e.dataTransfer.getData(MOD_MIME),
        index: null
      });
      play('soundModSelect');
      return;
    }
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragging(false);

    const paths = Array.from(e.dataTransfer.files)
      .map(f => f.path)
      .filter(Boolean);
    if (!paths.length) return;

    try {
      const res = await ipc('mods/add', {
        paths,
        known: gstate.mods.map(m => m.id)
      });
      dispatch({ type: 'mods/drop', mods: res.mods, ids: res.ids });
      const added = res.ids.filter(
        (id, i, all) =>
          all.indexOf(id) === i && gstate.package.selected.indexOf(id) < 0
      ).length;
      if (added) {
        play('soundModSelect');
        toast('ok', t('common:success'), t('wads:toastDrop', { count: added }));
      }
      if (res.skipped.length) {
        toast(
          'danger',
          t('common:error'),
          t('wads:toastDropSkipped', { names: res.skipped.join(', ') })
        );
      }
    } catch (err) {
      toast('danger', t('common:error'), String(err));
    }
  };

  const onListDragOver = e => {
    if (dragFrom === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setRemoveHover(true);
  };

  const onListDragLeave = e => {
    if (!e.currentTarget.contains(e.relatedTarget)) setRemoveHover(false);
  };

  const onListDrop = e => {
    if (dragFrom === null) return;
    e.preventDefault();
    setRemoveHover(false);
    const id = gstate.package.selected[dragFrom];
    setDragFrom(null);
    setDragOver(null);
    if (id) {
      dispatch({ type: 'mods/remove', ids: [id] });
      play('soundModSelect');
    }
  };

  const openDrawer = () => {
    setPoActive(true);
    play('soundDrawer');
  };

  const show = useMemo(() => {
    // always work on a copy, sortList sorts in place
    let base = [...gstate.mods];
    if (sort === 'starred') base = base.filter(m => favSet.has(m.id));
    if (sort === 'recent') base = base.filter(m => recentIds.has(m.id));

    const sorted = sortList(
      base,
      sort === 'fav' || sort === 'recent'
        ? 'new'
        : sort === 'starred'
        ? 'asc'
        : sort,
      filter,
      (i, fuzz) =>
        fuzz(
          filter.toLowerCase(),
          `${i.tags.join(' ')} ${i.name.toLowerCase()}`
        )
    );

    return sort === 'fav'
      ? [
          ...sorted.filter(m => favSet.has(m.id)),
          ...sorted.filter(m => !favSet.has(m.id))
        ]
      : sorted;
  }, [gstate.mods, sort, filter, favSet, recentIds]);

  const totalBytes = useMemo(
    () => gstate.mods.reduce((n, m) => n + (m.bytes || 0), 0),
    [gstate.mods]
  );

  return (
    <AnimatedView>
      <Flex.Grid>
        <Flex.Col
          onDragOver={onListDragOver}
          onDragLeave={onListDragLeave}
          onDrop={onListDrop}
          style={
            removeHover
              ? { outline: '2px dashed #f55945', outlineOffset: '-2px' }
              : undefined
          }
        >
          <ModBox
            data={show}
            onClick={onSelect}
            onTag={onTag}
            grouped={sort === 'folder'}
            openFolders={openFolders}
            forceOpen={filter.trim() !== ''}
            onToggleFolder={onToggleFolder}
            onSetFolders={saveOpenFolders}
            onAddFolder={onAddFolder}
            onRemoveFolder={onRemoveFolder}
            favorites={favSet}
            onFavorite={onFavorite}
            onShow={onShowMod}
            onDelete={item => onDeleteMod(item.path, item.name, item.id)}
            compact={!!gstate.settings.compactList}
            recentIds={recentIds}
            footer={
              <ModStats
                count={gstate.mods.length}
                bytes={totalBytes}
                groups={gstate.duplicates.length + gstate.versions.length}
                onOpen={() => setDupesOpen(true)}
              />
            }
            fixed={
              <ModFilter
                filterValue={rawFilter}
                onInput={onFilterInput}
                onClear={onClear}
                onRefresh={onRefresh}
                refreshLoad={loading}
                onSort={onSortList}
                sortValue={sort}
                size={show.length}
              />
            }
          ></ModBox>
        </Flex.Col>
        <Flex.Col
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          style={
            dragging
              ? { outline: '2px dashed #a4d31f', outlineOffset: '-2px' }
              : undefined
          }
        >
          <Box fixed={<PackageAreaNew />}>
            {gstate.package.notes ? (
              <NotesStyle>
                <b>{t('wads:notesTitle')}</b>
                {gstate.package.notes}
              </NotesStyle>
            ) : null}
            {gstate.package.selected.length > 1 || canUndoSort ? (
              <ToolbarStyle>
                {canUndoSort ? (
                  <a onClick={onUndoSort}>{t('wads:undoSort')}</a>
                ) : null}
                <a onClick={() => checkConflicts()}>{t('wads:checkConflicts')}</a>
                <a onClick={onSortByFolder}>{t('wads:sortByFolder')}</a>
              </ToolbarStyle>
            ) : null}
            <ul>
              <AnimatePresence>
                {gstate.package.selected.length &&
                  gstate.package.selected.map((id, itemindex) => {
                    const item = gstate.mods.find(i => i.id === id);
                    return item ? (
                      <ModItem
                        key={`selected_${item.id}`}
                        item={item}
                        onSelect={onSelect(item.id)}
                        onUp={onSort(itemindex, 'up')}
                        onCircle={onCircle(item.path)}
                        onDown={onSort(itemindex, 'down')}
                        onTag={onTag}
                        dragProps={itemDragProps(itemindex)}
                        dragState={itemDragState(itemindex)}
                        selected
                      />
                    ) : (
                      <ErrorItem
                        key={`NOTFOUND_ERROR${id}`}
                        id={id}
                        onSelect={onSelect(id)}
                      />
                    );
                  })}
              </AnimatePresence>
            </ul>
          </Box>
        </Flex.Col>
      </Flex.Grid>
      <ConflictsModal
        active={conflictsOpen}
        onClose={() => setConflictsOpen(false)}
        loading={conflicts.loading}
        error={conflicts.error}
        result={conflicts.result}
        count={conflicts.count}
        onSwap={onConflictSwap}
        onRemove={onConflictRemove}
      />
      <DuplicatesModal
        active={dupesOpen}
        onClose={() => setDupesOpen(false)}
        duplicates={gstate.duplicates}
        versions={gstate.versions}
        modpath={gstate.settings.modpath}
        onShow={onShowMod}
        onDelete={(path, name) => onDeleteMod(path, name)}
      />
      <PlayIcon active={true} onClick={openDrawer} />
      <PlayOverlay active={poActive} setActive={setPoActive} />
    </AnimatedView>
  );
};

export default Wads;
