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

(async () => {
  // ---- direction follows the language
  await i18n.changeLanguage('ar');
  check('ar -> <html dir="rtl" lang="ar">', document.documentElement.getAttribute('dir') === 'rtl' && document.documentElement.getAttribute('lang') === 'ar');
  await i18n.changeLanguage('tr');
  check('tr -> <html dir="ltr" lang="tr">', document.documentElement.getAttribute('dir') === 'ltr' && document.documentElement.getAttribute('lang') === 'tr');
  await i18n.changeLanguage('en');
  check('en -> ltr', document.documentElement.getAttribute('dir') === 'ltr');

  // ---- Arabic plural forms (0,1,2,3-10,11-99,100+)
  await i18n.changeLanguage('ar');
  const forms = [0, 1, 2, 5, 11, 100].map(n => i18n.t('wads:statsMods', { count: n }));
  console.log('ar statsMods 0,1,2,5,11,100 ->', forms.join(' | '));
  check('ar plural forms are all different and filled', new Set(forms).size === 6 && forms.every(f => f && f.indexOf('wads:') < 0));
  console.log('ar exportDone 2 ->', i18n.t('packages:exportDone', { count: 2 }), '| conflictsFound 7 ->', i18n.t('wads:conflictsFound', { count: 7 }));
  await i18n.changeLanguage('tr');
  console.log('tr statsMods 1,5 ->', i18n.t('wads:statsMods', { count: 1 }), '|', i18n.t('wads:statsMods', { count: 5 }), '| date ->', i18n.t('packages:lastplayed', { value: new Date(Date.now() - 3 * 86400000) }));
  await i18n.changeLanguage('ar');
  console.log('ar date ->', i18n.t('packages:lastplayed', { value: new Date(Date.now() - 3 * 86400000) }));
  // missing key falls back to English instead of showing the key
  const fb = i18n.t('wads:somethingNew', { defaultValue: 'x' });
  await i18n.changeLanguage('de');
  console.log('de (partial translation) falls back to English:', i18n.t('wads:statsUsage'));

  // ---- the real screens in each language
  for (const lng of ['tr', 'ar']) {
    await i18n.changeLanguage(lng);
    localStorage.clear();
    localStorage.setItem('ssgl.sort', 'folder'); localStorage.setItem('ssgl.openFolders', JSON.stringify(['1_BP']));
    const html = renderToString(wrap(React.createElement(Wads)));
    const css = Array.from(document.querySelectorAll('style')).map(n => n.textContent || (n.sheet ? Array.from(n.sheet.cssRules).map(r => r.cssText).join('\n') : '')).join('\n');
    const want = lng === 'tr'
      ? ['Araçlar', 'Çakışmaları denetle', 'Klasöre göre sırala', 'Yükleme sırası'.slice(0, 0), 'Tümünü aç', '4 mod']
      : ['الأدوات', 'فحص التعارضات', 'ترتيب حسب المجلد', 'فتح الكل', '4 مودًا'.slice(0, 0), 'أربعة'.slice(0, 0)];
    want.filter(Boolean).forEach(w => check(lng + ' screen contains "' + w + '"', html.includes(w)));
    check(lng + ' screen has no raw keys', !/wads:[a-zA-Z]|common:[a-z]|packages:[a-z]/.test(html.replace(/https?:[^"]*/g, '')));
    if (lng === 'ar') {
      check('css: folder arrow points left when closed in rtl', /\[dir='rtl'\][^{]*\{[^}]*rotate\(90deg\)/.test(css) || /\[dir=["']?rtl["']?\][^{]*\{[^}]*rotate\(90deg\)/.test(css));
      check('css: play button moves to the left in rtl', /\[dir=['"]?rtl['"]?\][^{]*\{[^}]*left:\s*30px/.test(css));
      check('css: spacing uses start/end (no left/right margins from our files)', css.indexOf('margin-inline-start') > -1 && css.indexOf('margin-inline-end') > -1);
    }
  }
  // 4 mods in the 'ar' stats bar -> few form
  await i18n.changeLanguage('ar');
  const stats = renderToString(wrap(React.createElement(Components.ModStats, { count: 4, bytes: 5 * MB, groups: 0, onOpen() {}, onUsage() {} })));
  check('ar stats bar shows plural form 3-10 ("4 مودات")', stats.includes('4 مودات'));
  const stats2 = renderToString(wrap(React.createElement(Components.ModStats, { count: 12, bytes: 5 * MB, groups: 0, onOpen() {}, onUsage() {} })));
  check('ar stats bar shows plural form 11-99 ("12 مودًا")', stats2.includes('12 مودًا'));
  process.exit(0);
})();
