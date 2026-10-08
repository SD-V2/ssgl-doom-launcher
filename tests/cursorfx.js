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
// Cursor effects (Cyberpunk): trail on/off, trail size, trail length, click effect on/off
(async () => {
  const styles = require(APP + '/client/Theme/styles.jsx');
  const CT = require(APP + '/client/Theme/CursorTrail.jsx');
  const CursorTrail = CT.default;
  const { Trail, SETTINGS } = require(APP + '/client/Theme/trail.js');
  const host = document.createElement('div'); document.body.appendChild(host);
  const drawn = { rect: 0, stroke: 0 };
  const fakeCtx = { setTransform() {}, clearRect() {}, fillRect() { drawn.rect++; }, strokeRect() { drawn.stroke++; }, set globalAlpha(v) {}, set fillStyle(v) {}, set strokeStyle(v) {}, set shadowColor(v) {}, set shadowBlur(v) {}, set lineWidth(v) {}, set globalCompositeOperation(v) {} };
  window.HTMLCanvasElement.prototype.getContext = () => fakeCtx;
  window.requestAnimationFrame = fn => setTimeout(() => fn(window.performance.now()), 16);
  window.cancelAnimationFrame = id => clearTimeout(id);
  window.document.hasFocus = () => true;
  window.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {} });
  const colors = { main: '#55e6f7', second: '#ff2d46', hot: '#eafcff' };
  const move = (x, y) => window.dispatchEvent(new window.MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
  const down = (x, y) => window.dispatchEvent(new window.MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }));
  const canvasEl = () => Array.from(document.querySelectorAll('canvas')).find(c => c.style.position === 'fixed');

  // ---------- reading the settings
  const fx = CT.effectsOf;
  const d = fx({});
  check('old settings (nothing saved yet): trail on, click on, normal size and length', d.trail && d.click && d.size === 1 && d.length === 1);
  const o = fx({ cursorTrail: '', cursorClick: '', trailSize: '200', trailLength: '50' });
  check('unticked boxes are saved as "" and mean off; sliders come as text "200" / "50"', !o.trail && !o.click && o.size === 2 && o.length === 0.5);
  const w = fx({ trailSize: '9999', trailLength: 'abc' });
  check('odd values are kept in range (max 200 %) or go back to normal', w.size === 2 && w.length === 1);

  // ---------- the engine: size and length
  const seq = () => { let i = 0; return () => ((i++ * 0.37) % 1); };
  const make = (size, length) => { const t = new Trail({ colors, rnd: seq(), size, length }); t.move(0, 0, 0); t.move(400, 0, 0); return t; };
  const avg = (t, k) => t.particles.reduce((a, p) => a + p[k], 0) / t.particles.length;
  const n1 = make(1, 1), big = make(2, 1), small = make(0.5, 1), long = make(1, 2), short = make(1, 0.5);
  check('size 200 %: squares about twice as big (' + avg(n1, 'size').toFixed(1) + ' -> ' + avg(big, 'size').toFixed(1) + ')', avg(big, 'size') > avg(n1, 'size') * 1.7);
  check('size 50 %: smaller squares, never smaller than 1 pixel', avg(small, 'size') < avg(n1, 'size') && small.particles.every(p => p.size >= 1));
  check('length 200 %: squares live twice as long', Math.abs(avg(long, 'life') - avg(n1, 'life') * 2) < 1);
  check('length 50 %: half as long', Math.abs(avg(short, 'life') - avg(n1, 'life') / 2) < 1);
  const lot = new Trail({ colors, length: 2 }); for (let i = 0; i < 400; i++) lot.add(0, 0, 0);
  check('a long trail may keep more squares (but still a limit)', lot.particles.length === SETTINGS.max * 2);

  // ---------- the canvas follows the choices at once
  let engine = null;
  const render = props => { ReactDOM2.render(React.createElement(CursorTrail, { colors, onEngine: e => { engine = e; }, ...props }), host); return wait(40); };
  await render({ trail: true, click: true, size: 1, length: 1 });
  const first = engine;
  await render({ trail: true, click: true, size: 1.5, length: 2 });
  check('moving a slider changes the running trail at once (same canvas, new size and length)', engine === first && engine.size === 1.5 && engine.length === 2);
  engine.clear();
  await render({ trail: false, click: true, size: 1, length: 1 });
  move(10, 10); move(200, 200); move(400, 300); await wait(60);
  check('trail off: moving the mouse makes no squares', engine.particles.length === 0);
  down(300, 300); await wait(60);
  check('...but a click still gives the burst and the ripple', engine.ripples.length === 1 && engine.particles.length === 8);
  engine.clear();
  await render({ trail: true, click: false, size: 1, length: 1 });
  down(300, 300); await wait(40);
  check('click effect off: a click gives no burst and no ripple', engine.ripples.length === 0 && engine.particles.length === 0);
  move(10, 10); move(200, 200); await wait(40);
  check('...but the trail still follows the mouse', engine.particles.length > 5);
  ReactDOM2.unmountComponentAtNode(host);

  // ---------- inside the style layer
  const layer = async props => { ReactDOM2.unmountComponentAtNode(host); ReactDOM2.render(React.createElement(ThemeProvider, { theme: styles.applyStyle(themes.nightcity, props.style || 'cyberpunk') }, React.createElement(styles.StyleLayer, { style: 'cyberpunk', ...props })), host); await wait(60); return !!canvasEl(); };
  check('Cyberpunk, trail off but click on: the canvas stays (for the clicks)', await layer({ trail: false, click: true }));
  check('Cyberpunk, both off: no canvas at all (costs nothing)', !(await layer({ trail: false, click: false })));
  check('Classic: no cursor effects whatever the settings', !(await layer({ style: 'classic', trail: true, click: true })));
  ReactDOM2.unmountComponentAtNode(host);

  // ---------- Settings
  const Settings = require(APP + '/client/views/Settings.jsx').default;
  const events = [];
  const mountSet = s => ReactDOM2.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: s, dispatch: a => events.push(a) } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Settings))))), host);
  const base = (style, extra = {}) => ({ ...st, packages: [], settings: { ...st.settings, style, modpath: 'C:\\m', ...extra } });
  for (const style of ['classic', 'gothic']) {
    mountSet(base(style)); await wait(300);
    check('Settings (' + style + '): no "Cursor effects" group, no sliders, no click option', !/Cursor effects/.test(host.textContent) && !host.querySelector('input[name=trailSize]') && !host.querySelector('input[name=cursorClick]'));
    ReactDOM2.unmountComponentAtNode(host);
  }
  mountSet(base('cyberpunk')); await wait(300);
  const txt = host.textContent;
  check('Settings (Cyberpunk): "Cursor effects" with trail, size, length and click effect', /Cursor effects/.test(txt) && /Trail size/.test(txt) && /Trail length/.test(txt) && /Click effect/.test(txt));
  const size = host.querySelector('input[name=trailSize]'), len = host.querySelector('input[name=trailLength]');
  check('...the sliders go from 50 to 200 % and start at 100', size && len && size.min === '50' && size.max === '200' && size.value === '100' && len.value === '100');
  const grp = host.querySelector('.ssgl-cursor-effects');
  const names = grp ? Array.from(grp.querySelectorAll('input')).map(i => i.name) : [];
  check('...in this order: trail, size, length, click', names.join(',') === 'cursorTrail,trailSize,trailLength,cursorClick');

  events.length = 0;
  size.value = '160'; Simulate.change(size); await wait(100);
  let pv = events.filter(e => e.type === 'settings/preview').pop();
  check('moving the size slider shows at once (live preview), nothing saved yet', pv && pv.data.trailSize === '160' && !events.some(e => e.type === 'settings/save'));
  const len2 = host.querySelector('input[name=trailLength]');
  len2.value = '70'; Simulate.change(len2); await wait(100);
  pv = events.filter(e => e.type === 'settings/preview').pop();
  check('...the length slider too', pv && pv.data.trailLength === '70');
  const ck = host.querySelector('input[name=cursorClick]');
  Simulate.click(ck.parentElement.querySelector('button, [role=checkbox], div') || ck); await wait(150);
  pv = events.filter(e => e.type === 'settings/preview').pop();
  check('unticking the click effect shows at once', pv && 'cursorClick' in pv.data && !pv.data.cursorClick);
  const tr = host.querySelector('input[name=cursorTrail]');
  Simulate.click(tr.parentElement.querySelector('button, [role=checkbox], div') || tr); await wait(150);
  check('unticking the trail hides its size and length sliders (the click option stays)', !host.querySelector('input[name=trailSize]') && !host.querySelector('input[name=trailLength]') && !!host.querySelector('input[name=cursorClick]'));
  events.length = 0; ReactDOM2.unmountComponentAtNode(host); await wait(50);
  pv = events.filter(e => e.type === 'settings/preview').pop();
  check('leaving Settings without saving puts the saved choices back', pv && pv.data.cursorTrail === true && pv.data.cursorClick === true && pv.data.trailSize === 100 && pv.data.trailLength === 100);

  const { initState } = require(APP + '/client/state/reducer.js');
  check('defaults: click effect on, size 100 %, length 100 %', initState.settings.cursorClick === true && initState.settings.trailSize === 100 && initState.settings.trailLength === 100);
  for (const [lng, words] of [['tr', ['İmleç efektleri', 'İz boyutu', 'Tıklama efekti']], ['ar', ['تأثيرات المؤشر', 'حجم الأثر', 'تأثير النقر']], ['ru', ['Эффекты курсора', 'Размер следа', 'Эффект щелчка']]]) {
    await i18n.changeLanguage(lng); mountSet(base('cyberpunk')); await wait(300);
    check('Settings (' + lng + ') shows ' + words.join(' / '), words.every(x => host.textContent.includes(x)));
    ReactDOM2.unmountComponentAtNode(host);
  }
  process.exit(0);
})();
