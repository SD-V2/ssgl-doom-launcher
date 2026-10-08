import { remote } from 'electron';
import { AnimatePresence } from 'framer-motion';
import byteSize from 'byte-size';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import path from 'path';
import styled from 'styled-components';
import { useDebounce } from 'use-debounce';

import {
  Box,
  BrokenFilesModal,
  ConflictsModal,
  DiskUsageModal,
  DuplicatesModal,
  ErrorItem,
  FixPackagesModal,
  FolderNameModal,
  Flex,
  ModBox,
  ModFilter,
  ModItem,
  ModStats,
  PackageAreaNew,
  SectionFrame,
  SectionsEditor,
  TabSwitch,
  TwinsModal,
  PlayIcon,
  PlayOverlay
} from '../components';
import { StoreContext } from '../state';
import { setTitle, sortList, useIpc, useToast, useTranslation } from '../utils';
import { explainError, useSound } from '../utils';
import { trackFirstSeen } from '../utils/firstSeen';
import { useDialog } from '../components/Dialog';
import { findFixes } from '../utils/fixes';
import {
  groupFixed,
  isSectionSorted,
  normalizeOrder,
  resolveSection,
  sectionName,
  sectionNote,
  sectionNumbers,
  sectionOrder
} from '../utils/sections';
import { findTwins, twinKey } from '../utils/twins';
import { modsInFolder, sortByFolder } from '../utils/groupByFolder';
import AnimatedView from './AnimatedView';

const FAV_KEY = 'ssgl.favorites';
const IGNORED_KEY = 'ssgl.ignoredConflicts';
const DEFAULT_IMPORT = 'Added via Explorer';

// "1_BP\\new/" -> "1_BP/new"
const normalizeKey = value =>
  String(value || '')
    .split(/[\\/]+/)
    .filter(part => part.trim() !== '')
    .join('/');

// folder keys below a renamed folder follow it
const renameKey = (key, oldKey, newKey) =>
  key === oldKey
    ? newKey
    : key.indexOf(`${oldKey}/`) === 0
    ? newKey + key.slice(oldKey.length)
    : key;

const loadIgnored = () => {
  try {
    return JSON.parse(localStorage.getItem(IGNORED_KEY)) || [];
  } catch (e) {
    return [];
  }
};
const MOD_MIME = 'application/x-ssgl-mod';

const NotesStyle = styled.div`
  margin-bottom: 10px;
  padding: 6px 10px;
  font-size: 14px;
  white-space: pre-wrap;
  color: #ddd;
  background: ${({ theme }) => theme.color.backdrop};
  border-inline-start: 3px solid ${({ theme }) => theme.color.active};
  border-radius: ${({ theme }) => theme.border.radius};

  b {
    display: block;
    font-weight: normal;
    font-size: 12px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.meta};
  }
`;

const SummaryStyle = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  margin-bottom: 8px;
  font-size: 14px;
  user-select: none;
  color: ${({ theme }) => theme.color.meta};

  b {
    font-weight: normal;
    color: #fff;
  }

  a {
    cursor: pointer;
    margin-inline-start: 14px;
  }

  a.warn {
    color: #f5b945;
  }

  a.bad {
    color: #f55945;
  }

  a:hover {
    text-decoration: underline;
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
    margin-inline-start: 16px;
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

const FOLDER_MIME = 'application/x-ssgl-folder';
const SECTION_KEY = 'ssgl.section';



const loadSection = () => {
  try {
    return localStorage.getItem(SECTION_KEY) === 'maps' ? 'maps' : 'mods';
  } catch (e) {
    return 'mods';
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
  const [wanted, setWanted] = useState(loadSection);
  const view = gstate.sectionMode ? 'sections' : 'list';
  const [sectionOver, setSectionOver] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');
  const rules = gstate.sectionRules;
  const [openFolders, setOpenFolders] = useState(loadOpenFolders);
  const [dragging, setDragging] = useState(false);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [removeHover, setRemoveHover] = useState(false);
  const [dupesOpen, setDupesOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState(null);
  const [ignored, setIgnored] = useState(loadIgnored);
  const [twinsOpen, setTwinsOpen] = useState(false);
  const [live, setLive] = useState(null);
  const liveTicket = useRef(0);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [orderBackup, setOrderBackup] = useState(null);
  const [healthOpen, setHealthOpen] = useState(false);
  const [health, setHealth] = useState({ loading: false, result: null, error: null });
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [conflicts, setConflicts] = useState({ loading: false, result: null, error: null, count: 0 });
  const [ipc, loading] = useIpc();
  // a second connection for checks that run quietly in the background
  const [bgIpc] = useIpc();
  const dialog = useDialog();
  const { t } = useTranslation(['common', 'wads']);
  const [toast] = useToast();
  const [play] = useSound();
  const [rawFilter, setFilter] = useState('');
  const [filter] = useDebounce(rawFilter, 200);
  const favSet = useMemo(() => new Set(favorites), [favorites]);
  // mods SSGL saw for the first time within the last week
  const recentIds = useMemo(() => trackFirstSeen(gstate.mods), [gstate.mods]);
  // mods that packages use but that were updated / replaced in the mod list
  const fixes = useMemo(
    () =>
      gstate.mods.length ? findFixes(gstate.packages, gstate.mods) : [],
    [gstate.packages, gstate.mods]
  );
  const fixable = fixes.filter(f => f.candidate);
  const importFolder = normalizeKey(gstate.settings.importFolder) || DEFAULT_IMPORT;

  // ---- maps are kept apart from the mods (own directory, own list) ----
  const hasMaps = String(gstate.settings.mappath || '').trim() !== '';
  const section = hasMaps && wanted === 'maps' ? 'maps' : 'mods';
  const rootPath = section === 'maps' ? gstate.settings.mappath : gstate.settings.modpath;
  const sectionMods = useMemo(
    () => gstate.mods.filter(m => !!m.isMap === (section === 'maps')),
    [gstate.mods, section]
  );
  const counts = useMemo(
    () => ({
      maps: gstate.mods.filter(m => m.isMap).length,
      mods: gstate.mods.filter(m => !m.isMap).length
    }),
    [gstate.mods]
  );
  const onSection = value => {
    setWanted(value);
    try {
      localStorage.setItem(SECTION_KEY, value);
    } catch (e) {}
  };

  // ---- the load order at a glance ----
  const selectedMods = useMemo(() => {
    const byId = new Map(gstate.mods.map(m => [m.id, m]));
    return gstate.package.selected.map(id => byId.get(id)).filter(Boolean);
  }, [gstate.mods, gstate.package.selected]);

  const selectedKey = gstate.package.selected.join('|');

  // the same load order, grouped for the "sections" view
  // the order of the sections (yours) and their numbers (they follow the place)
  const order = useMemo(() => sectionOrder(gstate.sectionRules), [gstate.sectionRules]);
  const numbers = useMemo(() => sectionNumbers(order), [order]);
  const defaultOrder = useMemo(() => normalizeOrder([]), []);
  const orderChanged = order.join() !== defaultOrder.join();

  const fixedGroups = useMemo(
    () => groupFixed(gstate.package.selected, gstate.mods, gstate.sectionRules),
    [gstate.package.selected, gstate.mods, gstate.sectionRules]
  );

  // LIST <-> SECTIONS. Sections arrange the load order, so you are asked first
  // when that would change it.
  const onView = async value => {
    if (value === view) return;
    if (
      value === 'sections' &&
      gstate.package.selected.length > 1 &&
      !isSectionSorted(gstate.package.selected, gstate.mods, gstate.sectionRules)
    ) {
      const sure = await dialog.confirm({
        title: t('wads:sectionsAskTitle'),
        message: t('wads:sectionsAskMessage'),
        detail: t('wads:sectionsAskDetail'),
        confirmText: t('wads:sectionsAskConfirm'),
        cancelText: t('common:cancel')
      });
      if (!sure) return;
    }
    dispatch({ type: 'sections/mode', on: value === 'sections' });
  };

  // conflicts are looked for quietly whenever the load order changes
  useEffect(() => {
    if (selectedMods.length < 2) {
      liveTicket.current += 1;
      setLive(null);
      return undefined;
    }
    const items = selectedMods.map(m => ({ id: m.id, name: m.name, path: m.path }));
    const ticket = liveTicket.current + 1;
    liveTicket.current = ticket;

    const timer = setTimeout(async () => {
      try {
        const result = await bgIpc('mods/conflicts', { items });
        if (ticket === liveTicket.current) setLive(result);
      } catch (e) {
        if (ticket === liveTicket.current) setLive(null);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [selectedKey, gstate.mods]);

  // how many conflicts each mod of the load order is part of (ignored ones not counted)
  const conflictInfo = useMemo(() => {
    const counts = new Map();
    let pairs = 0;
    if (live) {
      live.conflicts.forEach(c => {
        if (ignored.indexOf([c.a, c.b].sort().join('|')) > -1) return;
        pairs += 1;
        counts.set(c.a, (counts.get(c.a) || 0) + 1);
        counts.set(c.b, (counts.get(c.b) || 0) + 1);
      });
    }
    return { counts, pairs };
  }, [live, ignored]);

  // the same mod twice (two versions of it) in the load order
  const twinGroups = useMemo(
    () => findTwins(selectedMods).filter(g => ignored.indexOf(twinKey(g)) < 0),
    [selectedMods, ignored]
  );
  const twinIds = useMemo(
    () => new Set(twinGroups.reduce((all, g) => all.concat(g.mods.map(m => m.id)), [])),
    [twinGroups]
  );
  const loadBytes = selectedMods.reduce((n, m) => n + (m.bytes || 0), 0);
  const missingCount = gstate.package.selected.length - selectedMods.length;

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

  const onShowMod = file => () => remote.shell.showItemInFolder(file);

  // ---- update mods inside packages ----
  const applyFixes = async items => {
    const replacements = items.map(f => ({
      from: f.id,
      to: f.candidate.mod.id,
      name: f.candidate.mod.name,
      kind: f.candidate.mod.kind
    }));
    try {
      const res = await ipc('packages/replaceMods', { replacements });
      dispatch({ type: 'packages/set', packages: res.packages });
      dispatch({ type: 'mods/replaceIds', replacements });
      toast(
        'ok',
        t('common:success'),
        t('wads:toastFixed', { count: replacements.length })
      );
    } catch (err) {
      toast('danger', t('common:error'), explainError(err, t));
    }
  };

  // ---- folders ----
  const saveSettingsPatch = async patch => {
    const data = await ipc('settings/save', { ...gstate.settings, ...patch });
    dispatch({ type: 'settings/save', data });
  };

  const setImportFolder = async key => {
    try {
      await saveSettingsPatch({ importFolder: key });
      toast('ok', t('common:success'), t('wads:toastNewModsHere', { folder: key }));
    } catch (err) {
      toast('danger', t('common:error'), explainError(err, t));
    }
  };

  const submitFolderDialog = async name => {
    const dlg = folderDialog;
    try {
      if (dlg.mode === 'create') {
        const res = await ipc('folders/create', {
          parent: dlg.key,
          name,
          root: section
        });
        // show the new folder: open it and the one it is in
        const open = [...openFolders];
        [dlg.key, res.key].forEach(k => {
          if (k !== '' && open.indexOf(k) < 0) open.push(k);
        });
        saveOpenFolders(open);
      } else {
        const res = await ipc('folders/rename', {
          key: dlg.key,
          name,
          root: section
        });
        saveOpenFolders(openFolders.map(k => renameKey(k, res.oldKey, res.key)));
        const current = normalizeKey(gstate.settings.importFolder);
        if (current && renameKey(current, res.oldKey, res.key) !== current) {
          await saveSettingsPatch({
            importFolder: renameKey(current, res.oldKey, res.key)
          });
        }
      }
      await refreshMods();
      setFolderDialog(null);
    } catch (err) {
      // stays open so the name can be corrected
      toast('danger', t('common:error'), explainError(err, t));
    }
  };

  const deleteFolder = async key => {
    try {
      await ipc('folders/delete', { key, root: section });
      saveOpenFolders(openFolders.filter(k => k !== key));
      await refreshMods();
    } catch (err) {
      toast('danger', t('common:error'), explainError(err, t));
    }
  };

  // right click on a folder of the "By folder" view
  // every section a mod can be put into, with the number it has now
  const sectionChoices = () =>
    order
      .filter(id => id !== 'maps')
      .map(id => ({
        id,
        label: `${numbers[id] === undefined ? '' : `${numbers[id]} · `}${sectionName(
          id,
          rules,
          t
        )}`
      }));

  // The small tag "→ Visual" of a mod in the list. Only in the sections view.
  // A click opens the choice of sections for this mod.
  const sectionTag = item => {
    if (!gstate.sectionMode || item.isMap) return null;
    const current = resolveSection(item, rules);
    const byHand = rules.mods && rules.mods[item.id];
    return {
      label: `→ ${sectionName(current, rules, t)}`,
      title: t('wads:sectionTagTitle'),
      onClick: () => {
        const menu = remote.Menu.buildFromTemplate([
          {
            label: t('wads:menuSectionAutoMod'),
            type: 'radio',
            checked: !byHand,
            click: () =>
              dispatch({ type: 'sections/assignMod', id: item.id, section: 'auto' })
          },
          { type: 'separator' },
          ...sectionChoices().map(choice => ({
            label: choice.label,
            type: 'radio',
            checked: !!byHand && current === choice.id,
            click: () =>
              dispatch({ type: 'sections/assignMod', id: item.id, section: choice.id })
          }))
        ]);
        menu.popup({ window: remote.getCurrentWindow() });
      }
    };
  };

  // "Section: Monsters" - shows only the mods that go to that section
  const sectionFilterBox =
    gstate.sectionMode && section === 'mods'
      ? {
          // "all" has a real value: the box shows its text from the start
          value: sectionFilter || 'all',
          options: [
            { label: t('wads:sectionFilterAll'), value: 'all' },
            ...sectionChoices().map(choice => ({
              label: t('wads:sectionFilterOne', { name: choice.label }),
              value: choice.id
            }))
          ],
          onChange: ({ value }) => setSectionFilter(value === 'all' ? '' : value)
        }
      : null;

  // a section filter that points to a section that is gone (or the view was left)
  useEffect(() => {
    if (sectionFilter && (!gstate.sectionMode || order.indexOf(sectionFilter) < 0)) {
      setSectionFilter('');
    }
  }, [gstate.sectionMode, order, sectionFilter]);

  const onFolderMenu = row => {
    const full = path.join(
      rootPath,
      ...(row.key ? row.key.split('/') : [])
    );
    const template = [
      {
        label: t('wads:menuAddAll'),
        enabled: row.count > 0,
        click: () => onAddFolder(row.key)
      },
      { type: 'separator' },
      {
        label: t('wads:menuNewSub'),
        click: () => setFolderDialog({ mode: 'create', key: row.key, initial: '' })
      }
    ];
    if (row.key !== '') {
      template.push(
        {
          label: t('wads:menuRename'),
          click: () =>
            setFolderDialog({ mode: 'rename', key: row.key, initial: row.folder })
        },
        ...(section === 'mods'
          ? [
              {
                label: t('wads:menuNewModsHere'),
                type: 'checkbox',
                checked: row.key === importFolder,
                click: () => setImportFolder(row.key)
              }
            ]
          : [])
      );
    }
    // "Section": which section of the load order the mods of this folder go to
    if (section === 'mods' && row.key !== '') {
      const given = gstate.sectionRules.folders[row.key];
      const assign = id => () =>
        dispatch({ type: 'sections/assignFolder', key: row.key, section: id });
      template.push({
        label: t('wads:menuSection'),
        submenu: [
          {
            label: t('wads:menuSectionAuto'),
            type: 'radio',
            checked: !given,
            click: assign('auto')
          },
          { type: 'separator' },
          ...order
            .filter(id => id !== 'maps')
            .map(id => ({
            label: `${
              numbers[id] === undefined ? '' : `${numbers[id]} · `
            }${sectionName(id, rules, t)}`,
            type: 'radio',
            checked: given === id,
            click: assign(id)
          }))
        ]
      });
    }
    template.push(
      { type: 'separator' },
      { label: t('wads:menuOpen'), click: () => remote.shell.openItem(full) }
    );
    if (row.key !== '') {
      template.push({
        label: t('wads:menuDeleteFolder'),
        enabled: row.count === 0,
        click: () => deleteFolder(row.key)
      });
    }
    remote.Menu.buildFromTemplate(template).popup();
  };

  // files dropped from Explorer straight onto a folder row
  const onDropToFolder = async (key, e) => {
    const files = Array.from(e.dataTransfer.files)
      .map(f => f.path)
      .filter(Boolean);
    if (!files.length) return;

    try {
      const res = await ipc('mods/import', {
        paths: files,
        folder: key,
        root: section,
        known: gstate.mods.map(m => m.id)
      });
      await refreshMods();
      if (key !== '' && openFolders.indexOf(key) < 0) {
        saveOpenFolders([...openFolders, key]);
      }
      const where = key || t('wads:noFolder');
      if (res.copied) {
        play('soundModSelect');
        toast(
          'ok',
          t('common:success'),
          t('wads:toastImported', { count: res.copied, folder: where })
        );
      }
      if (res.already.length) {
        toast(
          'ok',
          t('common:success'),
          t('wads:toastAlready', { names: res.already.join(', ') })
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
      toast('danger', t('common:error'), explainError(err, t));
    }
  };

  // one entry of the load order (same in the list and in the sections view)
  const renderLoadItem = (id, itemindex) => {
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
        conflicts={conflictInfo.counts.get(item.id) || 0}
        onConflicts={() => checkConflicts()}
        twin={twinIds.has(item.id)}
        onTwin={() => setTwinsOpen(true)}
        selected
      />
    ) : (
      <ErrorItem
        key={`NOTFOUND_ERROR${id}`}
        id={id}
        onSelect={onSelect(id)}
      />
    );
  };

  // keep one of the twins: the others leave the load order
  const onTwinKeep = (group, keepId) => {
    dispatch({
      type: 'mods/remove',
      ids: group.mods.filter(m => m.id !== keepId).map(m => m.id)
    });
    play('soundModSelect');
  };

  // ---- conflicts the user decided to live with ----
  const saveIgnored = list => {
    setIgnored(list);
    try {
      localStorage.setItem(IGNORED_KEY, JSON.stringify(list));
    } catch (e) {}
  };

  // are all mod files complete and readable?
  const runHealth = async () => {
    setHealthOpen(true);
    setHealth({ loading: true, result: null, error: null });
    try {
      const items = gstate.mods.map(m => ({
        id: m.id,
        name: m.name,
        path: m.path,
        kind: m.kind
      }));
      const result = await ipc('mods/health', { items });
      setHealth({ loading: false, result, error: null });
    } catch (err) {
      setHealth({ loading: false, result: null, error: explainError(err, t) });
    }
  };

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
      setConflicts({
        loading: false,
        result: null,
        error: explainError(err, t),
        count: items.length
      });
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
    const sure = await dialog.confirm({
      title: t('common:deleteTitle'),
      message: t('wads:confirmDelete', { name }),
      detail: path,
      confirmText: t('wads:deleteYes'),
      cancelText: t('wads:deleteNo'),
      danger: true
    });
    if (!sure) return;

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
      // sections view: a mod dropped on a mod of ANOTHER section joins that section
      // (in front of that mod) - it does not swap places with it
      if (gstate.sectionMode) {
        const targetId = gstate.package.selected[index];
        const target = gstate.mods.find(m => m.id === targetId);
        const draggedId =
          dragFrom !== null
            ? gstate.package.selected[dragFrom]
            : isModDrag(e)
            ? e.dataTransfer.getData(MOD_MIME)
            : null;
        const dragged = gstate.mods.find(m => m.id === draggedId);
        if (target && dragged && dragged.id !== target.id) {
          const targetSection = resolveSection(target, gstate.sectionRules);
          if (
            dragFrom === null ||
            resolveSection(dragged, gstate.sectionRules) !== targetSection
          ) {
            e.preventDefault();
            e.stopPropagation();
            dispatch({
              type: 'mod/toSection',
              id: dragged.id,
              section: targetSection,
              beforeId: target.id
            });
            play('soundModSelect');
            setDragFrom(null);
            setDragOver(null);
            setSectionOver(null);
            setDragging(false);
            return;
          }
        }
      }
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
      // handled here: the section box around must not move the mod again
      e.stopPropagation();
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
      setSectionOver(null);
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

  const isFolderDrag = e =>
    Array.from(e.dataTransfer.types || []).indexOf(FOLDER_MIME) > -1;

  // a whole folder into the load order; every mod goes to its section (by the
  // section number). Dropped on a section box, the folder is given that section.
  const addFolderToLoadOrder = (info, sectionId) => {
    const pool = gstate.mods.filter(m => !!m.isMap === (info.root === 'maps'));
    const ids = modsInFolder(pool, info.key).map(m => m.id);
    if (!ids.length) return;
    const fresh = ids.filter(id => gstate.package.selected.indexOf(id) < 0).length;

    if (sectionId && info.root !== 'maps') {
      dispatch({ type: 'sections/assignFolder', key: info.key, section: sectionId });
    }
    dispatch({ type: 'mods/drop', mods: [], ids });
    play('soundModSelect');
    if (fresh) {
      toast('ok', t('common:success'), t('wads:toastDrop', { count: fresh }));
    }
  };

  const readFolder = e => {
    try {
      return JSON.parse(e.dataTransfer.getData(FOLDER_MIME));
    } catch (err) {
      return null;
    }
  };

  // drops on the section boxes
  const frameDragOver = sectionId => e => {
    if (dragFrom === null && !isModDrag(e) && !isFolderDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dragFrom !== null ? 'move' : 'copy';
    if (sectionOver !== sectionId) setSectionOver(sectionId);
  };

  const frameDrop = sectionId => e => {
    e.preventDefault();
    e.stopPropagation();
    setSectionOver(null);
    setDragOver(null);
    setDragging(false);

    if (dragFrom !== null) {
      const id = gstate.package.selected[dragFrom];
      setDragFrom(null);
      dispatch({ type: 'mod/toSection', id, section: sectionId });
      play('soundModSelect');
    } else if (isModDrag(e)) {
      dispatch({
        type: 'mod/toSection',
        id: e.dataTransfer.getData(MOD_MIME),
        section: sectionId
      });
      play('soundModSelect');
    } else if (isFolderDrag(e)) {
      const info = readFolder(e);
      if (info) addFolderToLoadOrder(info, sectionId);
    }
  };

  const onDragOver = e => {
    if (!hasFiles(e) && !isModDrag(e) && !isFolderDrag(e)) return;
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
    if (isFolderDrag(e)) {
      e.preventDefault();
      setDragging(false);
      const info = readFolder(e);
      if (info) addFolderToLoadOrder(info, null);
      return;
    }
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
        root: section,
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
      toast('danger', t('common:error'), explainError(err, t));
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
    let base = [...sectionMods];
    // "Section: Monsters" (only in the sections view)
    if (gstate.sectionMode && sectionFilter) {
      base = base.filter(m => resolveSection(m, rules) === sectionFilter);
    }
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
  }, [sectionMods, sort, filter, favSet, recentIds, sectionFilter, gstate.sectionMode, rules]);

  const totalBytes = useMemo(
    () => sectionMods.reduce((n, m) => n + (m.bytes || 0), 0),
    [sectionMods]
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
            sectionTag={sectionTag}
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
            allFolders={section === 'maps' ? gstate.mapFolders : gstate.folders}
            maps={section === 'maps'}
            importFolder={section === 'mods' ? importFolder : ''}
            fixedExtra={hasMaps ? 46 : 0}
            onFolderMenu={onFolderMenu}
            onDropFiles={onDropToFolder}
            onNewFolder={() =>
              setFolderDialog({ mode: 'create', key: '', initial: '' })
            }
            recentIds={recentIds}
            footer={
              <ModStats
                count={sectionMods.length}
                bytes={totalBytes}
                maps={section === 'maps'}
                groups={gstate.duplicates.length + gstate.versions.length}
                onOpen={() => setDupesOpen(true)}
                onUsage={() => setUsageOpen(true)}
                onHealth={runHealth}
                fixes={fixable.length}
                onFix={() => setFixOpen(true)}
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
                section={section}
                onSection={hasMaps ? onSection : null}
                counts={counts}
                sectionFilter={sectionFilterBox}
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
          <Box
            fixedExtra={46}
            fixed={
              <>
                <TabSwitch
                  tabs={[
                    { value: 'list', label: t('wads:viewList') },
                    { value: 'sections', label: t('wads:viewSections') }
                  ]}
                  value={view}
                  onChange={onView}
                />
                <PackageAreaNew />
              </>
            }
          >
            {gstate.package.notes ? (
              <NotesStyle>
                <b>{t('wads:notesTitle')}</b>
                {gstate.package.notes}
              </NotesStyle>
            ) : null}
            {gstate.package.selected.length > 0 ? (
              <SummaryStyle>
                <span>
                  <b>
                    {t('wads:statsMods', {
                      count: selectedMods.filter(m => !m.isMap).length
                    })}
                    {selectedMods.some(m => m.isMap)
                      ? ` + ${t('wads:statsMaps', {
                          count: selectedMods.filter(m => m.isMap).length
                        })}`
                      : ''}
                  </b>{' '}
                  ·{' '}
                  <b>{byteSize(loadBytes).toString()}</b>
                </span>
                {missingCount > 0 ? (
                  <a
                    className="bad"
                    onClick={() => (fixable.length ? setFixOpen(true) : null)}
                  >
                    {t('wads:summaryMissing', { count: missingCount })}
                  </a>
                ) : null}
                {conflictInfo.pairs > 0 ? (
                  <a className="warn" onClick={() => checkConflicts()}>
                    {t('wads:summaryConflicts', { count: conflictInfo.pairs })}
                  </a>
                ) : null}
                {twinGroups.length > 0 ? (
                  <a className="warn" onClick={() => setTwinsOpen(true)}>
                    {t('wads:summaryTwins', { count: twinGroups.length })}
                  </a>
                ) : null}
              </SummaryStyle>
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
            {view === 'sections' ? (
              <ToolbarStyle>
                <a onClick={() => setEditorOpen(true)}>{t('wads:sectionsEdit')}</a>
                {orderChanged ? (
                  <a onClick={() => dispatch({ type: 'sections/resetOrder' })}>
                    {t('wads:sectionsReset')}
                  </a>
                ) : null}
              </ToolbarStyle>
            ) : null}
            {view === 'sections' ? (
              <ul>
                {order
                  .filter(
                    id => id !== 'maps' || hasMaps || fixedGroups.maps.length > 0
                  )
                  .map((id, place, shown) => {
                    const entries = fixedGroups[id];
                    const number = numbers[id];
                    const name = sectionName(id, rules, t);
                    // the maps keep the last place, nothing moves behind them
                    const movable = id !== 'maps';
                    const last = shown.filter(x => x !== 'maps').length - 1;
                    return (
                      <SectionFrame
                        key={`section_${id}`}
                        title={number === undefined ? name : `${number} · ${name}`}
                        count={entries.length}
                        note={sectionNote(id, rules, t)}
                        empty={entries.length ? undefined : t('wads:sectionEmpty')}
                        moveable={movable}
                        canUp={movable && place > 0}
                        canDown={movable && place < last}
                        onUp={() =>
                          dispatch({ type: 'sections/move', id, direction: 'up' })
                        }
                        onDown={() =>
                          dispatch({ type: 'sections/move', id, direction: 'down' })
                        }
                        dropping={sectionOver === id}
                        onDragOver={frameDragOver(id)}
                        onDragLeave={e => {
                          if (!e.currentTarget.contains(e.relatedTarget)) {
                            setSectionOver(null);
                          }
                        }}
                        onDrop={frameDrop(id)}
                      >
                        {entries.map(entry => renderLoadItem(entry.id, entry.index))}
                      </SectionFrame>
                    );
                  })}
              </ul>
            ) : (
              <ul>
                <AnimatePresence>
                  {gstate.package.selected.length > 0 &&
                    gstate.package.selected.map((id, itemindex) =>
                      renderLoadItem(id, itemindex)
                    )}
                </AnimatePresence>
              </ul>
            )}
          </Box>
        </Flex.Col>
      </Flex.Grid>
      <DiskUsageModal
        active={usageOpen}
        onClose={() => setUsageOpen(false)}
        mods={sectionMods}
        maps={section === 'maps'}
        duplicates={gstate.duplicates}
        onShow={onShowMod}
        onDelete={mod => onDeleteMod(mod.path, mod.name, mod.id)}
        onOpenDuplicates={() => {
          setUsageOpen(false);
          setDupesOpen(true);
        }}
      />
      <SectionsEditor
        active={editorOpen}
        rules={rules}
        onClose={() => setEditorOpen(false)}
        onSave={config => {
          dispatch({ type: 'sections/saveConfig', config });
          setEditorOpen(false);
        }}
      />
      <TwinsModal
        active={twinsOpen}
        onClose={() => setTwinsOpen(false)}
        groups={twinGroups}
        onKeep={onTwinKeep}
        onNotSame={group => saveIgnored([...ignored, twinKey(group)])}
      />
      <BrokenFilesModal
        active={healthOpen}
        onClose={() => setHealthOpen(false)}
        loading={health.loading}
        error={health.error}
        result={health.result}
        count={gstate.mods.length}
        modpath={gstate.settings.modpath}
        onShow={onShowMod}
        onDelete={mod => async () => {
          await onDeleteMod(mod.path, mod.name, mod.id)();
          runHealth();
        }}
        onRecheck={runHealth}
      />
      <ConflictsModal
        active={conflictsOpen}
        onClose={() => setConflictsOpen(false)}
        loading={conflicts.loading}
        error={conflicts.error}
        result={conflicts.result}
        count={conflicts.count}
        onSwap={onConflictSwap}
        onRemove={onConflictRemove}
        ignored={ignored}
        onIgnore={key => saveIgnored([...ignored, key])}
        onUnignore={key => saveIgnored(ignored.filter(k => k !== key))}
      />
      <FixPackagesModal
        active={fixOpen}
        onClose={() => setFixOpen(false)}
        fixes={fixes}
        onApply={applyFixes}
      />
      <FolderNameModal
        dialog={folderDialog}
        onSubmit={submitFolderDialog}
        onCancel={() => setFolderDialog(null)}
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
