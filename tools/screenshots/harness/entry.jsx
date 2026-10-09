import { ipcRenderer } from 'electron';
import React, { useEffect, useReducer } from 'react';
import ReactDOM from 'react-dom';
import { ThemeProvider } from 'styled-components';

import '../client/global.css';
import Body from '../client/components/Body';
import Update from '../client/components/Update';
import { DialogProvider, useDialog } from '../client/components/Dialog';
import AudioProvider from '../client/components/Audio';
import ToastContext from '../client/components/Toast/ToastContext';
import Wads from '../client/views/Wads';
import Check, { MARKERS } from '../client/components/Mods/Checkmarks';
import Settings from '../client/views/Settings';
import { CheckingLine, LoadingScreen } from '../client/components/Startup';
import { reducer } from '../client/state/reducer';
import { BrokenFilesModal, ConflictsModal, FixPackagesModal, FolderNameModal, TwinsModal } from '../client/components';
import i18n from '../client/i18n';
import { StoreContext } from '../client/state';
import { initState } from '../client/state/reducer';
import themes from '../client/Theme';
import { applyStyle, StyleLayer } from '../client/Theme/styles';

const hashParts = decodeURIComponent(location.hash.slice(1)).split(',');
const [scene, lng = 'en', themeName = 'hell'] = hashParts;
const styleName = hashParts.find(x => ['cyberpunk', 'gothic'].indexOf(x) > -1) || 'classic';
const themed = themes[themeName];
const markerName = (hashParts.find(x => x.indexOf('marker:') === 0) || 'marker:auto').slice(7);
const bgPath = (hashParts.find(x => x.indexOf('bg:') === 0) || '').slice(3);
const fitName = (hashParts.find(x => x.indexOf('fit:') === 0) || 'fit:cover').slice(4);
// "scroll:marker" scrolls Settings so the marker picker is in view
const scrollTo = (hashParts.find(x => x.indexOf('scroll:') === 0) || '').slice(7);

const longMessage =
  'Add Russian language, update notice for new uploads and a safer way of saving packages\n\n' +
  '- the settings are written to a temporary file first\n- a copy of the last good version is kept\n- long names like Brutal_Doom_Project_Brutality_Complete_Edition_v21_final_FIXED.pk3 wrap now';

const SCENES = {
  'update-files': {
    available: true,
    kind: 'files',
    repo: 'SD-V2/ssgl-doom-launcher',
    sha: 'bbbbbbb2222',
    version: 'bbbbbbb',
    download: 'https://github.com/SD-V2/ssgl-doom-launcher/commit/bbbbbbb2222',
    changelog: longMessage
  },
  'update-release': {
    available: true,
    kind: 'release',
    version: 'v2.0.0-devpreview.25',
    download: 'https://github.com/SD-V2/ssgl-doom-launcher/releases/tag/v2.0.0-devpreview.25',
    changelog: '## Changes\n\n- new folder view\n- Russian, Turkish and Arabic\n- `Build-SSGL.cmd` shows the build date\n\n```\nyarn install\n```'
  }
};

const MB = 1024 * 1024;
const mod = (id, name, mb, created) => ({ id, name, kind: 'PK3', size: mb + ' MB', bytes: mb * MB, created, path: 'C:\\Doom\\mods\\1_BP\\' + name + '.pk3', folders: ['1_BP'] });
const noop = () => () => {};
const MODALS = {
  health: () => <BrokenFilesModal active onClose={() => {}} onShow={noop} onDelete={noop} onRecheck={() => {}} modpath="C:\\Doom\\mods" count={40}
    result={{ checked: 36, unchecked: 2, problems: [
      { id: 'a', name: 'Brutal Doom Project Brutality v21', path: 'C:\\Doom\\mods\\1_BP\\half.pk3', kind: 'PK3', code: 'damaged', detail: '' },
      { id: 'b', name: 'saved page', path: 'C:\\Doom\\mods\\x\\page.pk3', kind: 'PK3', code: 'notArchive', detail: '' },
      { id: 'd', name: 'disguised', path: 'C:\\Doom\\mods\\d.pk3', kind: 'PK3', code: 'wrongType', detail: '7z' }] }} />,
  twins: () => <TwinsModal active onClose={() => {}} onKeep={() => {}} onNotSame={() => {}}
    groups={[{ key: 'k', tier: 2, mods: [mod('1', 'brutal pack v21', 100, 1), mod('2', 'brutal pack v22', 120, 2)] }]} />,
  conflicts: () => <ConflictsModal active onClose={() => {}} onSwap={() => {}} onRemove={() => {}} ignored={[]} count={5}
    result={{ checked: 5, skipped: [{ id: 's', name: 'old.pk7', code: 'unsupported', detail: '7z' }], conflicts: [
      { a: 'a', aName: 'Brutal Doom Project Brutality v21', b: 'b', bName: 'Weapons pack v22', count: 12, groups: [{ label: 'Shotgun', count: 8 }, { label: 'Other sprites', count: 4 }], sample: ['sprites/SHTGA0', 'sounds/DSSHOTGN'] }] }} />,
  fix: () => <FixPackagesModal active onClose={() => {}} onApply={() => {}}
    fixes={[{ id: 'o1', name: 'brutal pack v21', packages: ['Brutal run', 'Other'], candidate: { mod: mod('n1', 'brutal pack v22', 120, 2), tier: 2 } },
            { id: 'o2', name: 'weapons', packages: ['Brutal run'], candidate: { mod: mod('n2', 'weapons', 30, 3), tier: 1 } },
            { id: 'o3', name: 'weapons 2', packages: ['Brutal run'], candidate: { mod: mod('n3', 'weapons 2', 30, 3), tier: 1 } }]} />,
  folder: () => <FolderNameModal dialog={{ mode: 'create', key: '1_BP', initial: '' }} onSubmit={() => {}} onCancel={() => {}} />
};

const MBx = 1024 * 1024;
const mk = (id, name, folders, mb, extra = {}) => ({ id, name, kind: 'PK3', size: mb + ' MB', bytes: mb * MBx, created: 1000 + mb, path: 'C:\\Doom\\' + name + '.pk3', folders, folder: folders[0] || '', tags: folders.map(f => f.toLowerCase()), lastdir: 'x', active: false, ...extra });
const WADS_MODS = [mk('a', 'brutal doom v21', ['1_BP'], 120), mk('b', 'weapons pack', ['2_WEAPONS'], 30), mk('c', 'hd textures', ['8_UPSCALE'], 400), mk('d', 'neonover', [], 85)];
const WADS_MAPS = [mk('map:m1', 'castle of horrors', ['Episode 1'], 12, { isMap: true }), mk('map:m2', 'sunken city', ['Episode 1'], 8, { isMap: true }), mk('map:m3', 'final stand', ['Episode 2'], 20, { isMap: true }), mk('map:m4', 'speed map', [], 3, { isMap: true })];

const SEC_MODS = [
  mk('s1', 'gutamatics', ['0_LIBS'], 1),
  mk('s2', 'project brutality 3', ['1_BP'], 320),
  mk('s3', 'extra monsters', ['3_MONSTERS'], 60),
  mk('s4', 'glory kills 2', ['2_ GLORY KILLS'], 18),
  mk('s5', 'more guns', ['5_WEAPONS'], 90),
  mk('s6', 'health regen', ['4_GAMEPLAY'], 1),
  mk('s7', 'hd sound pack', ['6_SOUNDS'], 140),
  mk('s8', 'hud pack', ['7_VISUAL'], 5),
  mk('s9', 'doom neural upscale', ['8_UPSCALE'], 410),
  mk('s10', 'some random addon', ['Random stuff'], 7),
  mk('map:s11', 'castle of horrors', ['Episode 1'], 12, { isMap: true })
];

const WadsScene = () => {
  window.localStorage.setItem('ssgl.sort', (decodeURIComponent(location.hash.slice(1)).split(',')[4] || 'new'));
  window.localStorage.setItem('ssgl.section', (decodeURIComponent(location.hash.slice(1)).split(',')[3] || 'mods'));
  const useSec = scene.indexOf('wads-sections') === 0;
  const few = scene === 'wads-sections-few';
  if (useSec) window.localStorage.setItem('ssgl.loadView', 'sections');
  const init = { ...initState, mods: (useSec ? SEC_MODS : [...WADS_MODS, ...WADS_MAPS]).map(m => ({ ...m, active: few ? ['s2', 's3', 's5'].indexOf(m.id) > -1 : (useSec || ['a', 'b', 'map:m1'].indexOf(m.id) > -1) })),
    folders: [['1_BP'], ['2_WEAPONS'], ['8_UPSCALE']], mapFolders: [['Episode 1'], ['Episode 2'], ['Empty maps']],
    sectionMode: useSec,
    package: { ...initState.package, selected: few ? ['s2', 's3', 's5'] : useSec ? SEC_MODS.map(m => m.id) : ['a', 'b', 'map:m1'] },
    settings: { ...initState.settings, language: lng, marker: markerName, theme: themeName, modpath: 'C:\\Doom', mappath: 'C:\\Doom\\Maps' } };
  const [gstate, dispatch] = useReducer(reducer, init);
  return (
    <StoreContext.Provider value={{ gstate, dispatch }}>
      <ThemeProvider theme={applyStyle(themed, styleName)}><><StyleLayer style={styleName} />
        <AudioProvider>
          <ToastContext.Provider value={{ addToast() {}, toasts: [] }}>
            <Body background={bgPath} fit={fitName} dim={0} blur={0}><Wads /></Body>
          </ToastContext.Provider>
        </AudioProvider>
      </></ThemeProvider>
    </StoreContext.Provider>
  );
};

const Ask = () => {
  const dialog = useDialog();
  React.useEffect(() => {
    const t = i18n.t.bind(i18n);
    if (scene === 'dlg-discard') {
      dialog.confirm({ title: t('packages:unsavedTitle'), message: t('packages:unsavedMessage'), detail: t('packages:unsavedDetail'), confirmText: t('packages:unsavedDiscard'), cancelText: t('common:cancel'), danger: true });
    } else if (scene === 'dlg-delete') {
      dialog.confirm({ title: t('common:deleteTitle'), message: t('wads:confirmDelete', { name: 'Brutal Doom Project Brutality v21' }), detail: 'C:\\Doom\\mods\\1_BP\\Brutal_Doom_Project_Brutality_Complete_Edition_v21_final_FIXED.pk3', confirmText: t('wads:deleteYes'), cancelText: t('wads:deleteNo'), danger: true });
    } else if (scene === 'dlg-import') {
      dialog.info({ title: t('packages:importDone', { count: 2 }), lines: ['Brutal run: IWAD "doom2.wad" not found, pick one by editing the package', 'Brutal run: sourceport "GZDoom" not found, using "UZDoom"', '', t('packages:importMissing', { count: 3 }), 'brutal pack v21.pk3  (Brutal run)', 'weapons.pk3  (Brutal run)', 'castle of horrors.wad  (Maps tour)'], okText: t('common:ok'), wide: true });
    }
  }, []);
  return null;
};

const SettingsScene = () => {
  useEffect(() => {
    if (scrollTo !== 'marker') return;
    const timer = setTimeout(() => {
      const tile = document.querySelector('[role=button][aria-pressed]');
      if (tile) tile.parentElement.previousElementSibling.scrollIntoView({ block: 'start' });
    }, 600);
    return () => clearTimeout(timer);
  }, []);
  const init = { ...initState, packages: [{ id: 'p1', name: 'x', selected: [], cover: { isFile: false, use: 'doom2' } }], settings: { ...initState.settings, language: lng, marker: markerName, theme: themeName, theme: themeName, style: styleName, modpath: 'C:\\SSGL\\WADS', mappath: 'C:\\SSGL\\Maps', savepath: 'C:\\SSGL_DOOM LAUNCHER\\DATA', wallpaperFit: fitName, background: bgPath ? 'C:\\Users\\GH\\Downloads\\wallpaper.jpg' : '' } };
  const [gstate, dispatch] = useReducer(reducer, init);
  return (
    <StoreContext.Provider value={{ gstate, dispatch }}>
      <ThemeProvider theme={applyStyle(themed, styleName)}><>
        <StyleLayer style={styleName} />
        <AudioProvider>
          <ToastContext.Provider value={{ addToast() {}, toasts: [] }}>
            <DialogProvider><Body background={bgPath} fit={fitName} dim={0} blur={0}><Settings /></Body></DialogProvider>
          </ToastContext.Provider>
        </AudioProvider>
      </></ThemeProvider>
    </StoreContext.Provider>
  );
};

const MarkersScene = () => (
  <StoreContext.Provider value={{ gstate: { ...initState, settings: { ...initState.settings, language: lng } }, dispatch() {} }}>
    <ThemeProvider theme={applyStyle(themed, styleName)}><>
      <StyleLayer style={styleName} />
      <Body background={bgPath} fit={fitName} dim={0} blur={0}>
        <div style={{ display: 'flex', flexWrap: 'wrap', padding: 20 }}>
          {MARKERS.map(id => (
            <div key={id} style={{ width: 150, textAlign: 'center', margin: 6 }}>
              <Check theme={id} active size="110" />
              <div style={{ fontSize: 14, textTransform: 'uppercase' }}>{id}</div>
            </div>
          ))}
        </div>
      </Body>
    </></ThemeProvider>
  </StoreContext.Provider>
);

// the loading screen of the start ("loading" = with the number of mods of the last start,
// "loading-first" = the very first start)
const LoadingScene = () => (
  <ThemeProvider theme={applyStyle(themed, styleName)}><>
    <StyleLayer style={styleName} />
    <LoadingScreen count={scene === 'loading' ? 560 : 0} />
  </></ThemeProvider>
);

const App = () => {
  if (scene === 'loading' || scene === 'loading-first') return <LoadingScene />;
  if (scene === 'markers') return <MarkersScene />;
  if (scene === 'settings') return <SettingsScene />;
  if (scene.indexOf('dlg-') === 0) {
    return (
      <StoreContext.Provider value={{ gstate: { ...initState, settings: { ...initState.settings, language: lng } }, dispatch() {} }}>
        <ThemeProvider theme={applyStyle(themed, styleName)}><><StyleLayer style={styleName} />
          <DialogProvider><Body background={bgPath} fit={fitName} dim={0} blur={0}><Ask /></Body></DialogProvider>
        </></ThemeProvider>
      </StoreContext.Provider>
    );
  }
  if (scene === 'wads' || scene.indexOf('wads-sections') === 0) return <WadsScene />;
  const state = { ...initState, settings: { ...initState.settings, language: lng }, update: SCENES[scene] };
  return (
    <StoreContext.Provider value={{ gstate: state, dispatch() {} }}>
      <ThemeProvider theme={applyStyle(themed, styleName)}><><StyleLayer style={styleName} />
        <Body background={bgPath} fit={fitName} dim={0} blur={0}>
          {MODALS[scene] ? MODALS[scene]() : <Update />}
        </Body>
      </></ThemeProvider>
    </StoreContext.Provider>
  );
};

ipcRenderer.invoke = async ch => (ch === 'mods/conflicts' ? { error: null, data: { checked: 3, skipped: [], conflicts: [] } } : { error: null, data: null });
// window.__remount() draws the scene again from the start (for "node run.js tab": the
// screen comes in again, as after a tab switch)
const Remountable = () => {
  const [n, setN] = React.useState(0);
  useEffect(() => {
    window.__remount = () => setN(x => x + 1);
  }, []);
  return <App key={n} />;
};

i18n.changeLanguage(lng).then(() => {
  ReactDOM.render(<Remountable />, document.getElementById('root'));
  window.__ready = true;
});
