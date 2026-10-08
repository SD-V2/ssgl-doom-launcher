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
(async () => {
  // the test setup turns every .ogg into the same stub text: for these tests the file path itself is wanted
  require.extensions['.ogg'] = (m, filename) => { m.exports = filename; };
  Object.keys(require.cache).filter(k => k.endsWith('.ogg')).forEach(k => delete require.cache[k]);
  delete require.cache[require.resolve(APP + '/client/components/Audio')];
  const AudioMod = require(APP + '/client/components/Audio');
  const AudioProvider = AudioMod.default;
  const { SOUND_PACKS, soundsFor } = AudioMod;
  const useSound = require(APP + '/client/utils/useSound.jsx').default;
  const styles = require(APP + '/client/Theme/styles.jsx');
  const { Simulate } = require(APP + '/node_modules/react-dom/test-utils');
  const wait2 = ms => new Promise(r => setTimeout(r, ms));
  const base = f => String(f).split(/[\\/]/).pop();
  const EVENTS = ['soundStart', 'soundDrawer', 'soundModSelect', 'soundToastSuccess', 'soundToastError'];

  // ---------- the sound packs
  check('three sets: classic, cyberpunk, gothic - five events each', Object.keys(SOUND_PACKS).join() === 'classic,cyberpunk,gothic' && Object.keys(SOUND_PACKS).every(k => EVENTS.every(e => !!SOUND_PACKS[k][e])));
  check('classic: every event is the same click (as always)', new Set(EVENTS.map(e => base(SOUND_PACKS.classic[e]))).size === 1 && base(SOUND_PACKS.classic.soundModSelect) === 'click.ogg');
  check('cyberpunk: five different sounds of its own', new Set(EVENTS.map(e => base(SOUND_PACKS.cyberpunk[e]))).size === 5 && EVENTS.every(e => /^cyberpunk-/.test(base(SOUND_PACKS.cyberpunk[e]))));
  check('gothic: five different sounds of its own', new Set(EVENTS.map(e => base(SOUND_PACKS.gothic[e]))).size === 5 && EVENTS.every(e => /^gothic-/.test(base(SOUND_PACKS.gothic[e]))));
  const fsMod = require('fs');
  check('every sound file exists and is small (all together under 150 KB)', ['cyberpunk', 'gothic'].every(k => EVENTS.every(e => fsMod.existsSync(APP + '/client/assets/sounds/' + base(SOUND_PACKS[k][e])))) && ['cyberpunk', 'gothic'].reduce((n, k) => n + EVENTS.reduce((m, e) => m + fsMod.statSync(APP + '/client/assets/sounds/' + base(SOUND_PACKS[k][e])).size, 0), 0) < 150 * 1024);
  check('soundsFor: the set of the style', soundsFor({ style: 'cyberpunk' }) === SOUND_PACKS.cyberpunk && soundsFor({ style: 'gothic' }) === SOUND_PACKS.gothic && soundsFor({ style: 'classic' }) === SOUND_PACKS.classic);
  check('soundsFor: no style saved (old settings) -> classic; unknown style -> classic', soundsFor({}) === SOUND_PACKS.classic && soundsFor({ style: 'banana' }) === SOUND_PACKS.classic);
  check('soundsFor: "match the style" off (the form saves an unticked box as an empty text) -> classic click', soundsFor({ style: 'cyberpunk', styleSounds: '' }) === SOUND_PACKS.classic && soundsFor({ style: 'gothic', styleSounds: false }) === SOUND_PACKS.classic);
  check('soundsFor: ticked or not saved yet -> the style set', soundsFor({ style: 'gothic', styleSounds: true }) === SOUND_PACKS.gothic && soundsFor({ style: 'gothic', styleSounds: undefined }) === SOUND_PACKS.gothic);

  // ---------- what is really played
  const played = [];
  global.Audio = class { constructor(src) { this.src = src; this.volume = 1; } play() { played.push({ src: this.src, volume: this.volume }); return Promise.resolve(); } };
  window.Audio = global.Audio;
  let playFn = null;
  const Grab = () => { playFn = useSound()[0]; return null; };
  const host = document.createElement('div'); document.body.appendChild(host);
  const mount = settings => { ReactDOM2.unmountComponentAtNode(host); ReactDOM2.render(React.createElement(StoreContext.Provider, { value: { gstate: { ...st, settings: { ...st.settings, ...settings } }, dispatch() {} } }, React.createElement(AudioProvider, null, React.createElement(Grab))), host); };

  mount({ soundActive: true, style: 'cyberpunk', volume: 0.4 });
  playFn('soundModSelect');
  check('Cyberpunk: selecting a mod plays its own beep at the chosen volume', played.length === 1 && base(played[0].src) === 'cyberpunk-modselect.ogg' && played[0].volume === 0.4);
  played.length = 0; EVENTS.forEach(e => playFn(e));
  check('...each of the five events plays a different file', new Set(played.map(p => base(p.src))).size === 5);
  played.length = 0; mount({ soundActive: true, style: 'gothic', volume: 0.5 }); playFn('soundToastError');
  check('Gothic: an error plays the low bell', base(played[0].src) === 'gothic-error.ogg');
  played.length = 0; mount({ soundActive: true, style: 'classic', volume: 0.5 }); playFn('soundModSelect'); playFn('soundStart');
  check('Classic: the click, as always', played.length === 2 && played.every(p => base(p.src) === 'click.ogg'));
  played.length = 0; mount({ soundActive: true, style: 'cyberpunk', styleSounds: '', volume: 0.5 }); playFn('soundModSelect');
  check('"Sounds match the style" off: the classic click even in Cyberpunk', base(played[0].src) === 'click.ogg');
  played.length = 0; mount({ soundActive: false, style: 'cyberpunk', volume: 0.5 }); EVENTS.forEach(e => playFn(e));
  check('sounds off (the default): nothing is played at all', played.length === 0);
  played.length = 0; mount({ soundActive: true, style: 'cyberpunk', volume: 0.5, soundModSelect: 'C:\\my\\own.wav' }); playFn('soundModSelect'); playFn('soundDrawer');
  check('a sound file chosen by hand still wins for its event (the others stay with the style)', played[0].src === 'file://C:\\my\\own.wav' && base(played[1].src) === 'cyberpunk-drawer.ogg');

  // ---------- the keyboard frame mark
  const root = document.documentElement;
  const press = (key, type = 'keydown') => window.dispatchEvent(new window.KeyboardEvent(type, { key, bubbles: true }));
  ReactDOM2.unmountComponentAtNode(host);
  const mountLayer = async style => { ReactDOM2.unmountComponentAtNode(host); ReactDOM2.render(React.createElement(ThemeProvider, { theme: styles.applyStyle(themes.hell, style) }, React.createElement(styles.StyleLayer, { style })), host); await wait2(80); };
  await mountLayer('cyberpunk');
  check('keyboard mark: starts without it', !root.hasAttribute('data-keyboard'));
  press('Tab'); check('...Tab sets it (the frame around the focused thing shows)', root.getAttribute('data-keyboard') === '1');
  window.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true })); check('...a mouse click removes it', !root.hasAttribute('data-keyboard'));
  press('ArrowDown'); check('...an arrow key sets it', root.hasAttribute('data-keyboard'));
  window.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true })); press('a'); press('Enter'); press('Shift');
  check('...typing letters / Enter / Shift does not set it', !root.hasAttribute('data-keyboard'));
  press('Tab'); ReactDOM2.unmountComponentAtNode(host);
  check('...leaving the style removes the mark', !root.hasAttribute('data-keyboard'));
  await mountLayer('gothic'); press('Tab'); check('Gothic: the same', root.hasAttribute('data-keyboard'));
  await mountLayer('classic'); check('...back to Classic: mark removed', !root.hasAttribute('data-keyboard'));
  press('Tab'); check('Classic never sets it (nothing changes in the classic look)', !root.hasAttribute('data-keyboard'));
  ReactDOM2.unmountComponentAtNode(host);

  // ---------- Settings: the Sounds section
  const Settings = require(APP + '/client/views/Settings.jsx').default;
  const events = [];
  const mountSet = s => ReactDOM2.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: s, dispatch: a => events.push(a) } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Settings))))), host);
  const stSet = on => ({ ...st, packages: [], settings: { ...st.settings, style: 'classic', soundActive: on, volume: 0.5, styleSounds: true, modpath: 'C:\\m' } });
  mountSet(stSet(false)); await wait2(400);
  check('Settings: a "Sounds" section with "Activate Sound Feedback" (off: no more options)', /Sounds/.test(host.textContent) && /Activate Sound Feedback/i.test(host.textContent) && !host.querySelector('input[name=volume]') && !/match the interface style/i.test(host.textContent));
  ReactDOM2.unmountComponentAtNode(host); mountSet(stSet(true)); await wait2(400);
  check('Settings: sounds on -> volume slider and "Sounds match the interface style"', !!host.querySelector('input[name=volume]') && /Sounds match the interface style/i.test(host.textContent) && host.querySelector('input[name=volume]').value === '0.5');
  events.length = 0; const box = Array.from(host.querySelectorAll('input[name=soundActive]')).pop();
  Simulate.click(host.querySelector('input[name=soundActive]').parentElement.querySelector('button, [role=checkbox], div') || box); await wait2(250);
  check('ticking / unticking shows at once (a first look, not saved)', events.some(e => e.type === 'settings/preview' && e.data && 'soundActive' in e.data) && !events.some(e => e.type === 'settings/save'));
  events.length = 0; ReactDOM2.unmountComponentAtNode(host); await wait2(50);
  check('leaving Settings without saving puts the saved sound settings back', events.filter(e => e.type === 'settings/preview').pop().data.soundActive === true && events.filter(e => e.type === 'settings/preview').pop().data.styleSounds === true);

  // the sample when the style is changed
  played.length = 0; ReactDOM2.unmountComponentAtNode(host);
  const { reducer } = require(APP + '/client/state/reducer.js');
  const Stateful = () => { const [g, d] = React.useReducer(reducer, stSet(true)); return React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: g, dispatch: d } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Settings)))));
  };
  ReactDOM2.render(React.createElement(Stateful), host); await wait2(500);
  check('opening Settings plays nothing', played.length === 0);
  const hid = host.querySelector('input[name=style]');
  Simulate.focus(hid.parentElement.querySelector('input[type=text]')); await wait2(120);
  Simulate.click(Array.from(host.querySelectorAll('li')).find(li => li.textContent.trim() === 'Cyberpunk')); await wait2(500);
  check('choosing the Cyberpunk style plays a short sample of ITS sound (not the old click)', played.length >= 1 && base(played[played.length - 1].src) === 'cyberpunk-modselect.ogg');
  ReactDOM2.unmountComponentAtNode(host);

  // ---------- languages
  for (const [lng, words] of [['tr', ['Ses düzeyi', 'Sesler arayüz stiline uysun']], ['ar', ['مستوى الصوت', 'الأصوات تناسب نمط الواجهة']], ['ru', ['Громкость', 'Звуки подходят стилю интерфейса']]]) {
    await i18n.changeLanguage(lng); mountSet(stSet(true)); await wait2(300);
    words.forEach(w => check('Settings (' + lng + ') shows "' + w + '"', host.textContent.includes(w)));
    ReactDOM2.unmountComponentAtNode(host);
  }
  process.exit(0);
})();
