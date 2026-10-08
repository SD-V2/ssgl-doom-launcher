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
  const { default: themesAll } = require(APP + '/client/Theme/index.jsx');
  const { reducer, initState } = require(APP + '/client/state/reducer.js');
  const host = document.createElement('div'); document.body.appendChild(host);
  const render = (el, theme = themes.hell) => ReactDOM2.render(React.createElement(ThemeProvider, { theme }, React.createElement(React.Fragment, null, el)), host);
  const cssAll = () => Array.from(document.querySelectorAll('style')).map(n => n.textContent || (n.sheet ? Array.from(n.sheet.cssRules).map(r => r.cssText).join('\n') : '')).join('\n');

  // ---- the theme part
  const base = themes.hell;
  check('classic: the theme stays exactly the same object', styles.applyStyle(base, 'classic') === base && styles.applyStyle(base, undefined) === base && styles.applyStyle(base, 'banana') === base);
  const cy = styles.applyStyle(base, 'cyberpunk');
  check('cyberpunk: its own fonts (title + text), square corners, name of the style', /CyberHead/.test(cy.font.head) && /CyberText/.test(cy.font.content) && cy.border.radius === '0px' && cy.interfaceStyle === 'cyberpunk');
  check('...the colors of the theme are NOT touched (style and color theme are independent)', cy.color === base.color && cy.border.active === base.border.active && cy.font.glow === base.font.glow);
  check('...and the original theme is not changed', base.font.head === "'Michroma', sans-serif" && base.border.radius === '3px');
  check('...works on every color theme (all of them keep their own accent)', Object.keys(themesAll).every(k => styles.applyStyle(themesAll[k], 'cyberpunk').color.active === themesAll[k].color.active));
  check('a color theme "Neon" (yellow + cyan) exists for the cyberpunk look', themesAll.neon && themesAll.neon.color.active.toLowerCase() === '#fcee0a' && themesAll.neon.color.glow.toLowerCase() === '#00f0ff');
  check('a color theme "Night City": cyan lines, red as the second accent', themesAll.nightcity && themesAll.nightcity.color.active.toLowerCase() === '#2dd4e8' && themesAll.nightcity.color.second.toLowerCase() === '#ff2d46');
  check('every color theme has a second accent (or falls back to its glow)', Object.keys(themesAll).every(k => !!(themesAll[k].color.second || themesAll[k].color.glow)));
  check('themes without their own second color use the glow color (Neon: cyan, Hell: red)', themesAll.neon.color.second === themesAll.neon.color.glow && themesAll.hell.color.glow.toLowerCase() === '#ff0000');
  check('rgba(): hex colors, short hex, wrong text', styles.rgba('#ffa800', 0.5) === 'rgba(255, 168, 0, 0.5)' && styles.rgba('#fa0', 1) === 'rgba(255, 170, 0, 1)' && /^rgba\(255, 168, 0, 0\.3\)$/.test(styles.rgba('banana', 0.3)));
  check('the list of styles', styles.STYLES.join() === 'classic,cyberpunk,gothic');

  // ---- the style sheet
  render(React.createElement(styles.StyleLayer, { style: 'classic' }));
  const before = cssAll();
  check('classic: no extra style sheet', !/ssgl-panel/.test(before) && !/CyberText/.test(before.replace(/@font-face[^}]*}/g, '')));
  render(React.createElement(styles.StyleLayer, { style: 'cyberpunk' }), cy);
  const css = cssAll().replace(/\s+/g, ' ');
  check('cyberpunk: the style sheet is there and reaches all parts (panel, item, folder, section, button, input, tabs, modal, nav)', ['ssgl-panel', 'ssgl-item', 'ssgl-folder', 'ssgl-section', 'ssgl-button', 'ssgl-input', 'ssgl-tabs', 'ssgl-modal', 'ssgl-nav'].every(c => css.includes(c)));
  const flat = css.replace(/\s+/g, '');
  check('...cut corners, scanlines, the colors of the theme (accent as rgba)', /clip-path:polygon/.test(flat) && /repeating-linear-gradient\(0deg/.test(flat) && /rgba\(255,168,0,0\.\d+\)/.test(flat));
  check('...stronger than normal component styles ("html body .ssgl-x")', /html body \.ssgl-button/.test(css));
  // things that can hold a dropdown must never be clipped (the list of a dropdown sticks out of them and would be hidden AND not clickable)
  const rules = (css.match(/[^{}]+\{[^{}]*\}/g) || []);
  ['ssgl-input', 'ssgl-panel', 'ssgl-modal'].forEach(c => {
    const own = rules.filter(r => r.split('{')[0].includes('.' + c));
    check('no clip-path on ".' + c + '" (' + own.length + ' rules checked) - dropdown lists stay visible and clickable', own.length > 0 && own.every(r => !/clip-path/.test(r)));
  });
  // mouse pointer and keyboard frame
  const cursorOk = c => /html body, ?html body \* ?\{ ?cursor: ?url\("data:image\/svg\+xml,[^"]+"\) \d+ \d+, ?default ?!important/.test(c.replace(/\s+/g, ' ')) && /cursor: ?url\("data:image\/svg\+xml,[^"]+"\) \d+ \d+, ?pointer ?!important/.test(c) && /input\[type='text'\], ?html body textarea ?\{ ?cursor: ?text ?!important/.test(c.replace(/\s+/g, ' '));
  check('cyberpunk: its own mouse pointer (arrow everywhere, a target over things you can click, the normal text cursor in text boxes)', cursorOk(css));
  // the shapes of the two Cyberpunk pointers (chosen: neon arrow with a data trail, neon hand)
  const urlsOf = c => (c.match(/cursor: ?url\("(data:image\/svg\+xml,[^"]+)"\) (\d+) (\d+), ?(default|pointer)/g) || []).map(x => { const m = x.match(/url\("(data:image\/svg\+xml,[^"]+)"\) (\d+) (\d+), ?(\w+)/); return { svg: decodeURIComponent(m[1].replace('data:image/svg+xml,', '')), x: +m[2], y: +m[3], kind: m[4] }; });
  const cp = urlsOf(css);
  const cpArrow = cp.find(c => c.kind === 'default'), cpHand = cp.find(c => c.kind === 'pointer');
  check('cyberpunk arrow: neon arrow (glow + colored line + white-hot line), no still squares in the picture (the live trail draws them), hotspot at the tip (3, 3)', !!cpArrow && cpArrow.x === 3 && cpArrow.y === 3 && (cpArrow.svg.match(/<rect/g) || []).length === 0 && /stroke-opacity='0\.3'/.test(cpArrow.svg) && /#eafcff/.test(cpArrow.svg) && /M3 3 L3 24/.test(cpArrow.svg));
  check('cyberpunk hand: a neon pointing hand with a small square on the finger tip, hotspot at the finger tip (13, 3)', !!cpHand && cpHand.x === 13 && cpHand.y === 3 && /M12 3\.2/.test(cpHand.svg) && (cpHand.svg.match(/<rect/g) || []).length === 1 && /#eafcff/.test(cpHand.svg));
  check('cyberpunk pointers use the colors of the theme (accent 255,168,0 -> #ffa800 lines, second color for the square on the hand)', /stroke='#ffa800'/i.test(cpArrow.svg) && /stroke='#ffa800'/i.test(cpHand.svg) && /fill='#ff0000'/i.test(cpHand.svg));
  check('the pointer pictures are 32 x 32 (the size browsers accept) and everything stays inside', /width='32' height='32' viewBox='0 0 32 32'/.test(cpArrow.svg) && /width='32' height='32' viewBox='0 0 32 32'/.test(cpHand.svg));
  check('cyberpunk: a frame for keyboard use only (shows when html has data-keyboard)', /html\[data-keyboard\] body button:focus/.test(css) && /html\[data-keyboard\] body \.ssgl-input:focus-within/.test(css) && /outline: ?2px solid/.test(css));
  // windows are placed by SSGL with position: absolute - the style must never change that
  const modalRules = rules.filter(r => r.split('{')[0].includes('.ssgl-modal') && !r.split('{')[0].includes('::'));   // (the small decorations ::before / ::after have their own position)
  check('no "position" in the rules of ".ssgl-modal" (' + modalRules.length + ' rules) - windows stay where SSGL puts them', modalRules.length > 0 && modalRules.every(r => !/(^|[;{\s])position\s*:/.test(r.split('{')[1])));
  // the style may not change how big or where things are, only how they look
  const layoutProps = /(^|[;{\s])(width|height|top|left|right|bottom|margin[a-z-]*|display|float)\s*:/;
  const hooked = rules.filter(r => /\.ssgl-(modal|panel|input|item|button|section|folder|tabs|nav)(?![a-z-])[^{]*$/.test(r.split('{')[0].trim()) && !/::(before|after)/.test(r.split('{')[0]));
  check('the main rules of the style (' + hooked.length + ') change no size, place or display - only looks', hooked.length > 5 && hooked.every(r => !layoutProps.test(r.split('{')[1])));
  render(React.createElement(styles.StyleLayer, { style: 'classic' }));
  check('back to classic: the style sheet is removed again', !/html body \.ssgl-panel/.test(cssAll()));

  // ---- the Gothic style: the same safety rules, and a clean style sheet
  const gothTheme = styles.applyStyle(themesAll.bloodmoon, 'gothic');
  check('gothic: its own fonts (title + text), square corners, colors untouched', /GothHead/.test(gothTheme.font.head) && /GothText/.test(gothTheme.font.content) && gothTheme.border.radius === '0px' && gothTheme.interfaceStyle === 'gothic' && gothTheme.color === themesAll.bloodmoon.color);
  check('a color theme "Blood Moon": antique gold, red second accent', themesAll.bloodmoon && themesAll.bloodmoon.color.active.toLowerCase() === '#d9b25f' && themesAll.bloodmoon.color.second.toLowerCase() === '#b8212e');
  render(React.createElement(styles.StyleLayer, { style: 'gothic' }), gothTheme);
  const gcss = cssAll();
  const gflat = gcss.replace(/\s+/g, ' ');
  const grules = (gcss.match(/[^{}]+\{[^{}]*\}/g) || []);
  check('gothic: the sheet reaches all parts (panel, item, folder, section, button, input, tabs, modal, nav)', ['ssgl-panel', 'ssgl-item', 'ssgl-folder', 'ssgl-section', 'ssgl-button', 'ssgl-input', 'ssgl-tabs', 'ssgl-modal', 'ssgl-nav'].every(c => gflat.includes(c)));
  check('gothic: the sheet is not garbled (no selector glued to the next rule, braces balance)', !/::(before|after)\s+(body|html|\.)/.test(gflat) && (gcss.match(/\{/g) || []).length === (gcss.match(/\}/g) || []).length);
  const dataUrls = gcss.match(/url\("data:[^"]*"\)/g) || [];
  check('gothic: the pictures in the sheet (' + dataUrls.length + ') contain no ; \' ( ) or // (the CSS tool would cut them there)', dataUrls.length >= 5 && dataUrls.every(u => !/[;'()]/.test(u.slice(5, -2)) && !/\/\//.test(u.slice(5, -2))));
  ['ssgl-input', 'ssgl-panel', 'ssgl-modal'].forEach(c => {
    const own = grules.filter(r => r.split('{')[0].includes('.' + c));
    check('gothic: no clip-path on ".' + c + '" (' + own.length + ' rules)', own.length > 0 && own.every(r => !/clip-path/.test(r)));
  });
  const gModal = grules.filter(r => r.split('{')[0].includes('.ssgl-modal') && !r.split('{')[0].includes('::'));
  check('gothic: no "position" in the rules of ".ssgl-modal" (' + gModal.length + ' rules)', gModal.length > 0 && gModal.every(r => !/(^|[;{\s])position\s*:/.test(r.split('{')[1])));
  const gHooked = grules.filter(r => /\.ssgl-(modal|panel|input|item|button|section|folder|tabs|nav)(?![a-z-])[^{]*$/.test(r.split('{')[0].trim()) && !/::(before|after)/.test(r.split('{')[0]));
  check('gothic: the main rules (' + gHooked.length + ') change no size, place or display - only looks', gHooked.length > 5 && gHooked.every(r => !layoutProps.test(r.split('{')[1])));
  check('gothic: its own mouse pointer (a dagger; a lit dagger over things you can click)', cursorOk(gcss));
  check('gothic: a frame for keyboard use only', /html\[data-keyboard\] body button:focus/.test(gcss) && /outline: ?1px solid/.test(gcss));
  render(React.createElement(styles.StyleLayer, { style: 'classic' }));
  check('gothic -> classic: the sheet is removed again (no pointer, no keyboard frame left)', !/html body \.ssgl-panel/.test(cssAll()) && !/data-keyboard/.test(cssAll()));

  // ---- the font files: exact weights, never a range (a range wins over the exact faces and the Latin letters fall back to a plain font)
  const fsMod = require('fs');
  const globalCss = fsMod.readFileSync(APP + '/client/global.css', 'utf8');
  const faceBlocks = globalCss.match(/@font-face\s*\{[^}]*\}/g) || [];
  ['CyberText', 'CyberHead', 'GothText', 'GothHead'].forEach(fam => {
    const mine = faceBlocks.filter(b => b.includes("'" + fam + "'"));
    check('font "' + fam + '": ' + mine.length + ' faces, none with a weight range', mine.length >= 4 && mine.every(b => !/font-weight:\s*\d+\s+\d+/.test(b)));
  });
  const fontFiles = (globalCss.match(/assets\/fonts\/[A-Za-z0-9_.-]+\.woff/g) || []).map(f => f.replace('assets/fonts/', ''));
  check('every font file named in global.css exists (' + fontFiles.length + ' files)', fontFiles.every(f => fsMod.existsSync(APP + '/client/assets/fonts/' + f)));

  // ---- the hook classes are on the real parts (and normal classes are kept)
  const { Box } = require(APP + '/client/components');
  const Button = require(APP + '/client/components/Form/Button.jsx').default;
  const Input = require(APP + '/client/components/Form/Input.jsx').default;
  const TabSwitch = require(APP + '/client/components/Mods/TabSwitch.jsx').default;
  const SectionFrame = require(APP + '/client/components/Mods/SectionFrame.jsx').default;
  const Tag = require(APP + '/client/components/Mods/TagList.jsx').default;
  const cls = el => { render(el); const e = host.querySelector('[class]'); return e ? e.className : ''; };
  check('Box has "ssgl-panel"', /ssgl-panel/.test(cls(React.createElement(Box, null, 'x'))));
  check('Button has "ssgl-button" and keeps a class that is given to it', (() => { const c = cls(React.createElement(Button, { className: 'mine', onClick() {} }, 'ok')); return /ssgl-button/.test(c) && /mine/.test(c); })());
  check('Button without a class: "ssgl-button" and no "undefined"', (() => { const c = cls(React.createElement(Button, { onClick() {} }, 'ok')); return /ssgl-button/.test(c) && !/undefined/.test(c); })());
  check('Input has "ssgl-input"', /ssgl-input/.test(cls(React.createElement(Input, { name: 'a', value: 'x', onChange() {} }))));
  check('TabSwitch has "ssgl-tabs"', /ssgl-tabs/.test(cls(React.createElement(TabSwitch, { tabs: [{ value: 'a', label: 'A' }], value: 'a', onChange() {} }))));
  check('SectionFrame has "ssgl-section"', /ssgl-section/.test(cls(React.createElement(SectionFrame, { title: 'T' }))));
  check('a tag keeps its own classes next to "ssgl-tag"', (() => { render(React.createElement(Tag, { item: { id: 1, tags: ['x'] }, onTag: () => () => {} })); const li = host.querySelector('li.ssgl-tag'); return !!li && /clickable/.test(li.className); })());

  // ---- Settings: the dropdown, live look, going back
  const Settings = require(APP + '/client/views/Settings.jsx').default;
  const { Simulate } = require(APP + '/node_modules/react-dom/test-utils');
  const wait2 = ms => new Promise(r => setTimeout(r, ms));
  const events = [];
  const stSet = { ...st, packages: [], settings: { ...st.settings, style: 'classic', modpath: 'C:\\w' } };
  const mountSet = () => ReactDOM2.render(React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: stSet, dispatch: a => events.push(a) } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Settings))))), host);
  mountSet(); await wait2(400);
  const hidden = document.body.querySelector('input[name=style]');
  check('Settings: "Interface style" dropdown right under the color theme, value Classic', !!hidden && hidden.value === 'classic' && /Interface style/i.test(document.body.textContent));
  const order = Array.from(document.body.querySelectorAll('label, span')).map(x => x.textContent.trim().toLowerCase()).filter(x => ['color theme', 'interface style', 'update notifier'].includes(x));
  check('...the order on the screen: color theme, interface style, update notifier', order.indexOf('color theme') < order.indexOf('interface style') && order.indexOf('interface style') < order.indexOf('update notifier'));
  Simulate.focus(hidden.parentElement.querySelector('input[type=text]')); await wait2(120);
  const opts = Array.from(document.body.querySelectorAll('li')).map(li => li.textContent.trim()).filter(x => ['Classic', 'Cyberpunk', 'Gothic'].includes(x));
  check('...choices: Classic, Cyberpunk and Gothic', opts.join() === 'Classic,Cyberpunk,Gothic');
  events.length = 0; Simulate.click(Array.from(document.body.querySelectorAll('li')).find(li => li.textContent.trim() === 'Cyberpunk')); await wait2(200);
  const prev = events.filter(e => e.type === 'settings/preview').pop();
  check('choosing Cyberpunk shows the style at once (a first look, not saved yet)', prev && prev.data.style === 'cyberpunk' && !events.some(e => e.type === 'settings/save'));
  events.length = 0; ReactDOM2.unmountComponentAtNode(host); await wait2(50);
  const back = events.filter(e => e.type === 'settings/preview').pop();
  check('leaving Settings without saving puts the saved style back (Classic)', back && back.data.style === 'classic');

  // ---- the state
  check('the setting exists and starts with Classic', initState.settings.style === 'classic');
  check('preview changes only the style', (() => { const r = reducer(initState, { type: 'settings/preview', data: { style: 'cyberpunk' } }); return r.settings.style === 'cyberpunk' && r.settings.theme === initState.settings.theme; })());

  // ---- languages
  for (const [lng, words] of [['tr', ['Arayüz stili', 'Klasik']], ['ar', ['نمط الواجهة', 'كلاسيكي']], ['ru', ['Стиль интерфейса', 'Классический']]]) {
    await i18n.changeLanguage(lng); mountSet(); await wait2(300);
    words.forEach(w => check('Settings (' + lng + ') shows "' + w + '"', document.body.textContent.includes(w) || Array.from(document.body.querySelectorAll('input')).some(i => i.value === w)));
    ReactDOM2.unmountComponentAtNode(host);
  }
  process.exit(0);
})();
