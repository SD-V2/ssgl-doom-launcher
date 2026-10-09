// Faster start (screens): the loading screen (logo, thin line, "Scanning 560 mods...")
// in all three styles and four languages, the start with the library cache (list at
// once, background check, changes applied), the window never white, the start time in
// About.
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/#/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
global.localStorage = dom.window.localStorage; global.HTMLElement = dom.window.HTMLElement; ['Element', 'Node', 'SVGElement', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'MutationObserver'].forEach(k => { if (dom.window[k] !== undefined && global[k] === undefined) global[k] = dom.window[k]; });
const fs = require('fs');
const path = require('path');
const Module = require('module');
const APP = require('./paths').APP + '';
const origReq = Module.prototype.require;
const listeners = {};
const sent = [];
let answer = async () => ({ data: null, error: null });
const emit = (ch, data) => (listeners[ch] || []).slice().forEach(f => f({}, data));
Module.prototype.require = function (req) {
  if (req === 'electron') return {
    ipcRenderer: {
      send: (...a) => sent.push(a), sendSync: require('./native-mock').sendSync,
      invoke: require('./native-mock').wrap(async (ch, d) => answer(ch, d)),
      on: (ch, f) => { (listeners[ch] = listeners[ch] || []).push(f); },
      removeListener: (ch, f) => { listeners[ch] = (listeners[ch] || []).filter(x => x !== f); }
    }
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
const ReactDOM = require(APP + '/node_modules/react-dom');
const { ThemeProvider } = require(APP + '/node_modules/styled-components');
const themes = require(APP + '/client/Theme/index.jsx').default;
const { applyStyle } = require(APP + '/client/Theme/styles.jsx');
const { initState } = require(APP + '/client/state');
const { reducer } = require(APP + '/client/state/reducer.js');
const i18n = require(APP + '/client/i18n.jsx').default;
const Startup = require(APP + '/client/components/Startup.jsx');
const useStartup = require(APP + '/client/utils/useStartup.js').default;
const About = require(APP + '/client/views/About/index.jsx').default;
const check = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const render = (el, theme = themes.hell, style = 'classic') => { ReactDOM.unmountComponentAtNode(host); ReactDOM.render(React.createElement(ThemeProvider, { theme: applyStyle(theme, style) }, el), host); };

  // ---- the loading screen in every style and language ---------------------------------
  const words = { en: ['Scanning 560 mods...', 'Reading your mods...'], tr: ['560 mod taranıyor...', 'Modlarınız okunuyor...'], ar: ['جارٍ فحص 560 مود...', 'جارٍ قراءة مودّاتك...'], ru: ['Сканирование модов: 560...', 'Читаем ваши моды...'] };
  for (const style of ['classic', 'cyberpunk', 'gothic']) {
    for (const lng of ['en', 'tr', 'ar', 'ru']) {
      await i18n.changeLanguage(lng);
      render(React.createElement(Startup.LoadingScreen, { count: 560 }), themes.nightcity, style);
      const withCount = host.textContent;
      const hasParts = !!host.querySelector('[data-startup="loading"] .line div') && host.querySelector('[data-startup="loading"]').children.length === 3;
      render(React.createElement(Startup.LoadingScreen, { count: 0 }), themes.nightcity, style);
      check(`loading screen ${style} / ${lng}: logo, thin line, "${words[lng][0]}" (first start: "${words[lng][1]}")`, hasParts && withCount.indexOf(words[lng][0]) > -1 && host.textContent.indexOf(words[lng][1]) > -1);
    }
  }
  await i18n.changeLanguage('en');
  check('loading screen: nothing is mirrored in Arabic (no dir="rtl")', (await i18n.changeLanguage('ar'), render(React.createElement(Startup.LoadingScreen, { count: 5 })), !host.querySelector('[dir="rtl"]')));
  await i18n.changeLanguage('en');
  render(React.createElement(Startup.CheckingLine));
  check('the thin line at the top while the folders are checked (it never takes clicks)', !!host.querySelector('[data-startup="checking"]') && /Checking your mod folders/.test(host.querySelector('[data-startup="checking"]').getAttribute('title')));
  const css = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
  check('...pointer-events: none (it never blocks the window)', /pointer-events:\s*none/.test(css));

  // ---- the colours of the last start, the number of mods --------------------------------
  Startup.saveLook({ theme: 'nightcity', style: 'cyberpunk', active: '#55E6F7' });
  Startup.saveCount(560);
  check('the look of the last start is remembered (used before the settings are read)', Startup.savedLook().theme === 'nightcity' && Startup.savedLook().style === 'cyberpunk');
  check('the number of mods of the last start is remembered ("Scanning 560 mods...")', Startup.savedCount() === 560);
  localStorage.setItem('ssgl.look', '{broken');
  check('broken remembered look: the default colours, no crash', JSON.stringify(Startup.savedLook()) === '{}');

  // ---- the start: list at once, background check, changes applied -------------------------
  const mods = n => Array.from({ length: n }, (_, i) => ({ id: 'm' + i, name: 'mod ' + i, kind: 'PK3', path: '/w/mod' + i + '.pk3', folders: [], folder: '', tags: [], bytes: 1, size: '1 B', created: 1 }));
  let state = null; let ready = null; let loaded = null; let failed = false;
  const Probe = () => {
    const [g, d] = React.useReducer(reducer, initState);
    state = g;
    const r = useStartup({ dispatch: d, onLoaded: data => { loaded = data; }, onFailed: () => { failed = true; } });
    ready = r;
    return React.createElement('div', null, r.ready ? 'ready' : 'loading');
  };
  const calls = [];
  answer = async (ch, d) => { calls.push([ch, d]); return ch === 'main/init' ? { error: null, data: { mods: mods(560), iwads: [], folders: [], duplicates: [], versions: [], mapFolders: [], settings: { ...initState.settings, savepath: '/d', modpath: '/w', language: 'tr' }, sourceports: [], packages: [], recovered: [], fromCache: true } } : { data: null, error: null }; };
  ReactDOM.unmountComponentAtNode(host); ReactDOM.render(React.createElement(Probe), host); await wait(50);
  check('start: asks for the quick list (the cache)', calls[0][0] === 'main/init' && calls[0][1].quick === true);
  check('start: the cached list is in the state at once, the screens can be shown', ready.ready === true && state.mods.length === 560 && loaded.settings.language === 'tr');
  check('...and the background check is shown (thin line)', ready.checking === true);
  emit('library/updated', { mods: mods(561), iwads: [], folders: [['NEW']], duplicates: [], versions: [], mapFolders: [] }); await wait(30);
  check('the folders changed while SSGL was closed: the new list replaces it, the line goes away', state.mods.length === 561 && ready.checking === false && Startup.savedCount() === 561);
  ReactDOM.unmountComponentAtNode(host);
  check('...and the listeners are removed when the window closes', (listeners['library/updated'] || []).length === 0);

  answer = async ch => (ch === 'main/init' ? { error: null, data: { mods: mods(3), iwads: [], folders: [], duplicates: [], versions: [], mapFolders: [], settings: { ...initState.settings, savepath: '/d' }, sourceports: [], packages: [], recovered: [], fromCache: true } } : { data: null });
  ReactDOM.render(React.createElement(Probe), host); await wait(50);
  emit('library/checked', { changed: false }); await wait(20);
  check('nothing changed: the list stays, the line goes away', state.mods.length === 3 && ready.checking === false);
  ReactDOM.unmountComponentAtNode(host);

  answer = async ch => (ch === 'main/init' ? { error: null, data: { mods: mods(2), iwads: [], folders: [], duplicates: [], versions: [], mapFolders: [], settings: { ...initState.settings, savepath: '/d' }, sourceports: [], packages: [], recovered: [] } } : { data: null });
  ReactDOM.render(React.createElement(Probe), host); await wait(50);
  check('first start (no cache): the list, and no background line', ready.ready && state.mods.length === 2 && ready.checking === false);
  ReactDOM.unmountComponentAtNode(host);

  answer = async ch => (ch === 'main/init' ? { error: 'WAD Directory is not set', data: null } : { data: null });
  failed = false;
  ReactDOM.render(React.createElement(Probe), host); await wait(50);
  check('nothing could be read: the screens are shown anyway (Settings)', ready.ready === true && failed === true);
  ReactDOM.unmountComponentAtNode(host);

  // ---- the window never flashes white -------------------------------------------------------
  const html = fs.readFileSync(APP + '/production.html', 'utf8');
  const main = fs.readFileSync(APP + '/electron/main.js', 'utf8');
  check('the window is dark from the first frame (backgroundColor) and the page has the same colour', /backgroundColor: '#0d0f12'/.test(main) && /background-color: #0d0f12/.test(html) && Startup.START_BACK === '#0d0f12');
  check('the window is shown when its first frame is ready (ready-to-show), and after 0.8 s at the latest', /show: false/.test(main) && /once\('ready-to-show'/.test(main) && /setTimeout\(showNow, 800\)/.test(main));
  check('the page shows the logo and the line before the program code has run', /id="boot"/.test(html) && /<svg/.test(html) && /boot-line/.test(html) && html.indexOf('id="boot"') < html.indexOf('renderer-bundle.js'));

  // ---- About: the start time ------------------------------------------------------------------
  answer = async ch => (ch === 'startup/last' ? { error: null, data: { window: 812, usable: 3104, file: '/d/startup-log.txt', marks: {} } } : { data: null });
  const { StoreContext } = require(APP + '/client/state');
  ReactDOM.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: initState, dispatch() {} } }, React.createElement(About))), host); await wait(80);
  const line = host.querySelector('[data-start-time]');
  check('About: "Start: window after 0.8 s, usable after 3.1 s." and a link to the log file', !!line && /Start: window after 0\.8 s, usable after 3\.1 s\./.test(line.textContent) && /Show the log file/.test(line.textContent));
  ReactDOM.unmountComponentAtNode(host);
  process.exit(0);
})().catch(e => { console.log('MISS crashed: ' + (e.stack || e)); process.exit(1); });
