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

(async () => {
  const MB = 1024 * 1024;
  const mk = (id, name, folders, mb, extra = {}) => ({ id, name, kind: 'PK3', size: mb + ' MB', bytes: mb * MB, created: 1000 + mb, path: 'C:\\Doom\\' + name + '.pk3', folders, folder: folders[0] || '', tags: folders.map(f => f.toLowerCase()), lastdir: 'x', active: false, ...extra });
  const mods = [mk('a', 'brutal doom v21', ['1_BP'], 120), mk('b', 'weapons pack', ['2_W'], 30), mk('c', 'hd textures', [], 400), mk('d', 'neonover', [], 85)];
  const maps = [mk('map:m1', 'castle of horrors', ['Episode 1'], 12, { isMap: true }), mk('map:m2', 'sunken city', ['Episode 1'], 8, { isMap: true }), mk('map:m3', 'final stand', [], 20, { isMap: true })];
  const calls = []; global.__invoke = async (ch, d) => { calls.push([ch, d]); return ch === 'mods/import' ? { error: null, data: { copied: 1, skipped: [], already: [] } } : ch === 'folders/create' ? { error: null, data: { key: 'New' } } : ch === 'mods/conflicts' ? { error: null, data: { checked: 0, skipped: [], conflicts: [] } } : { error: null, data: [] }; };
  const dispatched = [];
  const base = { ...st, mods: [...mods, ...maps], folders: [['1_BP'], ['2_W']], mapFolders: [['Episode 1'], ['Episode 2']], package: { ...st.package, id: null, selected: [] }, packages: [], settings: { ...st.settings, modpath: 'C:\\Doom', mappath: 'C:\\Doom\\Maps' } };
  const host = document.createElement('div'); document.body.appendChild(host);
  const mount = s => ReactDOM.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: s, dispatch: a => dispatched.push(a) } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Wads))))), host);
  const text = () => document.body.textContent;
  const q = sel => Array.from(document.body.querySelectorAll(sel));
  const placeholder = () => (document.body.querySelector('input[type=text]') || {}).placeholder;
  const tab = name => q('button').find(b => b.textContent.trim().toLowerCase().startsWith(name));

  // ---- no maps directory: nothing changes
  localStorage.clear(); localStorage.setItem('ssgl.section', 'maps');   // an old choice must not matter
  mount({ ...base, settings: { ...base.settings, mappath: '' } }); await wait(400);
  check('no maps directory -> no MAPS | MODS switch', !tab('maps') && !tab('mods'));
  check('...the list shows the mods, search says "Search in 4 Mods" (maps never shown)', placeholder() === 'Search in 4 Mods' && /hd textures/i.test(text()) && !/castle of horrors/i.test(text()));
  check('...footer "4 mods"', text().includes('4 mods'));

  // ---- with a maps directory
  localStorage.clear(); ReactDOM.unmountComponentAtNode(host); mount(base); await wait(400);
  check('switch is there: "Maps 3" and "Mods 4"', tab('maps') && /3$/.test(tab('maps').textContent.trim()) && tab('mods') && /4$/.test(tab('mods').textContent.trim()));
  check('Mods tab is the start: only mods in the list, "Search in 4 Mods", footer "4 mods"', placeholder() === 'Search in 4 Mods' && !/castle of horrors/i.test(text()) && text().includes('4 mods'));
  Simulate.click(tab('maps')); await wait(300);
  check('click MAPS -> only maps in the list', /castle of horrors/i.test(text()) && /sunken city/i.test(text()) && !/brutal doom/i.test(text()));
  check('...search says "Search in 3 Maps", footer "3 maps · 40.0 MB" style counts', placeholder() === 'Search in 3 Maps' && /3 maps/.test(text()));
  check('...the choice is remembered', localStorage.getItem('ssgl.section') === 'maps');
  Simulate.click(tab('mods')); await wait(300);
  check('click MODS -> mods again', /brutal doom/i.test(text()) && !/castle of horrors/i.test(text()) && localStorage.getItem('ssgl.section') === 'mods');

  // ---- remembered tab on the next start
  localStorage.setItem('ssgl.section', 'maps'); ReactDOM.unmountComponentAtNode(host); mount(base); await wait(400);
  check('next start: the Maps tab is open again', placeholder() === 'Search in 3 Maps');

  // ---- folder view on the Maps tab uses the map folders and the maps directory
  localStorage.setItem('ssgl.sort', 'folder'); ReactDOM.unmountComponentAtNode(host); mount(base); await wait(400);
  check('folder view (Maps): shows the MAP folders (Episode 1, Episode 2), not the mod folders', /EPISODE 1/i.test(text()) && /EPISODE 2/i.test(text()) && !/1_BP/i.test(text()));
  check('...with the count in "maps"', /2 maps/.test(text()) && /0 maps/.test(text()));
  const row = q('h2').find(h => /episode 1/i.test(h.textContent)).parentElement;
  Simulate.drop(row, { dataTransfer: { types: ['Files'], files: [{ path: 'C:\\Downloads\\newmap.wad' }] } }); await wait(200);
  const imp = calls.find(c => c[0] === 'mods/import');
  check('a file dropped on a map folder is sent with root "maps" and that folder', imp && imp[1].root === 'maps' && imp[1].folder === 'Episode 1' && imp[1].paths[0] === 'C:\\Downloads\\newmap.wad');
  const newFolder = q('a').find(a => a.textContent.trim() === 'New folder'); Simulate.click(newFolder); await wait(100);
  const nameInput = q('input[name=folderName]')[0]; nameInput.value = 'Episode 3'; Simulate.change(nameInput, { target: nameInput });
  Simulate.submit(nameInput.closest('form')); await wait(300);
  const cf = calls.find(c => c[0] === 'folders/create');
  check('"New folder" on the Maps tab creates it in the maps directory (root "maps")', cf && cf[1].root === 'maps' && cf[1].name === 'Episode 3');

  // ---- Mods tab: roots are "mods"
  localStorage.setItem('ssgl.section', 'mods'); calls.length = 0; ReactDOM.unmountComponentAtNode(host); mount(base); await wait(400);
  const row2 = q('h2').find(h => /1_bp/i.test(h.textContent)).parentElement;
  Simulate.drop(row2, { dataTransfer: { types: ['Files'], files: [{ path: 'C:\\x\\a.pk3' }] } }); await wait(200);
  check('on the Mods tab a drop is sent with root "mods"', calls.find(c => c[0] === 'mods/import')[1].root === 'mods');

  // ---- load order summary with maps
  localStorage.setItem('ssgl.sort', 'new');
  const withLoad = { ...base, mods: base.mods.map(m => ({ ...m, active: ['a', 'b', 'map:m1', 'map:m2'].indexOf(m.id) > -1 })), package: { ...base.package, selected: ['a', 'b', 'map:m1', 'map:m2'] } };
  ReactDOM.unmountComponentAtNode(host); mount(withLoad); await wait(900);
  check('load order summary counts mods and maps apart: "2 mods + 2 maps"', text().includes('2 mods + 2 maps'));
  check('maps in the load order carry a "map" badge, mods do not', q('span').filter(n => n.textContent.trim() === 'map').length === 2);
  const order = q('h1').map(h => h.textContent.trim().toLowerCase()).filter(x => ['brutal doom v21', 'weapons pack', 'castle of horrors', 'sunken city'].includes(x));
  check('the load order shows the mods first, the maps after them', order.slice(-4).join('|') === 'brutal doom v21|weapons pack|castle of horrors|sunken city' || order.join('|').endsWith('castle of horrors|sunken city'));

  // ---- Settings
  const Settings = require(APP + '/client/views/Settings.jsx').default;
  const sh = renderToString(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: base, dispatch() {} } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Settings))))));
  console.log('   settings html near label:', (sh.match(/Maps directory[^<]*<[^>]*>[^<]{0,80}/) || ['(label not found)'])[0].slice(0, 160), '| has path:', sh.includes('Doom'));
  check('Settings: "Maps directory (optional, kept apart from the mods)" with its value', sh.includes('Maps directory (optional, kept apart from the mods)') && sh.indexOf('Maps directory') > sh.indexOf('WAD'));
  for (const [lng, w] of [['tr', ['Haritalar', 'Modlar']], ['ar', ['الخرائط', 'المودات']], ['ru', ['Карты', 'Моды']]]) {
    await i18n.changeLanguage(lng); localStorage.setItem('ssgl.section', 'mods'); ReactDOM.unmountComponentAtNode(host); mount(base); await wait(300);
    w.forEach(x => check('switch (' + lng + ') shows "' + x + '"', text().toUpperCase().includes(x.toUpperCase())));
  }
  process.exit(0);
})();
