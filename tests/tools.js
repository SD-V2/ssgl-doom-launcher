// Tools page and Tools > Upscaler, the screens: the menu item (between Sourceports and
// Settings), the tool cards, every state of the Upscaler screen (no engine, downloading,
// ready, preview, running, paused, done, error), the background watcher, four languages.
// The main part is faked (its answers are what electron/handlers/upscaler.js sends).
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/#/tools', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
global.localStorage = dom.window.localStorage; global.HTMLElement = dom.window.HTMLElement; ['Element', 'Node', 'SVGElement', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'MutationObserver'].forEach(k => { if (dom.window[k] !== undefined && global[k] === undefined) global[k] = dom.window[k]; });
const Module = require('module');
const path = require('path');
const APP = require('./paths').APP + '';
const origReq = Module.prototype.require;
const listeners = {};
const calls = [];
let answer = async () => ({ data: null, error: null });
const emit = (ch, data) => (listeners[ch] || []).slice().forEach(f => f({}, data));
Module.prototype.require = function (req) {
  if (req === 'electron') return {
    ipcRenderer: {
      send() {}, sendSync: require('./native-mock').sendSync,
      invoke: require('./native-mock').wrap(async (ch, d) => { calls.push([ch, d]); return answer(ch, d); }),
      on: (ch, f) => { (listeners[ch] = listeners[ch] || []).push(f); },
      removeListener: (ch, f) => { listeners[ch] = (listeners[ch] || []).filter(x => x !== f); }
    }
  };
  if (req.startsWith('#/')) req = path.join(APP, 'client', req.slice(2));
  return origReq.call(this, req);
};
['.svg', '.png', '.jpg', '.mp3', '.gif', '.css', '.ogg', '.wav', '.woff', '.woff2', '.ttf', '.eot'].forEach(ext => { require.extensions[ext] = m => { m.exports = 'stub' + ext; }; });
require('@babel/register')({
  presets: [APP + '/node_modules/@babel/preset-env', APP + '/node_modules/@babel/preset-react'],
  plugins: [APP + '/node_modules/@babel/plugin-transform-runtime', APP + '/node_modules/babel-plugin-styled-components'],
  babelrc: false, configFile: false, cache: false, extensions: ['.js', '.jsx'],
  only: [new RegExp(APP.replace(/\//g, '\\/') + '\\/client')]
});
const React = require(APP + '/node_modules/react');
const ReactDOM = require(APP + '/node_modules/react-dom');
const { Simulate } = require(APP + '/node_modules/react-dom/test-utils');
const { ThemeProvider } = require(APP + '/node_modules/styled-components');
const themes = require(APP + '/client/Theme/index.jsx').default;
const { StoreContext, initState } = require(APP + '/client/state');
const { reducer } = require(APP + '/client/state/reducer.js');
const ToastContext = require(APP + '/client/components/Toast/ToastContext.jsx').default;
const AudioProvider = require(APP + '/client/components/Audio').default;
const { DialogProvider } = require(APP + '/client/components/Dialog');
const i18n = require(APP + '/client/i18n.jsx').default;
const routes = require(APP + '/client/routes.js').default;
const NavList = require(APP + '/client/components/Nav/NavList.jsx').default;
const Tools = require(APP + '/client/views/Tools/index.jsx').default;
const Watcher = require(APP + '/client/components/Upscaler/Watcher.jsx').default;
const U = require(APP + '/client/utils/upscale.js');
const check = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---- what the fake main part answers --------------------------------------
const MODELS = [
  { id: 'realesrgan-x4plus-anime', scales: [4], family: false, known: 'drawn' },
  { id: 'realesrgan-x4plus', scales: [4], family: false, known: 'general' },
  { id: 'realesr-animevideov3', scales: [2, 3, 4], family: true, known: 'fast' }
];
const engineOk = { ok: true, folder: 'C:\\SSGL\\tools\\realesrgan', exe: 'C:\\SSGL\\tools\\realesrgan\\realesrgan-ncnn-vulkan.exe', models: 'C:\\SSGL\\tools\\realesrgan\\models', list: MODELS, problem: '', tested: { ok: true } };
const engineNone = { ok: false, folder: 'C:\\SSGL\\tools\\realesrgan', exe: '', models: '', list: [], problem: 'noFolder', tested: null };
let engine = engineNone;
const status = () => ({ settings: { engineFolder: 'C:\\SSGL\\tools\\realesrgan', destFolder: '', model: 'realesrgan-x4plus-anime', scale: 2, kinds: ['texture', 'flat', 'sprite', 'graphic'] }, defaults: {}, modpath: 'C:\\Doom', engine, job: null, project: 'https://github.com/xinntao/Real-ESRGAN' });
const kinds = { texture: { count: 120, pixels: 120 * 64 * 64 }, flat: { count: 30, pixels: 30 * 64 * 64 }, sprite: { count: 300, pixels: 300 * 40 * 60 }, graphic: { count: 12, pixels: 12 * 320 * 200 }, other: { count: 4, pixels: 4000 } };
const PNG1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
let downloadDone = null;
let compareDone = null;
let estimate = { bytes: 300 * 1024 * 1024, big: false, free: 50 * 1024 * 1024 * 1024 };
answer = async (ch, d) => {
  switch (ch) {
    case 'upscaler/status': return { data: status(), error: null };
    case 'upscaler/state': return { data: null, error: null };
    case 'upscaler/test': return { data: { ...status(), test: { ok: true } }, error: null };
    case 'upscaler/saveSettings': return { data: status(), error: null };
    case 'upscaler/release': return { data: { tag: 'v0.2.5.0', name: 'realesrgan-ncnn-vulkan-20220424-windows.zip', size: 45 * 1024 * 1024, url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip' }, error: null };
    case 'upscaler/download': return new Promise(r => { downloadDone = () => { engine = engineOk; r({ data: { ...status(), test: { ok: true } }, error: null }); }; });
    case 'upscaler/collect':
      if (/\.wad$/i.test(d)) return { data: { type: 'wad', supported: false, reason: 'wad', kinds: {}, doomFormat: 0, total: 0 }, error: null };
      return { data: { type: 'zip', supported: true, reason: '', kinds, doomFormat: 7, total: 466 }, error: null };
    case 'upscaler/estimate': return { data: estimate, error: null };
    case 'upscaler/preview': return { data: { model: d.model, ms: 2300, samples: [{ path: 'textures/STARTAN3.png', kind: 'texture', width: 64, height: 64, before: PNG1, after: PNG1, bytesFull: 300 * 1024, bytesSmall: 90 * 1024, small: false }, { path: 'sprites/TROOA1.png', kind: 'sprite', width: 40, height: 60, before: PNG1, after: PNG1, bytesFull: 120 * 1024, bytesSmall: 40 * 1024, small: true }, { path: 'graphics/TITLEPIC.png', kind: 'graphic', width: 320, height: 200, before: PNG1, after: PNG1 }] }, error: null };
    case 'upscaler/compare': return new Promise(r => { compareDone = () => r({ data: { look: d.look, samples: [{ path: 'textures/STARTAN3.png', kind: 'texture', width: 64, height: 64, before: PNG1 }, { path: 'sprites/SHTGA0.png', kind: 'sprite', width: 72, height: 44, before: PNG1 }], results: MODELS.map(m => ({ model: m.id, ms: 900, items: [{ after: PNG1, problem: '' }, { after: m.id === 'realesr-animevideov3' ? '' : PNG1, problem: m.id === 'realesr-animevideov3' ? 'noise' : '' }] })) }, error: null }); });
    case 'upscaler/start': return { data: { phase: 'running', done: 0, total: 462, startedAt: 1 }, error: null };
    case 'main/init': return { data: { mods: [...MODS, { ...mk('newup', 'Test Mod upscale 2x', ['8_UPSCALE']), path: 'C:\\Doom\\8_UPSCALE\\Test Mod upscale 2x.pk3' }], iwads: [] }, error: null };
    default: return { data: true, error: null };
  }
};

const mk = (id, name, folders, extra = {}) => ({ id, name, kind: 'PK3', size: '1 MB', bytes: 1, created: 1, path: 'C:\\Doom\\' + folders.join('\\') + '\\' + name + '.pk3', folders, folder: folders[0] || '', tags: [], lastdir: 'x', active: false, ...extra });
const MODS = [mk('bp', 'Test Mod', ['1_BP']), mk('w', 'old maps', ['2_X'], { kind: 'WAD', path: 'C:\\Doom\\2_X\\old maps.wad' }), mk('map:m1', 'castle', ['Ep1'], { isMap: true })];

(async () => {
  // ---- helpers ----------------------------------------------------------------
  check('helpers: textures + floors are one checkbox; monsters/weapons/items are OFF by default (experimental)', JSON.stringify(U.groupsToKinds(U.DEFAULT_GROUPS)) === '["texture","flat","graphic"]' && U.kindsToGroups(['sprite']).sprites === true && U.kindsToGroups(['sprite']).textures === false);
  check('helpers: time left as m:ss / h:mm:ss', U.formatTime(65) === '1:05' && U.formatTime(3725) === '1:02:05' && U.formatTime(0) === '0:00');
  check('helpers: sizes', U.formatBytes(300 * 1024 * 1024) === '300 MB' && U.formatBytes(1.5 * 1024 * 1024 * 1024) === '1.5 GB');
  check('helpers: an existing folder with "upscale" in its name is offered first, else 8_UPSCALE', U.pickDestFolder('', [['1_BP'], ['HD', 'Upscales']]) === 'HD/Upscales' && U.pickDestFolder('', [['1_BP']]) === '8_UPSCALE' && U.pickDestFolder('Mine', [['HD_upscale']]) === 'Mine');
  check('helpers: result name "<mod> upscale 2x.pk3"', U.resultFileName('Test Mod', 2) === 'Test Mod upscale 2x.pk3');

  // ---- the menu ------------------------------------------------------------------
  const labels = routes.filter(r => !r.hide).map(r => r.label);
  check('menu: Tools is between Sourceports and Settings', labels.indexOf('tools') === labels.indexOf('sourceports') + 1 && labels.indexOf('settings') === labels.indexOf('tools') + 1);
  const st = { ...initState, mods: MODS, sourceports: [{ id: 's' }], packages: [{ id: 'p' }], folders: [['1_BP'], ['2_X']], settings: { ...initState.settings, showTools: true, modpath: 'C:\\Doom', savepath: 'C:\\SSGL' } };
  const host = document.createElement('div'); document.body.appendChild(host);
  let latest = null;
  const App = ({ init, children }) => { const [g, d] = React.useReducer(reducer, init); latest = g; return React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: g, dispatch: d } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast: (...a) => (global.__toasts = global.__toasts || []).push(a), toasts: [] } }, React.createElement(DialogProvider, null, children))))); };
  const mount = el => { ReactDOM.unmountComponentAtNode(host); ReactDOM.render(React.createElement(App, { init: st }, el), host); };
  const text = () => host.textContent;
  const q = sel => Array.from(host.querySelectorAll(sel));
  const btn = label => q('button').find(b => b.textContent.trim() === label);
  const state = () => (host.querySelector('[data-upscaler]') || { getAttribute: () => '' }).getAttribute('data-upscaler');

  for (const [lng, name] of [['en', 'Tools'], ['tr', 'Araçlar'], ['ar', 'الأدوات'], ['ru', 'Инструменты']]) {
    await i18n.changeLanguage(lng);
    mount(React.createElement(NavList)); await wait(50);
    const items = q('li').map(li => li.textContent.trim());
    check(`menu (${lng}): "${name}" sits between the Sourceports and Settings items`, items.indexOf(name) > 0 && items.indexOf(name) === items.length - 2);
  }
  // the Tools item is hidden until "Show the Tools page" is ticked in Settings
  check('new setting "showTools": off by default', initState.settings.showTools === false);
  for (const off of [false, '', undefined]) {
    ReactDOM.unmountComponentAtNode(host); ReactDOM.render(React.createElement(App, { init: { ...st, settings: { ...st.settings, showTools: off } } }, React.createElement(NavList)), host); await wait(30);
    check(`menu: no Tools while the setting is ${JSON.stringify(off)} (the other items are there)`, !q('li').some(li => /tools/i.test(li.textContent)) && q('li').length === 4);
  }
  const noSave = { ...st, settings: { ...st.settings, savepath: '' } };
  ReactDOM.unmountComponentAtNode(host); ReactDOM.render(React.createElement(App, { init: noSave }, React.createElement(NavList)), host); await wait(30);
  check('menu: no Tools before SSGL has its data folder (like Sourceports)', !q('li').some(li => li.textContent.trim() === 'Tools'));

  // ---- the Tools page -------------------------------------------------------------
  await i18n.changeLanguage('en');
  mount(React.createElement(React.Fragment, null, React.createElement(Tools), React.createElement(Watcher))); await wait(150);
  check('Tools page: a card per tool, the first one is the Upscaler', q('[data-tool]').length === 1 && q('[data-tool]')[0].getAttribute('data-tool') === 'upscaler' && /Upscaler/.test(text()) && !!btn('Open'));
  check('...it says what works now and what comes next (WAD = next step)', /Coming next: pictures inside WAD files/.test(text()));
  check('...the card has the style hook of panels (looks right in every style)', q('[data-tool]')[0].className.indexOf('ssgl-panel') > -1);

  // ---- state: no engine ---------------------------------------------------------------
  Simulate.click(btn('Open')); await wait(150);
  check('Upscaler: no engine -> state "noEngine", the engine folder is shown', state() === 'noEngine' && /C:\\SSGL\\tools\\realesrgan/.test(text()) && /not installed yet/.test(text()));
  check('...buttons "Download the engine" and "Choose the folder myself"', !!btn('Download the engine') && !!btn('Choose the folder myself'));
  check('...the notice "For your own use" and the About part with the licenses', /For your own use\. Upscaled copies of other people's graphics should not be shared\./.test(text()) && /MIT license/.test(text()) && /BSD-3-Clause/.test(text()));
  check('...nothing was downloaded without a click', !calls.some(c => c[0] === 'upscaler/download'));

  // ---- downloading -----------------------------------------------------------------------
  Simulate.click(btn('Download the engine')); await wait(100);
  const dlg = () => document.body.textContent;
  check('download: first an SSGL question window with the address, the size and the license', /Download the engine\?/.test(dlg()) && /https:\/\/github\.com\/xinntao\/Real-ESRGAN\/releases\/download\//.test(dlg()) && /45 MB/.test(dlg()) && /MIT/.test(dlg()));
  check('...and still nothing downloaded', !calls.some(c => c[0] === 'upscaler/download'));
  Simulate.click(Array.from(document.body.querySelectorAll('button')).find(b => b.textContent.trim() === 'Download')); await wait(100);
  check('download: after the click it starts -> state "downloading"', state() === 'downloading' && calls.some(c => c[0] === 'upscaler/download'));
  emit('upscaler/download-progress', { done: 20 * 1024 * 1024, total: 45 * 1024 * 1024 }); await wait(30);
  check('...with a bar and "Downloading: 20 MB of 45 MB" and a Stop button', /Downloading: 20 MB of 45 MB/.test(text()) && !!btn('Stop'));
  downloadDone(); await wait(100);
  check('download done: state "ready", models found, the test run worked', state() === 'ready' && /Ready\. Models found: 3/.test(text()) && /it works on this PC/.test(text()));

  // ---- the source -------------------------------------------------------------------------
  const openDrop = name => { const hidden = q('input').find(i => i.name === name); Simulate.focus(hidden.parentElement.querySelector('input[type=text]')); };
  const pick = async (name, label) => { openDrop(name); await wait(50); Simulate.click(q('li').find(li => li.textContent.trim() === label)); await wait(150); };
  openDrop('upscaleSource'); await wait(50);
  const options = q('li').map(li => li.textContent.trim());
  check('source: the mods of the list (not the maps)', options.indexOf('Test Mod (PK3)') > -1 && options.indexOf('old maps (WAD)') > -1 && !options.some(o => /castle/.test(o)));
  await pick('upscaleSource', 'old maps (WAD)');
  check('a mod with only a WAD: greyed "Not supported yet - coming next" with a short explanation', !!host.querySelector('[data-unsupported="wad"]') && /Not supported yet - coming next/.test(text()) && /Doom's own format inside a WAD/.test(text()));
  check('...Start and Preview stay off', btn('Start').disabled && btn('Make a preview').disabled);
  await pick('upscaleSource', 'Test Mod (PK3)');
  const rows = q('tr[data-group]');
  check('PK3: pictures per kind with checkboxes (textures+floors 150, sprites 300, graphics 12, other 4)', rows.length === 4 && /150 pictures/.test(rows[0].textContent) && /300 pictures/.test(rows[1].textContent) && /12 pictures/.test(rows[2].textContent) && /4 pictures/.test(rows[3].textContent));
  check('sprites are called "Monsters, weapons and items (experimental) - look at the preview first"', /Monsters, weapons and items \(experimental\) - look at the preview first/.test(rows[1].textContent));
  check('"Smaller files (fewer colors)" is there and ON, with a short explanation', (() => { const b = q('button').find(x => x.parentElement && /Smaller files \(fewer colors\)/.test(x.parentElement.textContent) && x.parentElement.textContent.length < 60); return !!b && !!b.querySelector('svg'); })() && /at most 256 colors/.test(text()));
  check('...total pixels shown, "other" is not chosen at first', /Chosen: 462 pictures/.test(text()) && /megapixels/.test(text()));
  check('...the pictures in Doom\'s own format are named as "coming next"', /skipped for now \(coming next\): 7/.test(text()));
  check('...the new name and the 2x note of a 4x-only model', /New mod: Test Mod upscale 2x\.pk3/.test(text()) && /only makes 4x/.test(text()));
  check('...folder for upscales: 8_UPSCALE (new folder)', q('input').find(i => i.name === 'upscaleDest').value === '8_UPSCALE');
  check('...size estimate shown', /Size of the new mod: about 300 MB/.test(text()));
  check('...a preview is suggested', /Try a preview first/.test(text()));
  Simulate.click(q('tr[data-group="other"] button')[0]); await wait(100);
  check('ticking "other" adds it (and a short note)', /Chosen: 466 pictures/.test(text()) && /may not use all of them/.test(text()));
  Simulate.click(q('tr[data-group="other"] button')[0]); await wait(100);

  // ---- preview -----------------------------------------------------------------------------
  Simulate.click(btn('Make a preview')); await wait(150);
  check('preview: the size with fewer colours is shown for the sprite, with the full size for comparison', /Size: 40 kB with fewer colors \(all colors: 120 kB\)/.test(text()) && /Size: 300 kB \(with fewer colors it would be 90 kB\)/.test(text()));
  check('preview: the start sends "smaller files" along', calls.filter(c => c[0] === 'upscaler/preview')[0][1].small === true);
  check('preview: three pictures before/after with a slider -> state "preview"', state() === 'preview' && q('figure[data-sample]').length === 3 && q('figure input[type=range]').length === 3 && /Before/.test(text()) && /After/.test(text()));
  const pv = calls.filter(c => c[0] === 'upscaler/preview');
  check('...made with the chosen model and size', pv[0][1].model === 'realesrgan-x4plus-anime' && pv[0][1].scale === 2 && pv[0][1].kinds.join() === 'texture,flat,sprite,graphic');
  const slider = q('figure input[type=range]')[0];
  Simulate.change(slider, { target: { value: '20' } }); await wait(30);
  check('...the slider moves the line', q('figure .before')[0].style.width === '20%');
  // ---- Look ---------------------------------------------------------------------------------
  check('Look: "Smooth - no visible pixels" by default, explained in plain words', q('input').find(i => i.name === 'upscaleLook').value === 'smooth' && /Like a neural upscale pack/.test(text()));
  check('...the previews use the Look and the model of every kind', pv[0][1].look === 'smooth' && JSON.stringify(pv[0][1].models) === '{}');
  check('...Smooth: monsters, weapons, items and HUD use the drawn-art model, textures the chosen one', /textures realesrgan-x4plus-anime - monsters, weapons, items realesrgan-x4plus-anime - HUD and menus realesrgan-x4plus-anime/.test(text()));

  // ---- Compare models ------------------------------------------------------------------------
  Simulate.click(btn('Compare models')); await wait(50);
  const cmp = calls.filter(c => c[0] === 'upscaler/compare').pop();
  check('Compare models: asks the main part with the mod, the kinds, the size and the Look', cmp && /Test Mod\.pk3$/.test(cmp[1].source) && cmp[1].scale === 2 && cmp[1].look === 'smooth');
  emit('upscaler/compare-progress', { done: 1, total: 3, model: 'realesrgan-x4plus' }); await wait(30);
  check('...while it works: "Comparing models: 2 of 3 (realesrgan-x4plus)..." and Cancel', /Comparing models: 2 of 3 \(realesrgan-x4plus\)/.test(text()) && !!host.querySelector('[data-comparing]'));
  compareDone(); await wait(100);
  check('...then every sample: the original (its pixels shown) and one picture per model, side by side', q('[data-compare-sample]').length === 2 && q('[data-compare-sample="sprite"] [data-compare-cell]').length === 4 && !!host.querySelector('[data-compare-sample="sprite"] [data-compare-cell="original"] img.pixels') && /Original \(pixels shown\)/.test(text()));
  check('...a result that looked wrong says so (and cannot be chosen)', /looked wrong/.test(host.querySelector('[data-compare-sample="sprite"] [data-compare-cell="realesr-animevideov3"]').textContent));
  check('...checkerboard background first, "Dark" can be chosen', q('input').find(i => i.name === 'compareBg').value === 'checker');
  check('...the model in use is marked "Chosen" (sprite: the smooth model)', host.querySelector('[data-compare-sample="sprite"] [data-chosen="yes"]').getAttribute('data-compare-cell') === 'realesrgan-x4plus-anime');
  Simulate.click(host.querySelector('[data-compare-sample="sprite"] [data-compare-cell="realesrgan-x4plus"]')); await wait(50);
  const saved = calls.filter(c => c[0] === 'upscaler/saveSettings').pop()[1];
  check('a click chooses that model for its kind and it is remembered (sprites only)', JSON.stringify(saved.models) === '{"sprite":"realesrgan-x4plus"}' && host.querySelector('[data-compare-sample="sprite"] [data-chosen="yes"]').getAttribute('data-compare-cell') === 'realesrgan-x4plus' && host.querySelector('[data-compare-sample="texture"] [data-chosen="yes"]').getAttribute('data-compare-cell') === 'realesrgan-x4plus-anime');
  check('...the list of models per kind shows the new choice', /monsters, weapons, items realesrgan-x4plus - HUD and menus realesrgan-x4plus-anime/.test(text()));
  Simulate.click(host.querySelector('[data-compare-sample="sprite"] [data-compare-cell="realesr-animevideov3"]')); await wait(30);
  check('...a picture that looked wrong cannot be chosen', host.querySelector('[data-compare-sample="sprite"] [data-chosen="yes"]').getAttribute('data-compare-cell') === 'realesrgan-x4plus');

  // ---- start: big result is asked first ------------------------------------------------------
  estimate = { bytes: 900 * 1024 * 1024, big: true, free: 50 * 1024 * 1024 * 1024 };
  Simulate.click(btn('Start')); await wait(100);
  check('over 500 MB: an SSGL question first ("about 900 MB")', /A big new mod/.test(document.body.textContent) && /900 MB/.test(document.body.textContent) && !calls.some(c => c[0] === 'upscaler/start'));
  Simulate.click(Array.from(document.body.querySelectorAll('button')).find(b => b.textContent.trim() === 'Go on')); await wait(150);
  const started = calls.find(c => c[0] === 'upscaler/start');
  check('..."Go on" starts it with the mod, the size, the model and the folder', started && started[1].look === 'smooth' && started[1].models.sprite === 'realesrgan-x4plus' && started[1].modName === 'Test Mod' && started[1].scale === 2 && started[1].destFolder === '8_UPSCALE' && started[1].small === true && /Test Mod\.pk3$/.test(started[1].source));
  emit('upscaler/progress', { phase: 'running', done: 12, total: 340, eta: 125, current: 'sprites/TROOA1.png', startedAt: 1 }); await wait(30);
  check('running: "Picture 12 of 340", a bar, the time left, Cancel -> state "running"', state() === 'running' && /Picture 12 of 340/.test(text()) && /Time left: about 2:05/.test(text()) && !!btn('Cancel'));
  check('...it says it goes on in the background', /goes on in the background/.test(text()));
  Simulate.click(btn('Cancel')); await wait(30);
  check('Cancel asks the main part to stop the engine', calls.some(c => c[0] === 'upscaler/cancel'));
  emit('upscaler/progress', { phase: 'paused', pausedReason: 'game', done: 12, total: 340, startedAt: 1 }); await wait(30);
  check('a game was started: "Paused while a game runs" + "Go on now", and a short toast', /Paused while a game runs/.test(text()) && !!btn('Go on now') && (global.__toasts || []).some(t => /paused while you play/.test(t[1])));

  // ---- leaving the screen and coming back while it runs ------------------------------------------
  answer = (orig => async (ch, d) => (ch === 'upscaler/state' ? { data: { phase: 'running', done: 50, total: 340, startedAt: 1 }, error: null } : ch === 'upscaler/status' ? { data: { ...status(), job: { phase: 'running', done: 50, total: 340, startedAt: 1 } }, error: null } : orig(ch, d)))(answer);
  mount(React.createElement(React.Fragment, null, React.createElement(Tools), React.createElement(Watcher))); await wait(200);
  check('coming back to Tools while it runs: straight to the Upscaler with the progress', state() === 'running' && /Picture 50 of 340/.test(text()));

  // ---- done -----------------------------------------------------------------------------------------
  const file = 'C:\\Doom\\8_UPSCALE\\Test Mod upscale 2x.pk3';
  emit('upscaler/progress', { phase: 'done', done: 340, total: 340, startedAt: 1, result: { file, bytes: 310 * 1024 * 1024, images: 338, skipped: [{ path: 'a' }, { path: 'b' }], rejected: [{ path: 'sprites/X.png', reason: 'noise' }, { path: 'sprites/Y.png', reason: 'noise' }, { path: 'sprites/Z.png', reason: 'size' }] } }); await wait(100);
  check('done: state "done", what was made, where, "Show in mod list"', state() === 'done' && /The new mod is ready: Test Mod upscale 2x/.test(text()) && /Pictures: 338/.test(text()) && !!btn('Show in mod list'));
  const body = document.body.textContent;
  check('done: "3 pictures were not upscaled because the result looked wrong" (screen and window)', !!host.querySelector('[data-rejected="3"]') && (document.body.textContent.match(/3 pictures were not upscaled because the result looked wrong/g) || []).length >= 2);
  check('done: an SSGL info window (pictures, size, where) and a toast', /The upscale is finished/.test(body) && /Size: 310 MB/.test(body) && /Saved in: C:\\Doom\\8_UPSCALE\\Test Mod upscale 2x\.pk3/.test(body) && /Skipped \(could not be read\): 2/.test(body) && (global.__toasts || []).some(t => /New mod: Test Mod upscale 2x/.test(t[2])));
  const show = Array.from(document.body.querySelectorAll('.ssgl-modal button, button')).filter(b => b.textContent.trim() === 'Show in mod list');
  Simulate.click(show[show.length - 1]); await wait(200);
  check('"Show in mod list": the list is read again, the new mod is ticked, back to the mod list', calls.some(c => c[0] === 'main/init') && latest.package.selected.indexOf('newup') > -1 && window.location.hash === '#/');

  // ---- error ------------------------------------------------------------------------------------------
  window.location.hash = '#/tools';
  mount(React.createElement(Tools)); await wait(150);
  emit('upscaler/progress', { phase: 'error', startedAt: 2, error: { code: 'noVulkan', detail: 'vkCreateInstance failed -9' } }); await wait(50);
  check('error: state "error", a clear reason and the engine\'s own words', state() === 'error' && /does not offer Vulkan/.test(text()) && /vkCreateInstance failed -9/.test(text()));

  // ---- remembered: the Look and the model of every kind come back --------------------------------
  const keep = answer;
  answer = async (ch, d) => (ch === 'upscaler/status' ? { data: { ...status(), settings: { ...status().settings, look: 'sharp', models: { graphic: 'realesr-animevideov3' } }, job: null }, error: null } : ch === 'upscaler/state' ? { data: null, error: null } : keep(ch, d));
  mount(React.createElement(Tools)); await wait(150);
  if (!state()) { Simulate.click(q('[data-tool] button')[0]); await wait(150); }
  check('remembered: Look "Sharp" and the HUD model chosen before', q('input').find(i => i.name === 'upscaleLook').value === 'sharp' && /Keeps more of the original pixels/.test(text()) && /HUD and menus realesr-animevideov3/.test(text()) && /monsters, weapons, items realesrgan-x4plus-anime -/.test(text()));
  answer = keep;

  // ---- four languages: no English left, nothing mirrored --------------------------------------------
  answer = (orig => async (ch, d) => (ch === 'upscaler/status' ? { data: { ...status(), job: null }, error: null } : ch === 'upscaler/state' ? { data: null, error: null } : orig(ch, d)))(answer);
  for (const [lng, word, notice] of [['tr', 'Büyütücü', 'Kendi kullanımınız için'], ['ar', 'المكبّر', 'للاستخدام الشخصي'], ['ru', 'Апскейлер', 'Только для личного использования']]) {
    await i18n.changeLanguage(lng);
    mount(React.createElement(Tools)); await wait(150);
    if (!q('[data-tool]').length) { Simulate.click(q('button[data-back]')[0]); await wait(100); }
    const cardOk = new RegExp(word).test(text());
    Simulate.click(q('[data-tool] button')[0]); await wait(150);
    check(`${lng}: card "${word}", the notice and the screen are translated`, cardOk && new RegExp(notice).test(text()) && !/For your own use|Choose the folder myself|Textures and floors/.test(text()));
    check(`${lng}: nothing is mirrored (no dir="rtl")`, !host.querySelector('[dir="rtl"]'));
  }
  await i18n.changeLanguage('en');
  ReactDOM.unmountComponentAtNode(host);
  process.exit(0);
})().catch(e => { console.log('MISS crashed: ' + (e.stack || e)); process.exit(1); });
