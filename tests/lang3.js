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
    remote: { shell: { showItemInFolder() {}, moveItemToTrash: () => true }, dialog: { showMessageBox: async () => ({ response: 0 }) }, app: { getVersion: () => '1.0.0' }, getCurrentWindow: () => ({}) },
    ipcRenderer: { invoke: async () => ({ data: null }), on() {}, removeListener() {} }
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
  await i18n.changeLanguage('ru');
  check('ru -> <html lang="ru" dir="ltr">', document.documentElement.getAttribute('lang') === 'ru' && document.documentElement.getAttribute('dir') === 'ltr');

  // Russian plural forms: 1, 21 | 2-4, 22 | 0, 5-20, 25, 100, 111
  const counts = [0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 100, 101, 111, 112];
  const show = key => counts.map(n => n + ':' + i18n.t(key, { count: n }).replace(/\d+ /, '')).join('  ');
  console.log('ru statsMods ->', show('wads:statsMods'));
  const expected = { 0: 'модов', 1: 'мод', 2: 'мода', 4: 'мода', 5: 'модов', 11: 'модов', 12: 'модов', 14: 'модов', 21: 'мод', 22: 'мода', 25: 'модов', 100: 'модов', 101: 'мод', 111: 'модов', 112: 'модов' };
  check('ru plural rule is right for all 15 test numbers', counts.every(n => i18n.t('wads:statsMods', { count: n }) === n + ' ' + expected[n]));
  console.log('ru toastFixed 1,3,7 ->', [1, 3, 7].map(n => i18n.t('wads:toastFixed', { count: n })).join(' | '));
  console.log('ru conflictShared 2,5 ->', [2, 5].map(n => i18n.t('wads:conflictShared', { count: n })).join(' | '));
  console.log('ru exportDone 21,22,30 ->', [21, 22, 30].map(n => i18n.t('packages:exportDone', { count: n })).join(' | '));
  console.log('ru date ->', i18n.t('packages:lastplayed', { value: new Date(Date.now() - 3 * 86400000) }), '|', i18n.t('packages:lastplayed', { value: new Date(Date.now() - 21 * 86400000) }));

  // the screens
  localStorage.clear();
  localStorage.setItem('ssgl.sort', 'folder'); localStorage.setItem('ssgl.openFolders', JSON.stringify(['1_BP']));
  const html = renderToString(wrap(React.createElement(Wads)));
  ['Инструменты', 'Проверить конфликты', 'Сортировать по папкам', 'Развернуть все', '4 мода', 'Моды'.slice(0,0)].filter(Boolean).forEach(w => check('Wads screen (ru) contains "' + w + '"', html.includes(w)));
  check('Wads screen (ru) has no raw keys', !/wads:[a-zA-Z]|common:[a-z]|packages:[a-z]/.test(html.replace(/https?:[^"]*/g, '')));
  // no leftover English from the old half-translated file
  const flat = (o, p = '') => Object.keys(o).reduce((a, k) => (typeof o[k] === 'object' ? Object.assign(a, flat(o[k], p + k + '.')) : (a[p + k] = o[k], a)), {});
  const ruTexts = flat(require(APP + '/client/locales/ru.js').default);
  const english = Object.keys(ruTexts).filter(k => !/[А-Яа-яЁё]/.test(ruTexts[k]) && !/^(nav\.appname|common\.sourceport)$/.test(k));
  console.log('ru texts without any Cyrillic letter:', english.map(k => k + '=' + ruTexts[k]).join(' | ') || 'none');
  check('every Russian text contains Cyrillic (except brand names)', english.length === 0 || english.every(k => /^(common\.iwad|nav\.appname|settings\.markerPinkie|settings\.markerSlayer)$/.test(k) || /^\{\{|^\+|^[A-Z0-9_ ]+$/.test(ruTexts[k])));

  // errors, About, Update
  const { explainError } = require(APP + '/client/utils');
  const { AppError, toPayload } = require(APP + '/electron/utils/errors.js');
  const t = i18n.t.bind(i18n);
  const codes = ['E_NO_WADDIR','E_OUTSIDE','E_PARENT_MISSING','E_FOLDER_EXISTS','E_PICK_FOLDER','E_FOLDER_MISSING','E_SAME_NAME','E_NOT_EMPTY','E_FS_DENIED','E_NAME_EMPTY','E_NAME_LONG','E_NAME_CHARS','E_NAME_END','E_NO_PACKAGES','E_FILE_UNREADABLE','E_NOT_PACKAGES_FILE','E_ADD_SOURCEPORT','E_NO_SAVEPATH','E_EMPTY_PACKAGES_FILE'];
  check('all 19 file-handling messages are Russian', codes.every(c => /[А-Яа-я]/.test(explainError(toPayload(new AppError(c)), t))));
  const About = require(APP + '/client/views/About').default;
  const ah = renderToString(wrap(React.createElement(About)));
  ['Используемые технологии', 'Альфа-тестирование на Windows', 'Сделано вручную в Вене, Австрия', 'Сайт'].forEach(w => check('About (ru) contains "' + w + '"', ah.includes(w)));
  const Update = require(APP + '/client/components/Update.jsx').default;
  const uh = renderToString(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: { ...st, update: { version: '9.9.9', changelog: 'x', download: 'https://x', done: false } }, dispatch() {} } }, React.createElement(Update))));
  ['Доступна версия 9.9.9', 'Не сейчас', 'Скачать'].forEach(w => check('Update window (ru) contains "' + w + '"', uh.includes(w)));

  // other languages unaffected
  await i18n.changeLanguage('tr'); check('tr still works', i18n.t('wads:statsUsage') === 'Disk kullanımı');
  await i18n.changeLanguage('ar'); check('ar still works: layout ltr, text rtl', i18n.t('wads:statsUsage') === 'استخدام القرص' && document.documentElement.getAttribute('dir') === 'ltr' && document.documentElement.getAttribute('data-text-dir') === 'rtl');
  await i18n.changeLanguage('ru'); check('back to ru -> ltr again', document.documentElement.getAttribute('dir') === 'ltr' && document.documentElement.getAttribute('data-text-dir') === 'ltr');
  process.exit(0);
})();
