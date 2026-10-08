const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/#/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
global.localStorage = dom.window.localStorage; global.HTMLElement = dom.window.HTMLElement; ['Element','Node','SVGElement','Event','MouseEvent','KeyboardEvent','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','MutationObserver'].forEach(k => { if (dom.window[k] !== undefined && global[k] === undefined) global[k] = dom.window[k]; });
const Module = require('module');
const path = require('path');
const APP = (require('./paths').APP + '');
const origResolve = Module._resolveFilename;
const origReq = Module.prototype.require;
const sent = [];
Module.prototype.require = function (req) {
  if (req === 'electron') return {
    ipcRenderer: { send: (...a) => (global.__sent = global.__sent || []).push(a), on() {}, removeListener() {}, invoke: async () => ({}) },
    remote: { shell: { showItemInFolder() {}, moveItemToTrash: () => true }, dialog: { showMessageBox: async () => ({ response: 0 }) }, app: { getVersion: () => '1.0.0' }, getCurrentWindow: () => ({}) },
    ipcRenderer: { send: (...a) => (global.__sent = global.__sent || []).push(a), invoke: async (ch, d) => (global.__invoke ? global.__invoke(ch, d) : { data: null }), on() {}, removeListener() {} }
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
require(APP + '/node_modules/react-dom').createPortal = c => c;
const { renderToString } = require(APP + '/node_modules/react-dom/server');
const { ThemeProvider } = require(APP + '/node_modules/styled-components');
const themes = require(APP + '/client/Theme/index.jsx').default;
const { StoreContext, initState } = require(APP + '/client/state');
const Wads = require(APP + '/client/views/Wads.jsx').default;
const ToastContext = require(APP + '/client/components/Toast/ToastContext.jsx').default;
const AudioProvider = require(APP + '/client/components/Audio').default;
require(APP + '/client/i18n');

const mk = (name, folders, bytes, extra = {}) => ({ id: name + bytes, name, kind: 'PK3', ext: 'PK3', size: `${bytes} B`, bytes, path: `/w/${folders.join('/')}/${name}.pk3`, folders, folder: folders[0] || '', tags: folders.map(f => f.toLowerCase()), lastdir: 'x', created: 1, active: false, ...extra });
const mods = [mk('brutal', ['1_BP'], 5000, { active: true }), mk('sub1', ['1_BP', 'A'], 3000), mk('glory', ['2_GK'], 2000), mk('root', [], 1000)];
const state = { ...initState, mods,
  duplicates: [{ id: 'd', name: 'dup', kind: 'PK3', size: '5 B', paths: ['/w/a/dup.pk3', '/w/b/dup.pk3'] }],
  versions: [{ name: 'ver', kind: 'WAD', items: [{ id: 'v1', path: '/w/a/ver.wad', size: '1 kB' }, { id: 'v2', path: '/w/b/ver.wad', size: '2 kB' }] }],
  package: { ...initState.package, id: 'p1', name: 'Pack', selected: ['brutal5000', 'gone1'], notes: 'Load brutal first!' },
  settings: { ...initState.settings, modpath: '/w' } };


const i18n = require(APP + '/client/i18n.jsx').default;
const { ServerStyleSheet } = require(APP + '/node_modules/styled-components');
const Components = require(APP + '/client/components');
const MB = 1024 * 1024;
const st = { ...state, folders: [], settings: { ...state.settings, importFolder: '' } };
const wrap = el => React.createElement(ThemeProvider, { theme: themes.hell },
  React.createElement(StoreContext.Provider, { value: { gstate: st, dispatch() {} } },
    React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, el))));
const out = [];
const check = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);


const { explainError } = require(APP + '/client/utils');
const codes = ['E_NO_WADDIR','E_OUTSIDE','E_PARENT_MISSING','E_FOLDER_EXISTS','E_PICK_FOLDER','E_FOLDER_MISSING','E_SAME_NAME','E_NOT_EMPTY','E_FS_DENIED','E_NAME_EMPTY','E_NAME_LONG','E_NAME_CHARS','E_NAME_END','E_NO_PACKAGES','E_FILE_UNREADABLE','E_NOT_PACKAGES_FILE','E_ADD_SOURCEPORT','E_NO_SAVEPATH','E_EMPTY_PACKAGES_FILE'];
const { AppError, toPayload } = require(APP + '/electron/utils/errors.js');


const ReactDOM = require(APP + '/node_modules/react-dom');
const { Simulate } = require(APP + '/node_modules/react-dom/test-utils');
global.__BUILD_TIME__ = '2026-10-07T09:30:00.000Z';
const wait = ms => new Promise(r => setTimeout(r, ms));

const ReactDOM2 = require(APP + '/node_modules/react-dom');
// Switching tabs (Mods, Packages, Sourceports, Settings): the screen comes in with a short,
// quick slide + fade; rows already there do not fade one by one.
(async () => {
  window.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {} });
  const AV = require(APP + '/client/views/AnimatedView.jsx');
  const { order } = require(APP + '/client/routes.js');

  // ---- the screen animation
  const fwd = AV.viewAnimation('/packages', '/');
  const back = AV.viewAnimation('/', '/settings');
  check('a short slide (at most 60 px, was 600 px)', Math.abs(fwd.initial.x) > 0 && Math.abs(fwd.initial.x) <= 60);
  check('...quick (at most 0.25 s) and with a fast-start, soft-landing curve', fwd.transition.duration > 0 && fwd.transition.duration <= 0.25 && Array.isArray(fwd.transition.ease));
  check('...with a fade from nothing to full', fwd.initial.opacity === 0 && fwd.animate.opacity === 1 && fwd.animate.x === 0);
  check('going to a tab further right comes from the right, going back left comes from the left', fwd.initial.x > 0 && back.initial.x < 0);
  check('the same tab again (or a start without a last tab) comes from the right', AV.viewAnimation('/', '/').initial.x > 0 && order.length >= 4);
  window.matchMedia = q => ({ matches: /reduce/.test(q), media: q, addListener() {}, removeListener() {} });
  const calm = AV.viewAnimation('/packages', '/');
  check('the system asks for less motion: only a quick fade, no slide', calm.initial.x === undefined && calm.initial.opacity === 0 && calm.transition.duration <= 0.15);
  window.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {} });

  // ---- the screen in the page (first picture drawn = the start of the animation)
  const { renderToString } = require(APP + '/node_modules/react-dom/server');
  window.location.hash = '#/packages';
  const html = renderToString(React.createElement(AV.default, null, React.createElement('p', null, 'hello')));
  check('a screen starts slightly to the side and see-through (then slides in)', /translateX\(36px\)/.test(html) && /opacity:0/.test(html) && /hello/.test(html));

  // ---- rows already on screen do not fade one by one
  const ModItem = require(APP + '/client/components/Mods/ModItem.jsx').default;
  const wrapT = el => React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: st, dispatch() {} } }, el));
  const item = { id: 'a', name: 'brutal', kind: 'PK3', size: '1 MB', active: false, path: 'C:\\m\\brutal.pk3', folders: [], tags: [] };
  const rowOf = props => renderToString(wrapT(React.createElement('ul', null, React.createElement(ModItem, { item, onSelect() {}, ...props }))));
  check('a row in the big mod list shows at once (no fade, it scrolls in and out all the time)', !/opacity:0/.test(rowOf({ fadeIn: false })));
  check('...a row elsewhere (load order) still fades in when it is added', /opacity:0/.test(rowOf({})));
  const fs = require('fs');
  for (const f of ['views/Packages/index.jsx', 'views/Sourceports/index.jsx', 'views/Wads.jsx']) {
    const src = fs.readFileSync(path.join(APP, 'client', f), 'utf8');
    const all = src.match(/<AnimatePresence[^>]*>/g) || [];
    check(f + ': the rows that are there when the tab opens come with the screen (no row-by-row fade)', all.length > 0 && all.every(t => /initial=\{false\}/.test(t)));
  }
  const box = fs.readFileSync(path.join(APP, 'client/components/Mods/ModBox.jsx'), 'utf8');
  check('ModBox (the big mod list) asks its rows not to fade', /fadeIn=\{false\}/.test(box));
  process.exit(0);
})();
