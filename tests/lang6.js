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
  const Update = require(APP + '/client/components/Update.jsx').default;
  const { isDismissed, dismiss } = require(APP + '/client/utils/dismissed.js');
  const mk = update => renderToString(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: { ...st, update }, dispatch() {} } }, React.createElement(Update))));
  const files = { available: true, kind: 'files', repo: 'SD-V2/ssgl-doom-launcher', sha: 'bbbbbbb2222', version: 'bbbbbbb', download: 'https://x', changelog: 'Add Russian language', date: '2026-10-08T08:00:00Z' };
  const rel = { available: true, kind: 'release', version: 'v2.0.0-devpreview.25', download: 'https://y', changelog: 'Release notes here' };

  const expect = { en: ['New files in your fork', 'Newer files (version bbbbbbb) were uploaded to SD-V2/ssgl-doom-launcher', 'Build-SSGL.cmd', 'Open on GitHub', 'Not now', 'Add Russian language'],
                   tr: ['Fork’unuzda yeni dosyalar var', 'sürüm bbbbbbb', 'SD-V2/ssgl-doom-launcher', 'GitHub’da aç', 'Şimdi değil'],
                   ar: ['ملفات جديدة في نسختك المعدّلة', 'الإصدار bbbbbbb', 'SD-V2/ssgl-doom-launcher', 'فتح على GitHub', 'ليس الآن'],
                   ru: ['В вашем форке новые файлы', 'версия bbbbbbb', 'SD-V2/ssgl-doom-launcher', 'Открыть на GitHub', 'Не сейчас'] };
  for (const lng of ['en', 'tr', 'ar', 'ru']) {
    await i18n.changeLanguage(lng);
    const h = mk(files);
    expect[lng].forEach(w => check('new-files window (' + lng + ') contains "' + w + '"', h.includes(w)));
    check('new-files window (' + lng + ') has no raw keys and no "Download" button', !/common:|update[A-Z]/.test(h) && !h.includes('Download'));
  }
  await i18n.changeLanguage('en');
  const hr = mk(rel);
  check('release window unchanged: "Version v2.0.0-devpreview.25 Available", Download button, notes', hr.includes('Version v2.0.0-devpreview.25 Available') && hr.includes('Download') && hr.includes('Release notes here') && !hr.includes('New files in your fork'));

  // "Not now" is remembered per upload
  check('nothing dismissed at first', !isDismissed('bbbbbbb2222'));
  dismiss('bbbbbbb2222');
  check('after "Not now": same upload stays quiet', isDismissed('bbbbbbb2222'));
  check('a NEWER upload is announced again', !isDismissed('ccccccc3333'));
  check('empty value is never "dismissed"', !isDismissed('') && !isDismissed(undefined));
  process.exit(0);
})();
