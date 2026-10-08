const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/#/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
global.localStorage = dom.window.localStorage; global.HTMLElement = dom.window.HTMLElement;
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
    ipcRenderer: { send: (...a) => (global.__sent = global.__sent || []).push(a), invoke: async () => ({ data: null }), on() {}, removeListener() {} }
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

(async () => {
  const PackageAreaNew = require(APP + '/client/components/PackageAreaNew').default;
  const UnsavedGuard = require(APP + '/client/components/UnsavedGuard.jsx').default;
  const ReactDOM = require(APP + '/node_modules/react-dom');
  const packages = [{ id: 'p1', name: 'Brutal run', selected: ['a', 'b'], cover: { isFile: false, use: 'doom2' }, iwad: '', sourceport: '' }];
  const mkState = (pack, extra = {}) => ({ ...st, packages, package: { ...st.package, ...pack, cover: { isFile: false, use: 'doom2' } }, ...extra });
  const host0 = document.createElement('div'); document.body.appendChild(host0);
  const wait0 = ms => new Promise(r => setTimeout(r, ms));
  const shown = async state => {
    ReactDOM.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: state, dispatch() {} } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(PackageAreaNew))))), host0);
    await wait0(40);
    return host0.querySelector('input').value;   // the text of the closed dropdown
  };
  let label = await shown(mkState({ id: 'p1', name: 'Brutal run', selected: ['a', 'b'] }));
  check('package bar: saved package -> "' + label + '" (no dot)', label === 'Brutal run');
  label = await shown(mkState({ id: 'p1', name: 'Brutal run', selected: ['b', 'a'] }));
  check('package bar: order changed -> "' + label + '" (dot appears on the SAME package)', label === 'Brutal run •');
  label = await shown(mkState({ id: 'p1', name: 'Brutal run', selected: ['a', 'b'] }));
  check('package bar: saved again -> dot goes away again ("' + label + '")', label === 'Brutal run');
  label = await shown(mkState({ id: 'p1', name: 'Brutal run', selected: ['a'] }));
  check('package bar: mod removed -> dot', label === 'Brutal run •');
  label = await shown(mkState({ id: null, name: '', selected: ['a'] }));
  check('package bar: load order without package -> "' + label + '"', label === 'No Package •');
  label = await shown(mkState({ id: null, name: '', selected: [] }));
  check('package bar: empty -> "' + label + '" (no dot)', label === 'No Package');
  await i18n.changeLanguage('ru');
  label = await shown(mkState({ id: 'p1', name: 'Brutal run', selected: ['a'] }));
  check('package bar (ru): dot works in every language', label === 'Brutal run •');
  await i18n.changeLanguage('en');
  ReactDOM.unmountComponentAtNode(host0);

  // the guard: tells the main process, shows the "restored" notice once
  const toasts = []; const dispatched = []; global.__sent = [];
  const host = document.createElement('div'); document.body.appendChild(host);
  const mount = state => ReactDOM.render(React.createElement(StoreContext.Provider, { value: { gstate: state, dispatch: a => dispatched.push(a) } }, React.createElement(ToastContext.Provider, { value: { addToast: (...a) => toasts.push(a), toasts: [] } }, React.createElement(UnsavedGuard))), host);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  mount(mkState({ id: 'p1', name: 'Brutal run', selected: ['a', 'b'] })); await wait(30);
  let last = global.__sent[global.__sent.length - 1];
  check('guard: saved -> main process told "not dirty"', last[0] === 'app/dirty' && last[1].dirty === false);
  mount(mkState({ id: 'p1', name: 'Brutal run', selected: ['a'] })); await wait(30);
  last = global.__sent[global.__sent.length - 1];
  check('guard: edited -> main process told "dirty"', last[1].dirty === true);
  mount(mkState({ id: 'p1', name: 'Brutal run', selected: ['a'] }, { recovered: ['packages'] })); await wait(30);
  check('guard: restored file -> one error message naming the file', toasts.length === 1 && toasts[0][0] === 'danger' && /packages\.json was damaged/.test(toasts[0][2]));
  check('guard: notice is cleared afterwards', dispatched.some(a => a.type === 'recovered/clear'));
  mount(mkState({ id: 'p1', name: 'Brutal run', selected: ['a'] }, { recovered: ['packages'] })); await wait(30);
  check('guard: same notice is not shown twice', toasts.length === 1);
  await i18n.changeLanguage('ar');
  mount(mkState({ id: 'p1', name: 'Brutal run', selected: ['a', 'b', 'c'] }, { recovered: [] })); await wait(30);
  last = global.__sent[global.__sent.length - 1];
  check('guard (ar): still reports dirty', last[1].dirty === true);
  process.exit(0);
})();
