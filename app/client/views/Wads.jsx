import { remote } from 'electron';
import { AnimatePresence } from 'framer-motion';
import React, { useContext, useState } from 'react';
import { useDebounce } from 'use-debounce';

import {
  Box,
  ErrorItem,
  Flex,
  ModBox,
  ModFilter,
  ModItem,
  PackageAreaNew,
  PlayIcon,
  PlayOverlay
} from '../components';
import { StoreContext } from '../state';
import { setTitle, sortList, useIpc, useToast, useTranslation } from '../utils';
import { useSound } from '../utils';
import AnimatedView from './AnimatedView';

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
  const [ipc, loading] = useIpc();
  const { t } = useTranslation(['common', 'wads']);
  const [toast] = useToast();
  const [play] = useSound();
  const [rawFilter, setFilter] = useState('');
  const [filter] = useDebounce(rawFilter, 200);

  const onSelect = id => () => {
    play('soundModSelect');
    dispatch({ type: 'mod/select', id });
  };

  const onCircle = path => () => remote.shell.showItemInFolder(path);

  const onSort = (index, direction) => () =>
    dispatch({ type: 'mod/move', direction, index });

  const onRefresh = async () => {
    const data = await ipc('main/init');
    dispatch({ type: 'main/init', data: data });
    toast('ok', t('common:success'), t('wads:toastIndex'));
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
      if (dragFrom === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOver !== index) setDragOver(index);
    },
    onDrop: e => {
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
    if (dragFrom === null) return null;
    if (index === dragFrom) return 'dragging';
    if (index === dragOver) return dragFrom < index ? 'below' : 'above';
    return null;
  };

  const hasFiles = e =>
    Array.from(e.dataTransfer.types || []).indexOf('Files') > -1;

  const onDragOver = e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  };

  const onDragLeave = e => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  };

  // Drop mod files from the file manager into the package / load order
  const onDrop = async e => {
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

  const openDrawer = () => {
    setPoActive(true);
    play('soundDrawer');
  };

  let show = sortList(gstate.mods, sort, filter, (i, fuzz) =>
    fuzz(filter.toLowerCase(), `${i.tags.join(' ')} ${i.name.toLowerCase()}`)
  );

  return (
    <AnimatedView>
      <Flex.Grid>
        <Flex.Col>
          <ModBox
            data={show}
            onClick={onSelect}
            onTag={onTag}
            grouped={sort === 'folder'}
            openFolders={openFolders}
            forceOpen={filter.trim() !== ''}
            onToggleFolder={onToggleFolder}
            onSetFolders={saveOpenFolders}
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
      <PlayIcon active={true} onClick={openDrawer} />
      <PlayOverlay active={poActive} setActive={setPoActive} />
    </AnimatedView>
  );
};

export default Wads;
