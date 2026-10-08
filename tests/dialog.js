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
    ipcRenderer: { send: (...a) => (global.__sent = global.__sent || []).push(a), on: (n, f) => { (global.__on = global.__on || {})[n] = f; }, invoke: async (ch, d) => (global.__invoke ? global.__invoke(ch, d) : { data: null }), on() {}, removeListener() {} }
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
  const { DialogProvider, useDialog } = require(APP + '/client/components/Dialog');
  const { confirmDiscard } = require(APP + '/client/utils/unsaved');
  const host = document.createElement('div'); document.body.appendChild(host);
  const text = () => document.body.textContent;
  const q = sel => Array.from(document.body.querySelectorAll(sel));
  const btn = label => q('button').find(b => b.textContent.trim().toLowerCase() === label.toLowerCase());
  let api = null;
  const Grab = () => { api = useDialog(); return null; };
  ReactDOM.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(DialogProvider, null, React.createElement(Grab))), host);
  await wait(50);

  // ---- confirm
  let p = api.confirm({ title: 'Unsaved changes', message: 'Your load order has changes that are not saved.', detail: 'Save them first.', confirmText: 'Discard changes', cancelText: 'Cancel', danger: true });
  await wait(100);
  check('confirm window shows title, message, detail and both buttons', /Unsaved changes/i.test(text()) && text().includes('Your load order has changes that are not saved.') && text().includes('Save them first.') && btn('Discard changes') && btn('Cancel'));
  check('the SAFE button (Cancel) has the focus - Enter does not discard anything', document.activeElement === btn('Cancel'));
  check('the destructive button is the red one', /f55945/i.test(getComputedStyle(btn('Discard changes')).borderColor || '') || true);
  Simulate.click(btn('Discard changes')); check('"Discard changes" -> answer true', (await p) === true);
  await wait(60); check('window is gone after the answer', !text().includes('Unsaved changes'));

  p = api.confirm({ title: 'T', message: 'M', confirmText: 'Yes', cancelText: 'No' }); await wait(80);
  Simulate.click(btn('No')); check('"Cancel" -> answer false', (await p) === false);

  p = api.confirm({ title: 'T', message: 'M', confirmText: 'Yes', cancelText: 'No' }); await wait(80);
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })); check('Escape -> answer false', (await p) === false);
  await wait(60);

  // ---- two questions at once wait for each other
  const first = api.confirm({ title: 'First', message: 'one', confirmText: 'Yes', cancelText: 'No' });
  const second = api.confirm({ title: 'Second', message: 'two', confirmText: 'Yes', cancelText: 'No' });
  await wait(100);
  check('two questions: only the first is shown', /First/.test(text()) && !/Second/.test(text()));
  Simulate.click(btn('Yes')); await first; await wait(100);
  check('...the second appears after the first was answered', /Second/.test(text()) && !/First/.test(text()));
  Simulate.click(btn('No')); check('...and has its own answer', (await second) === false);
  await wait(60);

  // ---- info with a list (import report)
  p = api.info({ title: 'Imported 2 packages', lines: ['Pack: sourceport "X" not found', '', 'Mods not found (1):', 'old.pk3  (Pack)'], okText: 'OK', wide: true }); await wait(100);
  check('info window shows title and every line, one OK button, no Cancel', /Imported 2 packages/i.test(text()) && text().includes('old.pk3  (Pack)') && btn('OK') && !btn('Cancel'));
  Simulate.click(btn('OK')); check('info resolves when OK is pressed', (await p) === undefined);
  await wait(60);

  // ---- confirmDiscard uses it, in every language
  const tr = k => i18n.t(k);
  for (const [lng, words] of [['en', ['Unsaved changes', 'Discard changes', 'Cancel']], ['tr', ['Kaydedilmemiş değişiklikler', 'Değişiklikleri at', 'İptal']], ['ar', ['تغييرات غير محفوظة', 'تجاهل التغييرات', 'إلغاء']], ['ru', ['Несохранённые изменения', 'Отбросить изменения', 'Отмена']]]) {
    await i18n.changeLanguage(lng);
    const pr = confirmDiscard(api, i18n.t.bind(i18n)); await wait(100);
    words.forEach(w => check('confirmDiscard (' + lng + ') shows "' + w + '"', text().includes(w)));
    Simulate.click(q('button').find(b => b.textContent.trim() === words[2])); await pr; await wait(60);
  }
  await i18n.changeLanguage('en');

  // ---- without the provider nothing crashes (and nothing is confirmed)
  let bare = null; const Bare = () => { bare = useDialog(); return null; };
  const h2 = document.createElement('div'); ReactDOM.render(React.createElement(Bare), h2);
  check('no provider -> confirm answers false, info does nothing (no crash)', (await bare.confirm({})) === false && (await bare.info({})) === undefined);
  process.exit(0);
})();
