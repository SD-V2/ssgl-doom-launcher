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
  const mkMod = (id, name, mb, created) => ({ id, name, kind: 'PK3', size: mb + ' MB', bytes: mb * MB, created, path: '/w/' + name + '.pk3', folders: [], folder: '', tags: [], active: true });
  const A = mkMod('A1', 'brutal v21', 100, 1), B = mkMod('B1', 'brutal v22', 120, 2), C = mkMod('C1', 'weapons', 30, 3), D = mkMod('D1', 'unrelated', 5, 4);
  const calls = []; let conflictAnswer = { error: null, data: { checked: 3, skipped: [], conflicts: [
    { a: 'A1', aName: 'brutal v21', b: 'C1', bName: 'weapons', count: 3, groups: [{ label: 'Shotgun', count: 3 }], sample: [] },
    { a: 'B1', aName: 'brutal v22', b: 'C1', bName: 'weapons', count: 2, groups: [{ label: 'Shotgun', count: 2 }], sample: [] }] } };
  global.__invoke = async (ch, d) => { calls.push([ch, d]); return ch === 'mods/conflicts' ? conflictAnswer : { data: null }; };
  localStorage.clear();
  const dispatched = [];
  const state = { ...st, mods: [A, B, C, D], package: { ...st.package, id: null, selected: ['A1', 'B1', 'C1', 'gone1'] }, packages: [], settings: { ...st.settings, modpath: '/w' } };
  const host = document.createElement('div'); document.body.appendChild(host);
  const mount = s => ReactDOM.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: s, dispatch: a => dispatched.push(a) } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Wads))))), host);
  mount(state);
  await wait(1100);
  const text = () => document.body.textContent;
  const q = sel => Array.from(document.body.querySelectorAll(sel));
  check('background check ran once after the load order appeared (no click needed)', calls.filter(c => c[0] === 'mods/conflicts').length >= 1);
  check('...and only looked at the mods that exist (3 of 4)', calls.find(c => c[0] === 'mods/conflicts')[1].items.length === 3);
  check('summary: "3 mods" and their size (262.1 MB = 250 MiB)', text().includes('3 mods') && text().includes('262.1 MB'));
  check('summary: "Missing: 1"', text().includes('Missing: 1'));
  check('summary: "2 conflicts"', text().includes('2 conflicts'));
  check('summary: "Possibly the same mod twice: 1"', text().includes('Possibly the same mod twice: 1'));
  const badges = q('span').filter(n => /^⚠ \d$/.test(n.textContent.trim())).map(n => n.textContent.trim());
  check('conflict badges on the items: weapons = ⚠ 2, the two brutal = ⚠ 1', badges.sort().join('|') === '⚠ 1|⚠ 1|⚠ 2');
  const twins = q('span').filter(n => n.textContent.trim() === 'twice?');
  check('"twice?" badge on exactly the two brutal versions', twins.length === 2);

  // the twins window
  const twinLink = q('a').find(n => n.textContent.includes('Possibly the same mod twice'));
  Simulate.click(twinLink); await wait(60);
  check('twins window opens: names both versions, says which is newer', text().includes('Same mod twice?') && text().includes('same name apart from the version number') && text().includes('newer file'));
  const keepLinks = q('a').filter(n => n.textContent.trim() === 'Keep this one');
  check('two "Keep this one" choices', keepLinks.length === 2);
  Simulate.click(keepLinks[1]); await wait(30);   // second row = brutal v22 (newest) -> v21 leaves
  const removal = dispatched.find(a => a.type === 'mods/remove');
  check('keeping v22 removes v21 from the load order (nothing else)', removal && removal.ids.join() === 'A1');
  Simulate.click(q('a').find(n => n.textContent.trim() === 'These are different mods')); await wait(60);
  check('"These are different mods" is remembered', /twin:A1\|B1/.test(localStorage.getItem('ssgl.ignoredConflicts') || ''));
  check('...and the warning disappears (summary + badges)', !text().includes('Possibly the same mod twice: 1') && q('span').filter(n => n.textContent.trim() === 'twice?').length === 0);

  // an ignored conflict is not counted
  localStorage.setItem('ssgl.ignoredConflicts', JSON.stringify(['A1|C1']));
  ReactDOM.unmountComponentAtNode(host); mount(state); await wait(1100);
  check('an ignored conflict is not counted: "1 conflict"', text().includes('1 conflict') && !text().includes('2 conflicts'));

  // no conflicts at all -> no conflict words
  conflictAnswer = { error: null, data: { checked: 3, skipped: [], conflicts: [] } };
  localStorage.clear(); ReactDOM.unmountComponentAtNode(host); mount(state); await wait(1100);
  check('no conflicts -> no conflict badge or summary entry', !/⚠ \d/.test(text()) && !/\d conflicts?\b/.test(text().replace(/Check conflicts/g, '')));
  // the check failing (e.g. file not readable) must not break the view
  global.__invoke = async () => ({ error: 'boom', data: null });
  ReactDOM.unmountComponentAtNode(host); mount(state); await wait(1100);
  check('background check fails -> view still shows the load order and the summary', text().includes('3 mods') && text().includes('brutal v22'));
  // one mod only -> no background check
  calls.length = 0; global.__invoke = async (ch, d) => { calls.push(ch); return { data: null }; };
  ReactDOM.unmountComponentAtNode(host); mount({ ...state, package: { ...state.package, selected: ['A1'] } }); await wait(900);
  check('a single mod in the load order -> no conflict check is made', !calls.includes('mods/conflicts'));
  check('a single mod -> summary "1 mod"', text().includes('1 mod'));
  // empty load order -> no summary
  const dots = () => (text().match(/ · /g) || []).length;
  const withOne = dots();
  ReactDOM.unmountComponentAtNode(host); mount({ ...state, package: { ...state.package, selected: [] } }); await wait(300);
  check('empty load order -> the summary line is gone (one "·" less than with a mod in it)', dots() === withOne - 1);

  // other languages: summary words
  for (const [lng, words] of [['tr', ['3 mod', 'Eksik: 1']], ['ru', ['3 мода', 'Не найдено: 1']], ['ar', ['3 مودات', 'مفقود: 1']]]) {
    await i18n.changeLanguage(lng); global.__invoke = async () => ({ data: null });
    ReactDOM.unmountComponentAtNode(host); mount(state); await wait(300);
    words.forEach(w => check('summary (' + lng + ') contains "' + w + '"', text().includes(w)));
  }
  process.exit(0);
})();
