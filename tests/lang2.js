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
  for (const lng of ['en', 'tr', 'ar']) {
    await i18n.changeLanguage(lng);
    const t = i18n.t.bind(i18n);
    const texts = codes.map(c => explainError(toPayload(new AppError(c)), t));
    check(lng + ': all ' + codes.length + ' file-handling messages translated (none left as code / key)', texts.every((x, i) => x && x !== codes[i] && x.indexOf('errors:') < 0 && x.indexOf('E_') < 0));
    if (lng !== 'en') check(lng + ': none is identical to the English text', (() => { const en = i18n.getFixedT('en'); return texts.every((x, i) => x !== explainError(toPayload(new AppError(codes[i])), en)); })());
    console.log('   ' + lng + ' sample:', texts[3], '|', texts[8].slice(0, 40) + '...');
    check(lng + ': older style code (SETTINGS_FILE) translated', explainError('SETTINGS_FILE', t) !== 'SETTINGS_FILE');
    check(lng + ': system message passes through unchanged', explainError(new Error('ENOENT: no such file'), t) === 'ENOENT: no such file');
    check(lng + ': unknown code falls back to its message', explainError({ code: 'E_NEW_ONE', message: 'fallback text' }, t) === 'fallback text');
  }
  // names with & or quotes must not be HTML-escaped by i18next
  await i18n.changeLanguage('tr');
  const del = i18n.t('wads:confirmDelete', { name: `Tom & "Jerry's" <pack>` });
  check('names are not HTML-escaped (& " < >)', del.includes(`Tom & "Jerry's" <pack>`));
  await i18n.changeLanguage('ar');
  check('ar: forbidden-characters message keeps the symbols in one left-to-right block', i18n.t('errors:E_NAME_CHARS').includes('\u2066') && i18n.t('errors:E_NAME_CHARS').includes('\u2069'));

  // ---- About page
  const About = require(APP + '/client/views/About').default;
  for (const lng of ['en', 'tr', 'ar']) {
    await i18n.changeLanguage(lng);
    const html = renderToString(wrap(React.createElement(About)));
    const want = { en: ['Used Technologies', 'Alphatesting Windows', 'Handcrafted in Vienna, Austria', 'Code Licensed under'], tr: ['Kullanılan Teknolojiler', 'Windows alfa testi', 'Viyana, Avusturya’da el yapımı', 'Kod lisansı:', 'Web sitesi'], ar: ['التقنيات المستخدمة', 'اختبار على ويندوز', 'صُنع يدوياً في فيينا، النمسا', 'الكود مرخّص بموجب', 'الموقع الإلكتروني'] }[lng];
    want.forEach(w => check('About (' + lng + ') contains "' + w + '"', html.includes(w)));
    check('About (' + lng + ') shows the version in the title', /Version 1|Sürüm 1|الإصدار 1|1\.0\.0/.test(html));
    check('About (' + lng + ') has no raw keys', !/about:[a-zA-Z]/.test(html));
  }
  // ---- update window
  const Update = require(APP + '/client/components/Update.jsx').default;
  const stU = { ...st, update: { version: '9.9.9', changelog: 'x', download: 'https://x', done: false } };
  for (const lng of ['tr', 'ar']) {
    await i18n.changeLanguage(lng);
    const html = renderToString(React.createElement(ThemeProvider, { theme: themes.hell },
      React.createElement(StoreContext.Provider, { value: { gstate: stU, dispatch() {} } }, React.createElement(Update))));
    const want = lng === 'tr' ? ['Sürüm 9.9.9 mevcut', 'Şimdi değil', 'İndir'] : ['الإصدار 9.9.9 متاح', 'ليس الآن', 'تنزيل'];
    want.forEach(w => check('Update window (' + lng + ') contains "' + w + '"', html.includes(w)));
  }
  process.exit(0);
})();
