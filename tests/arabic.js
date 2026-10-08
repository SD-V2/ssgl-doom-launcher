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
// Arabic: the layout stays as in English (nothing mirrored), only the text reads right to left
(async () => {
  const fs = require('fs');
  const TD = require(APP + '/client/utils/textDirection.js');
  const root = document.documentElement;
  const wait3 = ms => new Promise(r => setTimeout(r, ms));

  // ---- the window
  await i18n.changeLanguage('ar');
  check('Arabic: the window stays left to right (no mirrored layout), lang="ar", text direction rtl', root.getAttribute('dir') === 'ltr' && root.getAttribute('lang') === 'ar' && root.getAttribute('data-text-dir') === 'rtl');
  await i18n.changeLanguage('en');
  check('English: text direction ltr', root.getAttribute('dir') === 'ltr' && root.getAttribute('data-text-dir') === 'ltr');

  // ---- which text is Arabic
  check('first letter decides: Arabic -> rtl, English -> ltr, numbers and signs before the first letter do not count', TD.startsRtl('المودات') && TD.startsRtl('  (1) · المكتبات') && !TD.startsRtl('Brutal Doom مود') && !TD.startsRtl('123') && !TD.startsRtl(''));
  check('a text that starts with a number is recognized (also Arabic digits)', TD.startsWithNumber('0 · المكتبات') && TD.startsWithNumber('٣ مودات') && !TD.startsWithNumber('المودات 10'));

  // ---- what gets marked
  const box = document.createElement('div'); document.body.appendChild(box);
  box.innerHTML = '<p id="p1">ملفات تحتاجها المودات الأخرى</p>' +
    '<button id="b1">المودات<small id="s1">10</small></button>' +
    '<h2 id="h1">0 · المكتبات</h2>' +
    '<span id="n1">BRUTAL PACK</span>' +
    '<div id="row" style="display:flex"><span>الكل</span><span>10</span></div>' +
    '<div id="outer"><div id="inner">نص</div><svg></svg></div>' +
    '<p id="own" dir="ltr">C:\\\\Doom\\\\مودات</p>' +
    '<input id="in1" value="بحث">';
  const $ = id => document.getElementById(id);
  await i18n.changeLanguage('ar'); await wait3(20);
  check('an Arabic text block gets dir="auto" (reads right to left in its own box)', $('p1').getAttribute('dir') === 'auto' && $('p1').getAttribute('data-auto-dir') === 'rtl');
  check('...and keeps the side it has in English (nothing moves)', $('p1').getAttribute('data-keep-align') === 'left');
  check('a button text with a number in it: the button gets the direction, the number goes with it (the gap stays between them)', $('b1').getAttribute('dir') === 'auto' && !$('s1').hasAttribute('dir'));
  check('"0 · Libraries" (starts with a number) keeps the English order, like a numbered list', $('h1').getAttribute('dir') === 'ltr');
  check('English names get dir="auto" too, which keeps them left to right', $('n1').getAttribute('data-auto-dir') === 'ltr');
  check('a flex row is never given a direction (it would flip the order of what is in it)', !$('row').hasAttribute('dir'));
  check('a box that holds other boxes is not marked, only the text inside it', !$('outer').hasAttribute('dir') && $('inner').getAttribute('dir') === 'auto');
  check('a direction set on purpose in the code is kept', $('own').getAttribute('dir') === 'ltr' && !$('own').hasAttribute('data-auto-dir'));
  check('input boxes are not touched (they have dir="auto" themselves)', !$('in1').hasAttribute('data-auto-dir'));

  // ---- new and changed texts are followed
  const later = document.createElement('label'); later.textContent = 'تحرير الأقسام'; box.appendChild(later); await wait3(20);
  check('a text that comes later (a new screen, a list row) is marked as well', later.getAttribute('dir') === 'auto' && later.getAttribute('data-auto-dir') === 'rtl');
  later.textContent = 'Edit sections'; await wait3(20);
  check('...and follows when its words change', later.getAttribute('data-auto-dir') === 'ltr');

  // ---- back to English: every mark is taken away
  await i18n.changeLanguage('en'); await wait3(20);
  check('back to English: all marks are gone (the page is exactly as before)', document.querySelectorAll('[data-auto-dir]').length === 0 && !$('p1').hasAttribute('dir') && $('own').getAttribute('dir') === 'ltr');
  box.remove();

  // ---- the style sheet
  const css = fs.readFileSync(path.join(APP, 'client/global.css'), 'utf8');
  check('global.css: in Arabic text finds its own direction (plaintext), marked blocks keep their English side', /data-text-dir='rtl'\] body \*[\s\S]*unicode-bidi: plaintext/.test(css) && /data-keep-align='left'\]\s*\{\s*text-align: left/.test(css));
  check('global.css: text boxes and dropdowns keep their text on the left as in English', /data-text-dir='rtl'\] input,\s*html\[data-text-dir='rtl'\] textarea \{\s*text-align: left/.test(css));
  const modbox = fs.readFileSync(path.join(APP, 'client/components/Mods/ModBox.jsx'), 'utf8');
  check('ModBox: folder indent follows the window layout (always left to right), not the language', !/i18n\.dir\(\)/.test(modbox));

  // ---- a real screen in Arabic: Settings
  const Settings = require(APP + '/client/views/Settings.jsx').default;
  const host = document.createElement('div'); document.body.appendChild(host);
  await i18n.changeLanguage('ar');
  ReactDOM2.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: { ...st, packages: [], settings: { ...st.settings, language: 'ar', modpath: 'C:\\m' } }, dispatch() {} } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Settings))))), host);
  await wait3(400);
  const marked = host.querySelectorAll('[data-auto-dir="rtl"]').length;
  check('Settings in Arabic: the Arabic texts are marked (' + marked + ')', marked > 20);
  check('...no element in Settings got dir="rtl" (nothing is mirrored)', host.querySelectorAll('[dir="rtl"]').length === 0);
  ReactDOM2.unmountComponentAtNode(host);
  await i18n.changeLanguage('en');
  process.exit(0);
})();
