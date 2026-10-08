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
  const Body = require(APP + '/client/components/Body.jsx').default;
  const allCss = () => Array.from(document.querySelectorAll('style')).map(n => n.textContent || (n.sheet ? Array.from(n.sheet.cssRules).map(r => r.cssText).join('\n') : '')).join('\n').replace(/\s+/g, ' ');
  // the CSS rules that belong to the Body element of this render (own classes only)
  const cssOf = props => {
    const h = document.createElement('div'); document.body.appendChild(h);
    ReactDOM.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(Body, props, React.createElement('span', null, 'content'))), h);
    const classes = h.firstChild.className.split(' ').filter(Boolean);
    const css = allCss();
    ReactDOM.unmountComponentAtNode(h);
    const rules = css.match(/[^{}]+\{[^{}]*\}/g) || [];
    return rules.filter(r => classes.some(c => r.split('{')[0].includes('.' + c))).join(' ');
  };
  let css = cssOf({ background: '', dim: 0, blur: 0 });
  console.log('   (rules found for this element:', css.length, 'characters)');
  check('the test can really read the element\'s CSS', css.length > 100 && /::before/.test(css));
  check('no dimming, no blur -> no filter at all (nothing to compute for GIF wallpapers)', !/filter:/.test(css));
  check('wallpaper sits on its own layer behind the content', /::before/.test(css) && /z-index: ?-1/.test(css) && /isolation: ?isolate/.test(css));
  css = cssOf({ background: '', dim: 40, blur: 0 }); check('dim 40 -> brightness(0.60)', /filter: ?brightness\(0\.60\);/.test(css) && !/blur\(/.test(css));
  css = cssOf({ background: '', dim: 0, blur: 6 }); check('blur 6 -> blur(6px) + slightly enlarged + clipped', /filter: ?blur\(6px\)/.test(css) && /scale\(1\.06\)/.test(css) && /overflow: ?hidden/.test(css));
  css = cssOf({ background: '', dim: 25, blur: 3 }); check('both -> brightness(0.75) blur(3px)', /filter: ?brightness\(0\.75\) blur\(3px\)/.test(css));
  css = cssOf({ background: '', dim: '95', blur: '99' }); check('absurd values are held to 80 % and 12 px', /brightness\(0\.20\) blur\(12px\)/.test(css));
  css = cssOf({ background: '', dim: 'abc', blur: undefined }); check('text / missing values count as 0', !/filter:/.test(css));
  css = cssOf({ background: 'C:\\pics\\wall.gif', dim: 10, blur: 0 }); console.log('   own wallpaper css:', (css.match(/url\([^)]*\)/) || [''])[0]); check('own wallpaper (GIF) is still used on the layer', /url\("file:\/\/C:\\\\pics\\\\wall\.gif"\)/.test(css) && /brightness\(0\.90\)/.test(css));

  // ---- wallpaper fit
  const flat = c => c.replace(/\s+/g, '');
  const rulesOf = c => (c.match(/[^{}]+\{[^{}]*\}/g) || []);
  const before = c => rulesOf(c).filter(r => /::before/.test(r.split('{')[0])).map(r => r.split('{')[1]).join(';');
  const after = c => rulesOf(c).filter(r => /::after/.test(r.split('{')[0])).map(r => r.split('{')[1]).join(';');
  let c1 = cssOf({ background: 'C:\\p\\tall.png', fit: 'cover', dim: 0, blur: 0 });
  check('fit "cover" (default): fills the window, no extra layer', /background-size:\s*cover/.test(before(c1)) && !after(c1).includes('blur(30px)') && !/overflow:\s*hidden/.test(c1));
  c1 = cssOf({ background: 'C:\\p\\tall.png', dim: 0, blur: 0 });
  check('no fit given -> cover (old settings keep working)', /background-size:\s*cover/.test(before(c1)));
  c1 = cssOf({ background: 'C:\\p\\tall.png', fit: 'banana', dim: 0, blur: 0 });
  check('unknown fit -> cover', /background-size:\s*cover/.test(before(c1)));
  c1 = cssOf({ background: 'C:\\p\\tall.png', fit: 'contain', dim: 0, blur: 0 });
  check('fit "contain": the whole picture, centered, not repeated', /background-size:\s*contain/.test(before(c1)) && /background-position:\s*center center/.test(before(c1)) && /no-repeat/.test(before(c1)));
  check('...the space around it shows a dark blurred copy (second layer behind the picture)', /blur\(30px\)/.test(after(c1)) && /brightness\(0\.45\)/.test(after(c1)) && /z-index:\s*-2/.test(after(c1)) && /background-size:\s*cover/.test(after(c1)));
  check('...the copy is clipped to the window (no scroll bars)', /overflow:\s*hidden/.test(c1));
  c1 = cssOf({ background: 'C:\\p\\anim.GIF', fit: 'contain', dim: 0, blur: 0 });
  check('fit "contain" with a GIF: no second (blurred) layer, so the animation costs the same as before', /background-size:\s*contain/.test(before(c1)) && !after(c1).includes('blur(30px)'));
  c1 = cssOf({ background: 'C:\\p\\tall.png', fit: 'contain', dim: 50, blur: 0 });
  check('the darkening also darkens the blurred copy (0.45 x 0.5)', /brightness\(0\.23\)/.test(after(c1)) || /brightness\(0\.22\)/.test(after(c1)));
  c1 = cssOf({ background: 'C:\\p\\tall.png', fit: 'stretch', dim: 0, blur: 0 });
  check('fit "stretch": exactly the size of the window', /background-size:\s*100%\s*100%/.test(before(c1)) && !after(c1).includes('blur(30px)'));
  c1 = cssOf({ background: 'C:\\p\\tall.png', fit: 'stretch', dim: 0, blur: 6 });
  check('blur with "stretch"/"contain": no extra zoom (the picture stays exactly as chosen); with "cover" it still zooms a little', !/scale\(1\.06\)/.test(before(c1)) && /scale\(1\.06\)/.test(before(cssOf({ background: 'C:\\p\\tall.png', fit: 'cover', dim: 0, blur: 6 }))));
  c1 = cssOf({ background: '', fit: 'contain', dim: 0, blur: 0 });
  check('the built-in wallpaper works with every fit', /background-size:\s*contain/.test(before(c1)));

  // the Settings sliders: live preview, revert when leaving unsaved
  const Settings = require(APP + '/client/views/Settings.jsx').default;
  const events = [];
  const st2 = { ...st, settings: { ...st.settings, wallpaperDim: 20, wallpaperBlur: 2, modpath: '/w' } };
  const host = document.createElement('div'); document.body.appendChild(host);
  const mount = () => ReactDOM.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: st2, dispatch: a => events.push(a) } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Settings))))), host);
  mount(); await new Promise(r => setTimeout(r, 100));
  const sliders = Array.from(host.querySelectorAll('input[type=range]'));
  const dim = sliders.find(i => i.name === 'wallpaperDim'), blur = sliders.find(i => i.name === 'wallpaperBlur');
  check('Settings: two wallpaper sliders (darkening 0-80, blur 0-12) with the saved values', dim && blur && dim.max === '80' && dim.step === '5' && blur.max === '12' && dim.value === '20' && blur.value === '2');
  check('Settings: labels in English', /Wallpaper darkening \(%\)/.test(host.textContent) && /Wallpaper blur \(pixels\)/.test(host.textContent));
  const { Simulate } = require(APP + '/node_modules/react-dom/test-utils');
  events.length = 0;
  dim.value = '60'; Simulate.change(dim, { target: dim, currentTarget: dim }); await new Promise(r => setTimeout(r, 60));
  const prev = events.filter(e => e.type === 'settings/preview').pop();
  check('moving the slider shows the effect at once (preview, not saved)', prev && String(prev.data.wallpaperDim) === '60' && !events.some(e => e.type === 'settings/save'));
  events.length = 0;
  ReactDOM.unmountComponentAtNode(host); await new Promise(r => setTimeout(r, 30));
  const back = events.filter(e => e.type === 'settings/preview').pop();
  check('leaving Settings without saving puts the saved look back (20 % / 2 px)', back && back.data.wallpaperDim === 20 && back.data.wallpaperBlur === 2);
  for (const lng of ['tr', 'ar', 'ru']) { await i18n.changeLanguage(lng); mount(); await new Promise(r => setTimeout(r, 60)); check('Settings (' + lng + '): slider labels translated', !/settings:wallpaper/.test(host.textContent) && !/Wallpaper (darkening|blur)/.test(host.textContent)); ReactDOM.unmountComponentAtNode(host); }

  // fit dropdown (the language loop above ended in Russian)
  await i18n.changeLanguage('en');
  mount(); await new Promise(r => setTimeout(r, 300));
  const fitHidden = host.querySelector('input[name=wallpaperFit]');
  check('Settings: "Wallpaper fit" dropdown between the picture and the sliders, starts with "Fill"', !!fitHidden && fitHidden.value === 'cover' && /Wallpaper fit/i.test(host.textContent));
  const nm = Array.from(host.querySelectorAll('input[type=hidden], input[type=range]')).map(i => i.name);
  check('...order on the screen: wallpaper fit, then darkening, then blur', nm.indexOf('wallpaperFit') > -1 && nm.indexOf('wallpaperFit') < nm.indexOf('wallpaperDim') && nm.indexOf('wallpaperDim') < nm.indexOf('wallpaperBlur'));
  Simulate.focus(fitHidden.parentElement.querySelector('input[type=text]')); await new Promise(r => setTimeout(r, 120));
  const fitItems = Array.from(host.querySelectorAll('li')).map(li => li.textContent.trim()).filter(x => /^(Fill the window|Fit \(|Stretch)/.test(x));
  check('...three choices: fill (crops), fit (whole picture), stretch', fitItems.length === 3 && /crops/.test(fitItems[0]) && /whole picture/.test(fitItems[1]) && /distort/.test(fitItems[2]));
  events.length = 0; Simulate.click(Array.from(host.querySelectorAll('li')).find(li => /^Fit \(/.test(li.textContent.trim()))); await new Promise(r => setTimeout(r, 200));
  const pv = events.filter(e => e.type === 'settings/preview').pop();
  check('choosing "Fit" shows it at once (a first look, not saved)', pv && pv.data.wallpaperFit === 'contain' && !events.some(e => e.type === 'settings/save'));
  events.length = 0; ReactDOM.unmountComponentAtNode(host); await new Promise(r => setTimeout(r, 40));
  const rv = events.filter(e => e.type === 'settings/preview').pop();
  check('leaving Settings without saving puts the saved fit back (fill)', rv && rv.data.wallpaperFit === 'cover');

  // reducer
  const { reducer, initState } = require(APP + '/client/state/reducer.js');
  const r = reducer({ ...initState }, { type: 'settings/preview', data: { wallpaperDim: 35, wallpaperBlur: 4 } });
  check('the setting starts with "cover"', initState.settings.wallpaperFit === 'cover');
  check('reducer: preview changes only the two values, others stay', r.settings.wallpaperDim === 35 && r.settings.wallpaperBlur === 4 && r.settings.language === initState.settings.language && initState.settings.wallpaperDim === 0);
  process.exit(0);
})();
