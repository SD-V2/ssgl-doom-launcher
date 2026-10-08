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
  const CheckMod = require(APP + '/client/components/Mods/Checkmarks');
  const Check = CheckMod.default;
  const { reducer, initState } = require(APP + '/client/state/reducer.js');
  const Settings = require(APP + '/client/views/Settings.jsx').default;
  const { Simulate } = require(APP + '/node_modules/react-dom/test-utils');
  const wait2 = ms => new Promise(r => setTimeout(r, ms));
  const host = document.createElement('div'); document.body.appendChild(host);
  const inner = html => (html.match(/<g class="pent">([\s\S]*?)<\/g><\/svg>/) || [])[1];
  const draw = id => inner(renderToString(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(Check, { theme: id, active: true, size: '50' }))));

  // ---- which design
  check('markerOf: a chosen design wins over the color theme', CheckMod.markerOf({ marker: 'uac', theme: 'hell' }) === 'uac' && CheckMod.markerOf({ marker: 'slayer', theme: 'neon' }) === 'slayer');
  check('markerOf: "auto", nothing, or nonsense -> the design of the color theme (as it always was)', CheckMod.markerOf({ marker: 'auto', theme: 'bfg' }) === 'bfg' && CheckMod.markerOf({ theme: 'pinkie' }) === 'pinkie' && CheckMod.markerOf({ marker: 'banana', theme: 'uac' }) === 'uac');
  check('the eleven designs: five classic, three cyberpunk, three gothic', CheckMod.MARKERS.join() === 'hell,uac,bfg,pinkie,slayer,target,chip,bolt,cross,rose,arch' && CheckMod.MARKER_GROUPS.cyberpunk.join() === 'target,chip,bolt' && CheckMod.MARKER_GROUPS.gothic.join() === 'cross,rose,arch');
  const drawn = CheckMod.MARKERS.map(draw);
  check('the eleven designs really look different (' + new Set(drawn).size + ' different pictures)', drawn.every(Boolean) && new Set(drawn).size === 11);
  check('markerOf: "auto" in the Cyberpunk style -> target, in the Gothic style -> cross, in Classic -> the color theme', CheckMod.markerOf({ marker: 'auto', theme: 'hell', style: 'cyberpunk' }) === 'target' && CheckMod.markerOf({ theme: 'uac', style: 'gothic' }) === 'cross' && CheckMod.markerOf({ marker: 'auto', theme: 'uac', style: 'classic' }) === 'uac' && CheckMod.markerOf({ theme: 'bfg' }) === 'bfg');
  check('markerOf: a chosen design also wins over the style', CheckMod.markerOf({ marker: 'uac', theme: 'hell', style: 'cyberpunk' }) === 'uac' && CheckMod.markerOf({ marker: 'chip', theme: 'hell', style: 'gothic' }) === 'chip');
  check('a color theme without its own design (neon, nightcity, bloodmoon, custom) uses the pentagram when "auto"', ['neon', 'nightcity', 'bloodmoon', 'custom'].every(k => draw(CheckMod.markerOf({ theme: k })) === drawn[0]));

  // ---- the mod rows use it
  const Wads = require(APP + '/client/views/Wads.jsx').default;
  const mk = (id, name) => ({ id, name, kind: 'PK3', size: '1 MB', bytes: 1, created: 1, path: 'C:\\m\\' + name + '.pk3', folders: [], folder: '', tags: [], active: true });
  global.__invoke = async () => ({ error: null, data: null });
  const rowMark = async (settings) => {
    ReactDOM2.unmountComponentAtNode(host);
    const state = { ...st, mods: [mk('a', 'one')], folders: [], mapFolders: [], package: { ...st.package, id: null, selected: [] }, packages: [], settings: { ...st.settings, modpath: 'C:\\m', mappath: '', ...settings } };
    ReactDOM2.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: state, dispatch() {} } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Wads))))), host);
    await wait2(500);
    const g = host.querySelector('g.pent'); return g ? g.innerHTML : null;
  };
  const normal = html => (html || '').replace(/\s+/g, '');
  check('mod rows: marker "auto" with the color theme "uac" shows the UAC design', normal(await rowMark({ theme: 'uac', marker: 'auto' })) === normal(drawn[1]));
  check('mod rows: marker "slayer" with the color theme "hell" shows the Slayer design', normal(await rowMark({ theme: 'hell', marker: 'slayer' })) === normal(drawn[4]));
  check('mod rows: no marker saved at all (old settings) -> as before, the color theme decides', normal(await rowMark({ theme: 'bfg', marker: undefined })) === normal(drawn[2]));

  // ---- Settings: the picker
  const events = [];
  const stSet = { ...st, packages: [], settings: { ...st.settings, theme: 'uac', marker: 'auto', modpath: 'C:\\m' } };
  const mountSet = s => ReactDOM2.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: s || stSet, dispatch: a => events.push(a) } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Settings))))), host);
  ReactDOM2.unmountComponentAtNode(host); mountSet(); await wait2(500);
  const tiles = () => Array.from(host.querySelectorAll('[role=button][aria-pressed]'));
  check('Settings: "Active mod marker" with twelve pictures (Automatic + the eleven designs), in three groups', /Active mod marker/i.test(host.textContent) && tiles().length === 12 && tiles().map(t => t.textContent.trim().toLowerCase()).join('|') === 'automatic|pentagram|uac|bfg|pinkie|slayer|target|chip|bolt|cross|rose window|arch' && /Classic/.test(host.textContent) && /Cyberpunk/.test(host.textContent) && /Gothic/.test(host.textContent));
  check('...the saved choice (Automatic) is marked', tiles()[0].getAttribute('aria-pressed') === 'true' && tiles().slice(1).every(t => t.getAttribute('aria-pressed') === 'false'));
  check('...the "Automatic" picture shows the design of the color theme (UAC here)', normal(tiles()[0].querySelector('g.pent').innerHTML) === normal(drawn[1]));
  check('...every other picture shows its own design', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].every(i => normal(tiles()[i].querySelector('g.pent').innerHTML) === normal(drawn[i - 1])));
  events.length = 0; Simulate.click(tiles()[5]); await wait2(250);
  const pv = events.filter(e => e.type === 'settings/preview').pop();
  check('click "Slayer": shown at once in the mod rows (a first look, not saved)', pv && pv.data.marker === 'slayer' && !events.some(e => e.type === 'settings/save'));
  check('...and the picture is marked now', tiles()[5].getAttribute('aria-pressed') === 'true' && tiles()[0].getAttribute('aria-pressed') === 'false');
  events.length = 0; Simulate.keyDown(tiles()[2], { key: 'Enter' }); await wait2(250);
  check('keyboard: Enter on the third picture (UAC) chooses it and marks it', events.filter(e => e.type === 'settings/preview').pop().data.marker === 'uac' && tiles()[2].getAttribute('aria-pressed') === 'true');
  events.length = 0; Simulate.click(tiles()[0]); await wait2(250);
  check('click "Automatic": back to the design of the color theme', events.filter(e => e.type === 'settings/preview').pop().data.marker === 'auto');
  events.length = 0; ReactDOM2.unmountComponentAtNode(host); await wait2(50);
  check('leaving Settings without saving puts the saved marker back', events.filter(e => e.type === 'settings/preview').pop().data.marker === 'auto');

  // ---- "Automatic" follows the interface style
  events.length = 0; ReactDOM2.unmountComponentAtNode(host);
  mountSet({ ...stSet, settings: { ...stSet.settings, style: 'cyberpunk' } }); await wait2(500);
  check('Settings in the Cyberpunk style: the "Automatic" picture shows the target', normal(tiles()[0].querySelector('g.pent').innerHTML) === normal(drawn[5]));
  ReactDOM2.unmountComponentAtNode(host); mountSet({ ...stSet, settings: { ...stSet.settings, style: 'gothic' } }); await wait2(500);
  check('...in the Gothic style: the cross', normal(tiles()[0].querySelector('g.pent').innerHTML) === normal(drawn[8]));
  ReactDOM2.unmountComponentAtNode(host); mountSet(); await wait2(300);

  // ---- the state and the languages
  check('the setting starts with "auto"', initState.settings.marker === 'auto');
  check('preview changes only the marker', (() => { const r = reducer(initState, { type: 'settings/preview', data: { marker: 'uac' } }); return r.settings.marker === 'uac' && r.settings.theme === initState.settings.theme; })());
  for (const [lng, words] of [['tr', ['Etkin mod işareti', 'Otomatik', 'Gül pencere']], ['ar', ['علامة المود النشط', 'تلقائي', 'نافذة وردية']], ['ru', ['Значок активного мода', 'Авто', 'Окно-роза']]]) {
    await i18n.changeLanguage(lng); mountSet(); await wait2(300);
    words.forEach(w => check('Settings (' + lng + ') shows "' + w + '"', host.textContent.includes(w) || Array.from(host.querySelectorAll('[title]')).some(e => e.getAttribute('title') === w)));
    ReactDOM2.unmountComponentAtNode(host);
  }
  process.exit(0);
})();
