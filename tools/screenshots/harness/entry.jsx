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
import Tools from '../client/views/Tools';
import Head from '../client/components/Head';
import UpscaleWatcher from '../client/components/Upscaler/Watcher';
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


// ---------------------------------------------------------------------------
// Tools page and Tools > Upscaler: "tools" (the cards and the menu) and one scene per
// state of the Upscaler: up-none, up-dlg (download question), up-download, up-ready,
// up-wad, up-preview, up-running, up-paused, up-done, up-error. The main part is faked.
// The preview pictures are drawn here (a smooth enlargement, not the AI): they show
// the screen, not the quality of a model.
// ---------------------------------------------------------------------------
const UP_MODS = [
  mk('u1', 'project brutality 3', ['1_BP'], 320),
  mk('u2', 'doom neural upscale', ['8_UPSCALE'], 410),
  mk('u3', 'extra monsters', ['3_MONSTERS'], 60),
  { ...mk('u4', 'old school maps', ['2_X'], 8), kind: 'WAD', path: 'C:\\Doom\\old school maps.wad' },
  mk('map:u5', 'castle of horrors', ['Episode 1'], 12, { isMap: true })
];
const UP_MODELS = [
  { id: 'realesrgan-x4plus-anime', scales: [4], family: false, known: 'drawn' },
  { id: 'realesrgan-x4plus', scales: [4], family: false, known: 'general' },
  { id: 'realesr-animevideov3', scales: [2, 3, 4], family: true, known: 'fast' }
];
const ENGINE_DIR = 'C:\\SSGL_DOOM LAUNCHER\\DATA\\tools\\realesrgan';

// a small picture drawn with a few rectangles, and its smooth 2x enlargement
const drawSample = (w, h, paint) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  paint(g, w, h);
  const big = document.createElement('canvas');
  big.width = w * 2;
  big.height = h * 2;
  const b = big.getContext('2d');
  b.imageSmoothingEnabled = true;
  b.imageSmoothingQuality = 'high';
  b.drawImage(c, 0, 0, w * 2, h * 2);
  return { before: c.toDataURL(), after: big.toDataURL() };
};
const bricks = (g, w, h) => {
  g.fillStyle = '#4a3a30';
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 8)
    for (let x = (y / 8) % 2 ? -8 : 0; x < w; x += 16) {
      g.fillStyle = ['#8a5a40', '#7a4e38', '#96654a'][(x + y) % 3 < 0 ? 0 : ((x + y) / 8) % 3];
      g.fillRect(x + 1, y + 1, 14, 6);
    }
};
const imp = (g, w, h) => {
  g.fillStyle = '#7a5230';
  g.fillRect(12, 10, 16, 26);
  g.fillRect(8, 16, 4, 14);
  g.fillRect(28, 16, 4, 14);
  g.fillStyle = '#a06a3a';
  g.fillRect(15, 3, 10, 9);
  g.fillStyle = '#ff3010';
  g.fillRect(17, 6, 2, 2);
  g.fillRect(21, 6, 2, 2);
  g.fillStyle = '#5a3a20';
  g.fillRect(13, 36, 5, 12);
  g.fillRect(22, 36, 5, 12);
};
const title = (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#200000');
  grd.addColorStop(1, '#a01000');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#f0c040';
  g.font = 'bold 22px serif';
  g.fillText('DOOM', 20, 48);
};

const upAnswer = st => {
  const engineOk = { ok: true, folder: ENGINE_DIR, exe: ENGINE_DIR + '\\realesrgan-ncnn-vulkan.exe', models: ENGINE_DIR + '\\models', list: UP_MODELS, problem: '', tested: { ok: true } };
  const engineNone = { ok: false, folder: ENGINE_DIR, exe: '', models: '', list: [], problem: 'noFolder', tested: null };
  const noEngine = ['up-none', 'up-dlg', 'up-download'].indexOf(scene) > -1;
  const status = { settings: { engineFolder: ENGINE_DIR, destFolder: '', model: 'realesrgan-x4plus-anime', scale: 2, kinds: ['texture', 'flat', 'sprite', 'graphic'] }, modpath: 'C:\\Doom', engine: noEngine ? engineNone : engineOk, job: null, project: 'https://github.com/xinntao/Real-ESRGAN' };
  const kinds = { texture: { count: 1240, pixels: 1240 * 64 * 128 }, flat: { count: 310, pixels: 310 * 64 * 64 }, sprite: { count: 2960, pixels: 2960 * 48 * 64 }, graphic: { count: 140, pixels: 140 * 160 * 100 }, other: { count: 22, pixels: 22 * 256 * 256 } };
  return async (ch, d) => {
    switch (ch) {
      case 'upscaler/status': return { error: null, data: status };
      case 'upscaler/release': return { error: null, data: { tag: 'v0.2.5.0', size: 45 * 1024 * 1024, name: 'realesrgan-ncnn-vulkan-20220424-windows.zip', url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip' } };
      case 'upscaler/download': return new Promise(() => {});
      case 'upscaler/collect':
        if (/\.wad$/i.test(d)) return { error: null, data: { type: 'wad', supported: false, reason: 'wad', kinds: {}, doomFormat: 0, total: 0 } };
        return { error: null, data: { type: 'zip', supported: true, reason: '', kinds, doomFormat: 36, total: 4672 } };
      case 'upscaler/estimate': return { error: null, data: { bytes: 1.8 * 1024 * 1024 * 1024, big: true, free: 400 * 1024 * 1024 * 1024 } };
      case 'upscaler/preview':
        return { error: null, data: { model: d.model, ms: 2400, samples: [
          { path: 'textures/walls/BRICK7.png', kind: 'texture', width: 64, height: 32, ...drawSample(64, 32, bricks) },
          { path: 'sprites/monsters/TROOA1.png', kind: 'sprite', width: 40, height: 50, ...drawSample(40, 50, imp) },
          { path: 'graphics/TITLEPIC.png', kind: 'graphic', width: 160, height: 100, ...drawSample(160, 100, title) }
        ] } };
      case 'upscaler/state': return { error: null, data: null };
      default: return { error: null, data: st || true };
    }
  };
};

const ToolsScene = () => {
  const isUp = scene.indexOf('up-') === 0;
  const init = { ...initState, mods: UP_MODS, sourceports: [{ id: 's' }], packages: [{ id: 'p' }], folders: [['1_BP'], ['3_MONSTERS'], ['8_UPSCALE'], ['2_X']],
    settings: { ...initState.settings, language: lng, theme: themeName, style: styleName, modpath: 'C:\\Doom', savepath: 'C:\\SSGL_DOOM LAUNCHER\\DATA' } };
  const [gstate, dispatch] = useReducer(reducer, init);
  useEffect(() => {
    if (!isUp) return;
    const t = i18n.t.bind(i18n);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const button = label => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === label);
    const pick = async (name, label) => {
      const hidden = Array.from(document.querySelectorAll('input')).find(i => i.name === name);
      hidden.parentElement.querySelector('input[type=text]').focus();
      await wait(80);
      const li = Array.from(document.querySelectorAll('li')).find(x => x.textContent.trim() === label);
      if (li) li.click();
      if (document.activeElement) document.activeElement.blur();
      await wait(350);
    };
    const emit = (ch, data) => ipcRenderer.emit(ch, {}, data);
    (async () => {
      await wait(150);
      button(t('tools:open')).click();
      await wait(250);
      if (scene === 'up-dlg' || scene === 'up-download') {
        button(t('tools:download')).click();
        await wait(250);
        if (scene === 'up-download') {
          button(t('tools:dlYes')).click();
          await wait(100);
          emit('upscaler/download-progress', { done: 19 * 1024 * 1024, total: 45 * 1024 * 1024 });
        }
        return;
      }
      if (scene === 'up-none') return;
      await pick('upscaleSource', scene === 'up-wad' ? 'old school maps (WAD)' : 'project brutality 3 (PK3)');
      if (scene === 'up-preview') {
        button(t('tools:makePreview')).click();
        await wait(300);
      }
      const job = { phase: 'running', done: 1214, total: 4650, eta: 1130, current: 'sprites/monsters/TROOA1.png', startedAt: 1 };
      if (scene === 'up-running') emit('upscaler/progress', job);
      if (scene === 'up-paused') emit('upscaler/progress', { ...job, phase: 'paused', pausedReason: 'game' });
      if (scene === 'up-done') emit('upscaler/progress', { phase: 'done', done: 4650, total: 4650, startedAt: 1, result: { file: 'C:\\Doom\\8_UPSCALE\\project brutality 3 upscale 2x.pk3', bytes: 1.7 * 1024 * 1024 * 1024, images: 4648, skipped: [{ path: 'a' }, { path: 'b' }] } });
      if (scene === 'up-error') emit('upscaler/progress', { phase: 'error', startedAt: 3, error: { code: 'noVulkan', detail: 'vkCreateInstance failed -9\ninvalid gpu device' } });
    })();
  }, []);
  return (
    <StoreContext.Provider value={{ gstate, dispatch }}>
      <ThemeProvider theme={applyStyle(themed, styleName)}><>
        <StyleLayer style={styleName} />
        <AudioProvider>
          <ToastContext.Provider value={{ addToast() {}, toasts: [] }}>
            <DialogProvider>
              <Body background={bgPath} fit={fitName} dim={0} blur={0}>
                <Head />
                <div style={{ margin: 15 }}><Tools /></div>
                <UpscaleWatcher />
              </Body>
            </DialogProvider>
          </ToastContext.Provider>
        </AudioProvider>
      </></ThemeProvider>
    </StoreContext.Provider>
  );
};

const App = () => {
  if (scene === 'markers') return <MarkersScene />;
  if (scene === 'settings') return <SettingsScene />;
  if (scene === 'tools' || scene.indexOf('up-') === 0) return <ToolsScene />;
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

ipcRenderer.invoke = scene === 'tools' || scene.indexOf('up-') === 0
  ? upAnswer()
  : async ch => (ch === 'mods/conflicts' ? { error: null, data: { checked: 3, skipped: [], conflicts: [] } } : { error: null, data: null });
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
