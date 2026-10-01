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

const Wads = () => {
  setTitle('wads');
  const { gstate, dispatch } = useContext(StoreContext);
  const [poActive, setPoActive] = useState(false);
  const [sort, setSort] = useState('new');
  const [dragging, setDragging] = useState(false);
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

  const onSortList = ({ value }) => setSort(value);

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
      if (res.ids.length) {
        play('soundModSelect');
        toast(
          'ok',
          t('common:success'),
          t('wads:toastDrop', { count: res.ids.length })
        );
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
