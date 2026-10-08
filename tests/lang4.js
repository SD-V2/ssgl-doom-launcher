global.__BUILD_TIME__ = '2026-10-07T09:30:00.000Z';
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

global.__BUILD_TIME__ = '2026-10-07T09:30:00.000Z';
(async () => {
  const { ModStats, BrokenFilesModal } = require(APP + '/client/components');
  const MB = 1024 * 1024;
  const stats = (props, lng) => renderToString(wrap(React.createElement(ModStats, { count: 3, bytes: 5 * MB, groups: 2, onOpen() {}, onUsage() {}, onHealth() {}, ...props })));

  await i18n.changeLanguage('en');
  let h = stats({});
  check('stats bar: closed -> only "Tools" shown, tools hidden', h.includes('Tools') && !h.includes('Check files') && !h.includes('Disk usage'));
  check('stats bar: warning dot when duplicates exist', h.includes('class="dot') || h.includes('dot'));
  h = stats({ fixes: 2 });
  check('stats bar: package-update warning stays visible on the bar', h.includes('Update mods in packages (2)'));
  h = stats({ initiallyOpen: true });
  check('tools menu (open): Disk usage / Check files / Duplicates', h.includes('Disk usage') && h.includes('Check files') && h.includes('Duplicates: 2'));
  h = stats({ initiallyOpen: true, groups: 0 });
  check('tools menu: no Duplicates entry when there are none', !h.includes('Duplicates'));

  const problems = [
    { id: 'a', name: 'half download', path: '/w/1_BP/half.pk3', kind: 'PK3', code: 'damaged', detail: '' },
    { id: 'b', name: 'saved page', path: '/w/x/page.pk3', kind: 'PK3', code: 'notArchive', detail: '' },
    { id: 'c', name: 'zero', path: '/w/zero.wad', kind: 'WAD', code: 'empty', detail: '' },
    { id: 'd', name: 'disguised', path: '/w/d.pk3', kind: 'PK3', code: 'wrongType', detail: '7z' }];
  const mk = props => renderToString(wrap(React.createElement(BrokenFilesModal, { active: true, onClose() {}, onShow: () => () => {}, onDelete: () => () => {}, onRecheck() {}, modpath: '/w', count: 40, ...props })));
  for (const lng of ['en', 'tr', 'ar', 'ru']) {
    await i18n.changeLanguage(lng);
    const word = { en: ['Check files', 'Problems found: 4', 'damaged or incomplete', 'not a valid PK3 file', 'really a 7z archive', 'empty (0 bytes)', 'Check again'], tr: ['Dosyaları denetle', 'Bulunan sorun: 4', 'bozuk veya eksik', 'geçerli bir PK3', 'aslında bir 7z arşivi', 'boş (0 bayt)', 'Yeniden denetle'], ar: ['فحص الملفات', 'عدد المشكلات: 4', 'تالف أو غير مكتمل', 'ملف PK3 صالحاً', 'أرشيف 7z', 'الملف فارغ', 'فحص مرة أخرى'], ru: ['Проверка файлов', 'Найдено проблем: 4', 'повреждён или неполный', 'не корректный файл PK3', 'архив 7z', 'Файл пустой', 'Проверить снова'] }[lng];
    h = mk({ result: { checked: 36, unchecked: 2, problems } });
    word.forEach(w => check('broken-files window (' + lng + ') contains "' + w + '"', h.includes(w)));
    check('broken-files window (' + lng + ') shows file names, short paths and no raw keys', h.includes('half download') && h.includes('1_BP/half.pk3') && !/wads:|health_/.test(h));
  }
  await i18n.changeLanguage('en');
  check('window while checking', mk({ loading: true, result: null }).includes('Checking 40 files...'));
  check('window with no problems', mk({ result: { checked: 40, unchecked: 0, problems: [] } }).includes('No broken files found. Files checked: 40.'));
  check('window shows not-tested note', mk({ result: { checked: 38, unchecked: 2, problems: [] } }).includes('Not tested (2)'));

  // settings screen + about
  const Settings = require(APP + '/client/views/Settings.jsx').default;
  const stt = { ...st, settings: { ...st.settings, updateRepo: 'me/ssgl-doom-launcher', hideWhilePlaying: true } };
  const sh = renderToString(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: stt, dispatch() {} } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Settings))))));
  check('settings: the update source box is gone, the Update notifier dropdown stays', !sh.includes('Tell me about new releases') && !sh.includes('GitHub name/repository') && sh.includes('Update Notifier') || /update notifier/i.test(sh) && !/github name\/repository/i.test(sh));
  check('settings: minimize-while-playing checkbox', sh.includes('Minimize SSGL while a game is running'));
  const sd = renderToString(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: { ...st, settings: { ...require(APP + '/client/state').initState.settings, modpath: '/w' } }, dispatch() {} } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Settings))))));
  check('settings: no repository text on the screen any more', !sd.includes('SD-V2/ssgl-doom-launcher'));
  const About = require(APP + '/client/views/About').default;
  { await i18n.changeLanguage('en'); const ah = renderToString(wrap(React.createElement(About))); console.log('DEBUG typeof global:', typeof __BUILD_TIME__, '| has Fork:', ah.includes('Fork'), '| has 2026:', ah.includes('2026'), '| title:', (ah.match(/Version[^<]{0,30}/)||[])[0]); }
  for (const [lng, text] of [['en', 'Fork build: 2026-10-07'], ['tr', 'Fork sürümü: 2026-10-07'], ['ar', 'إصدار النسخة المعدّلة: 2026-10-07'], ['ru', 'Сборка форка: 2026-10-07']]) {
    await i18n.changeLanguage(lng);
    check('About (' + lng + ') shows "' + text + '"', renderToString(wrap(React.createElement(About))).includes(text));
  }
  process.exit(0);
})();
