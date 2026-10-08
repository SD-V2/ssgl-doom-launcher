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
  const styles = require(APP + '/client/Theme/styles.jsx');
  const CursorTrail = require(APP + '/client/Theme/CursorTrail.jsx').default;
  const { Simulate } = require(APP + '/node_modules/react-dom/test-utils');
  const wait2 = ms => new Promise(r => setTimeout(r, ms));
  const host = document.createElement('div'); document.body.appendChild(host);

  // a canvas that records what is drawn; the page's animation clock
  const drawn = { clear: 0, rect: 0, stroke: 0 };
  const fakeCtx = { setTransform() {}, clearRect() { drawn.clear++; }, fillRect() { drawn.rect++; }, strokeRect() { drawn.stroke++; }, set globalAlpha(v) {}, get globalAlpha() { return 1; }, set fillStyle(v) {}, set strokeStyle(v) {}, set shadowColor(v) {}, set shadowBlur(v) {}, set lineWidth(v) {}, set globalCompositeOperation(v) {} };
  let hasCanvas = true;
  window.HTMLCanvasElement.prototype.getContext = function () { return hasCanvas ? fakeCtx : null; };
  let raf = 0; const cancelled = [];
  window.requestAnimationFrame = fn => setTimeout(() => fn(window.performance.now()), 16);
  window.cancelAnimationFrame = id => { cancelled.push(id); clearTimeout(id); };
  window.document.hasFocus = () => true;
  const colors = { main: '#2dd4e8', second: '#ff2d46', hot: '#eafcff' };
  const move = (x, y, target) => (target || window).dispatchEvent(new window.MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
  const canvasEl = () => Array.from(document.querySelectorAll('canvas')).find(c => c.style.position === 'fixed');

  // ---------- the canvas
  let engine = null;
  ReactDOM2.render(React.createElement(CursorTrail, { colors, onEngine: e => { engine = e; } }), host); await wait2(60);
  const c = canvasEl();
  check('a transparent canvas over the whole window that the mouse goes through (pointer-events none), above everything', !!c && c.style.pointerEvents === 'none' && c.style.width === '100%' && c.style.height === '100%' && c.style.zIndex === '10001' && c.getAttribute('aria-hidden') === 'true');
  check('...nothing is drawn while the mouse rests', engine && engine.alive === 0 && drawn.rect === 0);
  move(100, 100); move(160, 120); move(240, 160); await wait2(120);
  check('moving the mouse makes squares and draws them (' + (engine && engine.alive) + ' alive, ' + drawn.rect + ' drawn)', engine.alive > 5 && drawn.rect > 5 && drawn.clear > 0);
  const before = drawn.clear; await wait2(160);
  check('...the animation keeps running while squares are alive', drawn.clear > before);
  window.dispatchEvent(new window.MouseEvent('mousedown', { clientX: 300, clientY: 300, bubbles: true })); await wait2(60);
  check('a click starts the burst and the square ripple', engine.ripples.length === 1 && drawn.stroke > 0);
  await wait2(1400);
  const settled = drawn.clear; await wait2(200);
  check('everything fades out, and then the animation STOPS (no work while the pointer rests)', engine.particles.length <= 3 && engine.ripples.length === 0);
  check('...(a resting pointer gets a slow square now and then, but the animation sleeps in between)', drawn.clear - settled < 14);

  // the hand: more color over things you can click
  const seen = []; const origMove = engine.move.bind(engine);
  engine.move = (x, y, tm, hand) => { seen.push(hand); return origMove(x, y, tm, hand); };
  const btn = document.createElement('button'); btn.textContent = 'ok'; document.body.appendChild(btn);
  const plain = document.createElement('div'); plain.textContent = 'text'; document.body.appendChild(plain);
  move(10, 10, btn); move(10, 10, plain);
  check('over a button the trail knows it is a "hand" place; over plain text it does not', seen[0] === true && seen[1] === false);
  btn.remove(); plain.remove();

  // leaving the window
  engine.move(0, 0, 0); document.dispatchEvent(new window.Event('mouseleave'));
  check('mouse leaves the window: the last place is forgotten', engine.last === null);

  // unmount: all gone
  ReactDOM2.unmountComponentAtNode(host); await wait2(40);
  check('removing the trail takes the canvas away and stops the engine', !canvasEl() && engine === null);
  const afterUnmount = drawn.clear; move(500, 500); move(600, 600); await wait2(80);
  check('...the mouse is not watched any more', drawn.clear === afterUnmount);

  // no canvas support: must not break anything
  hasCanvas = false;
  let threw = false; try { ReactDOM2.render(React.createElement(CursorTrail, { colors }), host); await wait2(40); move(1, 1); move(90, 90); } catch (e) { threw = true; }
  check('a window without canvas drawing does not crash', !threw);
  ReactDOM2.unmountComponentAtNode(host); hasCanvas = true;

  // ---------- inside the style layer
  const layer = async (style, trail, theme) => { ReactDOM2.unmountComponentAtNode(host); ReactDOM2.render(React.createElement(ThemeProvider, { theme: styles.applyStyle(theme || themes.nightcity, style) }, React.createElement(styles.StyleLayer, { style, trail })), host); await wait2(80); return !!canvasEl(); };
  check('Cyberpunk: the trail is there', await layer('cyberpunk', true));
  check('Cyberpunk with the trail and the click effect switched off in Settings: no canvas', !(await (async () => { ReactDOM2.unmountComponentAtNode(host); ReactDOM2.render(React.createElement(ThemeProvider, { theme: styles.applyStyle(themes.nightcity, 'cyberpunk') }, React.createElement(styles.StyleLayer, { style: 'cyberpunk', trail: false, click: false })), host); await wait2(80); return !!canvasEl(); })()));
  check('Cyberpunk, setting not given (old settings): the trail is on', await (async () => { ReactDOM2.unmountComponentAtNode(host); ReactDOM2.render(React.createElement(ThemeProvider, { theme: styles.applyStyle(themes.hell, 'cyberpunk') }, React.createElement(styles.StyleLayer, { style: 'cyberpunk' })), host); await wait2(80); return !!canvasEl(); })());
  check('Gothic: no trail (it is a Cyberpunk thing)', !(await layer('gothic', true, themes.bloodmoon)));
  check('Classic: no trail', !(await layer('classic', true, themes.hell)));
  window.matchMedia = q => ({ matches: /reduce/.test(q), media: q, addListener() {}, removeListener() {} });
  check('the system asks for less motion: no trail', !(await layer('cyberpunk', true)));
  window.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {} });
  check('...and when it does not: the trail again', await layer('cyberpunk', true));
  ReactDOM2.unmountComponentAtNode(host);
  check('leaving the style takes the canvas away', !canvasEl());

  // ---------- colors follow the color theme
  let colorsSeen = null;
  ReactDOM2.render(React.createElement(CursorTrail, { colors: { main: '#ffa800', second: '#ff0000', hot: '#eafcff' }, onEngine: e => { colorsSeen = e && e.colors; } }), host); await wait2(40);
  check('the sparkles use the colors it is given (here Hell: orange + red + white-hot)', colorsSeen && colorsSeen.main === '#ffa800' && colorsSeen.second === '#ff0000');
  ReactDOM2.unmountComponentAtNode(host);

  // ---------- Settings
  const Settings = require(APP + '/client/views/Settings.jsx').default;
  const events = [];
  const mountSet = s => ReactDOM2.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: s, dispatch: a => events.push(a) } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Settings))))), host);
  const base = style => ({ ...st, packages: [], settings: { ...st.settings, style, cursorTrail: true, modpath: 'C:\\m' } });
  mountSet(base('classic')); await wait2(400);
  check('Settings (Classic style): no trail option', !/Sparkle trail/i.test(host.textContent));
  ReactDOM2.unmountComponentAtNode(host); mountSet(base('gothic')); await wait2(400);
  check('Settings (Gothic style): no trail option', !/Sparkle trail/i.test(host.textContent));
  ReactDOM2.unmountComponentAtNode(host); mountSet(base('cyberpunk')); await wait2(400);
  check('Settings (Cyberpunk style): "Sparkle trail behind the mouse pointer" under the style, ticked', /Sparkle trail behind the mouse pointer/.test(host.textContent) && !!host.querySelector('input[name=cursorTrail]'));
  const names = Array.from(host.querySelectorAll('input[type=hidden]')).map(i => i.name);
  check('...it sits between the interface style and the marker picker', names.indexOf('style') > -1 && names.indexOf('cursorTrail') > names.indexOf('style'));
  events.length = 0; const cb = host.querySelector('input[name=cursorTrail]');
  Simulate.click(cb.parentElement.querySelector('button, [role=checkbox], div') || cb); await wait2(250);
  const pv = events.filter(e => e.type === 'settings/preview').pop();
  check('unticking shows at once (no trail), nothing saved yet', pv && 'cursorTrail' in pv.data && !pv.data.cursorTrail && !events.some(e => e.type === 'settings/save'));
  events.length = 0; ReactDOM2.unmountComponentAtNode(host); await wait2(50);
  check('leaving Settings without saving puts the saved choice back (trail on)', events.filter(e => e.type === 'settings/preview').pop().data.cursorTrail === true);
  const { initState } = require(APP + '/client/state/reducer.js');
  check('the setting starts on', initState.settings.cursorTrail === true);
  for (const [lng, w] of [['tr', 'Fare imlecinin arkasında kıvılcım izi'], ['ar', 'أثر شرارات خلف مؤشر الفأرة'], ['ru', 'След из искр за указателем мыши']]) {
    await i18n.changeLanguage(lng); mountSet(base('cyberpunk')); await wait2(300);
    check('Settings (' + lng + ') shows "' + w + '"', host.textContent.includes(w));
    ReactDOM2.unmountComponentAtNode(host);
  }
  process.exit(0);
})();
