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
    remote: { shell: { showItemInFolder() {}, moveItemToTrash: p => { (global.__trashed = global.__trashed || []).push(p); return true; } }, dialog: { showMessageBox: async () => ({ response: 0 }) }, app: { getVersion: () => '1.0.0' }, getCurrentWindow: () => ({}) },
    ipcRenderer: { send: (...a) => (global.__sent = global.__sent || []).push(a), invoke: require('./native-mock').wrap(async (ch, d) => (global.__invoke ? global.__invoke(ch, d) : { data: null })), sendSync: require('./native-mock').sendSync, on: (n, f) => { (global.__on = global.__on || {})[n] = f; }, removeListener() {}, send: (...a) => (global.__sent = global.__sent || []).push(a) }
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

(async () => {
  const { DialogProvider } = require(APP + '/client/components/Dialog');
  const UnsavedGuard = require(APP + '/client/components/UnsavedGuard.jsx').default;
  const PackageAreaNew = require(APP + '/client/components/PackageAreaNew').default;
  const PackageTransfer = require(APP + '/client/components/PackageTransfer.jsx').default;
  const host = document.createElement('div'); document.body.appendChild(host);
  const text = () => document.body.textContent;
  const q = sel => Array.from(document.body.querySelectorAll(sel));
  const btn = label => q('button').find(b => b.textContent.trim().toLowerCase() === label.toLowerCase());
  const dispatched = [];
  const mkState = (selected, extra = {}) => ({ ...st, packages: [{ id: 'p1', name: 'Brutal run', selected: ['a', 'b'], cover: { isFile: false, use: 'doom2' } }], mods: [{ id: 'a', name: 'a', kind: 'PK3', size: '1 MB', bytes: 1, path: 'C:\\m\\a.pk3', tags: [], folders: [], active: true }, { id: 'b', name: 'b', kind: 'PK3', size: '1 MB', bytes: 1, path: 'C:\\m\\b.pk3', tags: [], folders: [], active: true }], package: { ...st.package, id: 'p1', name: 'Brutal run', selected, cover: { isFile: false, use: 'doom2' } }, ...extra });
  const mount = (state, ...kids) => ReactDOM.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: state, dispatch: a => dispatched.push(a) } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(DialogProvider, null, ...kids))))), host);

  // ---- (a) closing SSGL with unsaved changes
  global.__sent = []; mount(mkState(['a']), React.createElement(UnsavedGuard)); await wait(100);
  check('guard registered for the close request', typeof global.__on['app/close-request'] === 'function');
  global.__on['app/close-request'](); global.__on['app/close-request'](); await wait(150);
  check('close request -> SSGL-style question (not a Windows box)', text().includes('Unsaved changes') && text().includes('Close SSGL without saving the changes of your load order?') && btn('Close without saving') && btn('Cancel'));
  check('...asked only once even if the request came twice', q('button').filter(b => b.textContent.trim() === 'Cancel').length === 1);
  Simulate.click(btn('Cancel')); await wait(100);
  check('"Cancel" -> SSGL stays open (nothing sent to the main process)', !global.__sent.some(m => m[0] === 'app/close-confirmed'));
  global.__on['app/close-request'](); await wait(150); Simulate.click(btn('Close without saving')); await wait(100);
  check('"Close without saving" -> main process told to close for real', global.__sent.some(m => m[0] === 'app/close-confirmed'));
  ReactDOM.unmountComponentAtNode(host);

  // ---- (b) package bar: reset with unsaved changes
  dispatched.length = 0; mount(mkState(['a']), React.createElement(PackageAreaNew)); await wait(100);
  const bar = () => Array.from(host.querySelectorAll('button')).filter(b => !b.closest('[class*=Dialog]'));
  const trash = () => { const bs = Array.from(host.querySelectorAll('button')); return bs[bs.length - 1]; };
  Simulate.click(trash()); await wait(150);
  check('trash button with unsaved changes -> SSGL-style question', text().includes('Your load order has changes that are not saved.') && btn('Discard changes'));
  Simulate.click(btn('Cancel')); await wait(100);
  check('...Cancel: load order untouched', !dispatched.some(a => a.type === 'packages/reset'));
  Simulate.click(trash()); await wait(150); Simulate.click(btn('Discard changes')); await wait(100);
  check('...Discard changes: load order is reset', dispatched.some(a => a.type === 'packages/reset'));
  ReactDOM.unmountComponentAtNode(host);
  dispatched.length = 0; mount(mkState(['a', 'b']), React.createElement(PackageAreaNew)); await wait(100);
  const bs = Array.from(host.querySelectorAll('button')); Simulate.click(bs[bs.length - 1]); await wait(150);
  check('nothing unsaved -> no question, reset happens at once', !btn('Discard changes') && dispatched.some(a => a.type === 'packages/reset'));
  ReactDOM.unmountComponentAtNode(host);

  // ---- (c) delete a mod
  const Wads = require(APP + '/client/views/Wads.jsx').default;
  global.__invoke = async ch => ({ error: null, data: ch === 'main/init' ? { mods: [], iwads: [], folders: [], mapFolders: [], duplicates: [], versions: [] } : null });
  global.__trashed = [];
  const wstate = { ...mkState([]), settings: { ...st.settings, modpath: 'C:\\m' } };
  mount(wstate, React.createElement(Wads)); await wait(500);
  const del = () => q('button[title="Move to Recycle Bin"]')[0];
  Simulate.click(del()); await wait(150);
  check('delete a mod -> SSGL-style question with the name, the path and a red button', text().includes('Move "a" to the Recycle Bin?') && text().includes('C:\\m\\a.pk3') && btn('Move to Recycle Bin') && btn('Cancel'));
  Simulate.click(btn('Cancel')); await wait(100);
  check('...Cancel: file untouched', global.__trashed.length === 0);
  Simulate.click(del()); await wait(150); Simulate.click(btn('Move to Recycle Bin')); await wait(300);
  check('...confirm: file goes to the Recycle Bin', global.__trashed.join() === 'C:\\m\\a.pk3');
  ReactDOM.unmountComponentAtNode(host);

  // ---- (d) import report
  global.__invoke = async ch => (ch === 'packages/import' ? { error: null, data: { canceled: false, packages: [], imported: [{ name: 'Pack', selected: ['x1'], modNames: { x1: 'lost mod.pk3' } }], notes: [{ code: 'iwad', pack: 'Pack', wanted: 'doom2.wad' }] } } : { data: null });
  mount(mkState([]), React.createElement(PackageTransfer)); await wait(100);
  await global.__on['menu/import'](); await wait(200);
  check('import report is an SSGL-style window with the notes and the missing mods', text().includes('Imported 1 package') && text().includes('Pack: IWAD "doom2.wad" not found') && text().includes('lost mod.pk3  (Pack)') && btn('OK'));
  Simulate.click(btn('OK')); await wait(100);
  check('...closes with OK', !text().includes('lost mod.pk3  (Pack)'));
  process.exit(0);
})();
