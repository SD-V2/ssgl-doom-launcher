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
    remote: { Menu: { buildFromTemplate: t => { global.__menu = t; return { popup() {} }; } }, shell: { showItemInFolder() {}, moveItemToTrash: () => true }, dialog: { showMessageBox: async () => ({ response: 0 }) }, app: { getVersion: () => '1.0.0' }, getCurrentWindow: () => ({}) },
    ipcRenderer: { send: (...a) => (global.__sent = global.__sent || []).push(a), invoke: require('./native-mock').wrap(async (ch, d) => (global.__invoke ? global.__invoke(ch, d) : { data: null })), sendSync: require('./native-mock').sendSync, on() {}, removeListener() {} }
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

const { reducer } = require(APP + '/client/state/reducer.js');
const { DialogProvider } = require(APP + '/client/components/Dialog');
(async () => {
  // a tall screen for the virtual list of the mod list
  window.HTMLElement.prototype.getBoundingClientRect = function () { return { height: 1500, width: 800, top: 0, left: 0, right: 800, bottom: 1500, x: 0, y: 0 }; };
  const MB = 1024 * 1024;
  const mk = (id, name, folders, extra = {}) => ({ id, name, kind: 'PK3', size: '1 MB', bytes: MB, created: 1000, path: 'C:\\Doom\\' + name + '.pk3', folders, folder: folders[0] || '', tags: folders.map(f => f.toLowerCase()), lastdir: 'x', active: false, ...extra });
  const mods = [mk('lib', 'gutamatics', ['0_LIBS']), mk('bp', 'project brutality', ['1_BP']), mk('mon1', 'extra monsters', ['3_MONSTERS']), mk('mon2', 'more monsters', ['3_MONSTERS']), mk('wep', 'more guns', ['5_WEAPONS']), mk('hud', 'hud pack', ['7_VISUAL']), mk('odd', 'litdoom core', ['litdoom']), mk('odd2', 'litdoom shaders', ['litdoom']), mk('map:m1', 'castle', ['Ep1'], { isMap: true })];
  global.__invoke = async ch => ({ error: null, data: ch === 'mods/conflicts' ? { checked: 0, skipped: [], conflicts: [] } : null });
  const dataTransfer = () => { const store = {}; return { types: [], effectAllowed: '', dropEffect: '', setData(k, v) { store[k] = v; if (this.types.indexOf(k) < 0) this.types.push(k); }, getData(k) { return store[k] || ''; }, files: [] }; };
  let latest = null;
  const Stateful = ({ init }) => { const [g, d] = React.useReducer(reducer, init); latest = g; return React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: g, dispatch: d } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(DialogProvider, null, React.createElement(Wads))))));
  };
  const host = document.createElement('div'); document.body.appendChild(host);
  const mount = (selected, extra = {}) => { ReactDOM.unmountComponentAtNode(host); const init = { ...st, ...extra, mods: mods.map(m => ({ ...m, active: selected.indexOf(m.id) > -1 })), folders: [['0_LIBS'], ['1_BP'], ['3_MONSTERS'], ['5_WEAPONS'], ['7_VISUAL'], ['litdoom']], mapFolders: [], package: { ...st.package, id: null, selected }, packages: [], settings: { ...st.settings, modpath: 'C:\\Doom', mappath: '' } }; ReactDOM.render(React.createElement(Stateful, { init }), host); };
  const text = () => document.body.textContent;
  const q = sel => Array.from(document.body.querySelectorAll(sel));
  const tab = name => q('button').find(b => b.textContent.trim().toLowerCase() === name);
  const btn = label => q('button').find(b => b.textContent.trim().toLowerCase() === label.toLowerCase());
  const order = () => latest.package.selected.join(',');
  const rightPanel = () => tab('list').closest('.fixed').parentElement;
  const rq = sel => Array.from(rightPanel().querySelectorAll(sel));
  const itemEl = name => rq('h1').find(h => h.textContent.trim().toLowerCase() === name).closest('[draggable=true]');
  const frameEl = title => q('li').find(li => li.firstChild && li.firstChild.textContent && new RegExp(title, 'i').test(li.firstChild.textContent) && li.querySelector('ul') && /Nothing here yet|\.pk3|PK3/.test(li.textContent) && li.textContent.indexOf('·') > -1 && !li.closest('li[draggable]') && li.textContent.length < 600 && li.children.length >= 3);


  const boxOf = title => rq('li').filter(li => li.querySelector('h2') && new RegExp('^' + title, 'i').test(li.querySelector('h2').textContent.trim()))[0];
  const titles = () => rq('li h2').map(h => h.textContent.trim());
  const arrow = (title, which) => boxOf(title).querySelector('.arrows > span:' + (which === 'up' ? 'first-child' : 'last-child') + ' > div > div');
  const isOff = (title, which) => boxOf(title).querySelector('.arrows > span:' + (which === 'up' ? 'first-child' : 'last-child')).className === 'off';

  localStorage.clear();
  mount(['lib', 'bp', 'mon1', 'mon2', 'wep'], { sectionMode: true }); await wait(600);
  check('titles with the numbers in the usual order (0 Libraries, 1 Main mod, 2 Monsters ...)', titles().slice(0, 4).join('|') === '0 · Libraries|1 · Main mod|2 · Monsters|3 · Glory kills');
  check('Maps box has no arrows (without a maps folder it is not shown at all)', !titles().some(x => /Maps/.test(x)));
  check('the first box cannot go up, the last one (Patches) cannot go down', isOff('0 · Libraries', 'up') && !isOff('0 · Libraries', 'down') && isOff('10 · Patches', 'down') && !isOff('10 · Patches', 'up'));
  check('no "default order" link while the order is the usual one', !q('a').some(a => a.textContent.trim() === 'Default section order'));

  Simulate.click(arrow('2 · Monsters', 'up')); await wait(300);
  check('Monsters one place UP: it is box 1 now and Main mod is 2 (the numbers follow)', titles().slice(0, 3).join('|') === '0 · Libraries|1 · Monsters|2 · Main mod');
  check('...the mods of the sections followed (monsters mods now before main)', latest.package.selected.join() === 'lib,mon1,mon2,bp,wep');
  check('...the order is saved in the rules', latest.sectionRules.order.slice(0, 3).join() === 'libraries,monsters,main');
  check('...the link "Default section order" shows up', q('a').some(a => a.textContent.trim() === 'Default section order'));
  Simulate.click(arrow('1 · Monsters', 'up')); await wait(300);
  check('...up again: Monsters is box 0 and its mods load first', titles()[0] === '0 · Monsters' && latest.package.selected.join() === 'mon1,mon2,lib,bp,wep');
  check('...and now it cannot go up any more', isOff('0 · Monsters', 'up'));
  Simulate.click(arrow('0 · Monsters', 'down')); await wait(300);
  check('DOWN works the same way', titles().slice(0, 3).join('|') === '0 · Libraries|1 · Monsters|2 · Main mod');
  const gloryNumber = titles().find(x => /Glory/.test(x));
  check('the numbers of the other boxes stay in a row (glory is 3)', gloryNumber === '3 · Glory kills');

  // ---- right click menu uses the new numbers
  localStorage.setItem('ssgl.sort', 'folder'); localStorage.setItem('ssgl.openFolders', '[]'); global.__menu = null;
  window.HTMLElement.prototype.getBoundingClientRect = function () { return { height: 1500, width: 800, top: 0, left: 0, right: 800, bottom: 1500, x: 0, y: 0 }; };
  // the folder view is chosen when the screen starts: start again with the moved order
  const movedRules = { folders: {}, mods: {}, order: ['libraries', 'monsters', 'main', 'glory', 'weapons', 'gameplay', 'sounds', 'music', 'textures', 'visual', 'other', 'patches', 'maps'] };
  mount(['lib', 'bp', 'mon1', 'mon2', 'wep'], { sectionMode: true, sectionRules: movedRules }); await wait(600);
  const folderRow = name => q('h2').find(x => x.textContent.trim().toLowerCase() === name).parentElement;
  Simulate.contextMenu(folderRow('litdoom'), {}); await wait(100);
  const labels = ((global.__menu || []).find(i => i.label === 'Section') || { submenu: [] }).submenu.map(i => i.label).filter(Boolean);
  check('the folder menu lists the sections with the CURRENT numbers (0 Libraries, 1 Monsters, 2 Main mod ...)', labels.slice(1, 4).join('|') === '0 · Libraries|1 · Monsters|2 · Main mod' && labels.includes('Other') && labels.length === 13);

  // ---- reset
  Simulate.click(q('a').find(a => a.textContent.trim() === 'Default section order')); await wait(300);
  check('"Default section order": everything is back (numbers and load order)', titles().slice(0, 3).join('|') === '0 · Libraries|1 · Main mod|2 · Monsters' && latest.package.selected.join() === 'lib,bp,mon1,mon2,wep');
  check('...and the link is gone again', !q('a').some(a => a.textContent.trim() === 'Default section order'));

  // ---- a custom order is remembered through the rules (saved by the app)
  mount(['lib', 'bp'], { sectionMode: true, sectionRules: { folders: {}, mods: {}, order: ['main', 'libraries', 'weapons', 'monsters', 'glory', 'gameplay', 'sounds', 'music', 'textures', 'visual', 'other', 'patches', 'maps'] } }); await wait(600);
  check('a saved order shows at once: 0 · Main mod, 1 · Libraries, 2 · Weapons', titles().slice(0, 3).join('|') === '0 · Main mod|1 · Libraries|2 · Weapons');

  // ---- maps box: no arrows (maps folder set)
  ReactDOM.unmountComponentAtNode(host); const mapState = { ...st, mods: mods.map(m => ({ ...m, active: true })), folders: [], mapFolders: [], package: { ...st.package, id: null, selected: ['bp', 'map:m1'] }, packages: [], sectionMode: true, settings: { ...st.settings, modpath: 'C:\\Doom', mappath: 'C:\\Doom\\Maps' } }; ReactDOM.render(React.createElement(Stateful, { init: mapState }), host); await wait(600);
  check('with a maps folder the Maps box is there as the LAST box and has no arrows', titles().slice(-1)[0] === '11 · Maps' && boxOf('11 · Maps').querySelector('.arrows') === null && isOff('10 · Patches', 'down'));
  process.exit(0);
})();
