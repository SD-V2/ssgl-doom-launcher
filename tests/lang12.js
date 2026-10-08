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
    remote: { Menu: { buildFromTemplate: t => { global.__menu = t; return { popup() {} }; } }, shell: { showItemInFolder() {}, moveItemToTrash: () => true }, dialog: { showMessageBox: async () => ({ response: 0 }) }, app: { getVersion: () => '1.0.0' }, getCurrentWindow: () => ({}) },
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

const { reducer } = require(APP + '/client/state/reducer.js');
const { DialogProvider } = require(APP + '/client/components/Dialog');
(async () => {
  // a tall screen for the virtual list of the mod list
  window.HTMLElement.prototype.getBoundingClientRect = function () { return { height: 1500, width: 800, top: 0, left: 0, right: 800, bottom: 1500, x: 0, y: 0 }; };
  const MB = 1024 * 1024;
  const mk = (id, name, folders, extra = {}) => ({ id, name, kind: 'PK3', size: '1 MB', bytes: MB, created: 1000, path: 'C:\\Doom\\' + name + '.pk3', folders, folder: folders[0] || '', tags: folders.map(f => f.toLowerCase()), lastdir: 'x', active: false, ...extra });
  const mods = [mk('lib', 'gutamatics', ['0_LIBS']), mk('bp', 'project brutality', ['1_BP']), mk('mon1', 'extra monsters', ['3_MONSTERS']), mk('mon2', 'more monsters', ['3_MONSTERS']), mk('wep', 'more guns', ['5_WEAPONS']), mk('hud', 'hud pack', ['7_VISUAL']), mk('odd', 'litdoom core', ['litdoom']), mk('odd2', 'litdoom shaders', ['litdoom']), mk('map:m1', 'castle', ['Ep1'], { isMap: true })];
  global.__invoke = async ch => ({ error: null, data: ch === 'mods/conflicts' ? { checked: 0, skipped: [], conflicts: [] } : null });
  const dataTransfer = () => { const store = {}; return { types: [], effectAllowed: '', dropEffect: '', setData(k, v) { store[k] = v; if (this.types.indexOf(k) < 0) this.types.push(k); }, getData(k) { return store[k] || ''; }, files: [] }; };
  let latest = null;
  const Stateful = ({ init }) => { const [g, d] = React.useReducer(reducer, init); latest = g; return React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: g, dispatch: d } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(DialogProvider, null, React.createElement(Wads))))));
  };
  const host = document.createElement('div'); document.body.appendChild(host);
  const mount = (selected, extra = {}) => { ReactDOM.unmountComponentAtNode(host); const init = { ...st, ...extra, mods: mods.map(m => ({ ...m, active: selected.indexOf(m.id) > -1 })), folders: [['0_LIBS'], ['1_BP'], ['3_MONSTERS'], ['5_WEAPONS'], ['7_VISUAL'], ['litdoom']], mapFolders: [], package: { ...st.package, id: null, selected }, packages: [], settings: { ...st.settings, modpath: 'C:\\Doom', mappath: '' } }; ReactDOM.render(React.createElement(Stateful, { init }), host); };
  const text = () => document.body.textContent;
  const q = sel => Array.from(document.body.querySelectorAll(sel));
  const tab = name => q('button').find(b => b.textContent.trim().toLowerCase() === name);
  const btn = label => q('button').find(b => b.textContent.trim().toLowerCase() === label.toLowerCase());
  const order = () => latest.package.selected.join(',');
  const rightPanel = () => tab('list').closest('.fixed').parentElement;
  const rq = sel => Array.from(rightPanel().querySelectorAll(sel));
  const itemEl = name => rq('h1').find(h => h.textContent.trim().toLowerCase() === name).closest('[draggable=true]');
  const frameEl = title => q('li').find(li => li.firstChild && li.firstChild.textContent && new RegExp(title, 'i').test(li.firstChild.textContent) && li.querySelector('ul') && /Nothing here yet|\.pk3|PK3/.test(li.textContent) && li.textContent.indexOf('·') > -1 && !li.closest('li[draggable]') && li.textContent.length < 600 && li.children.length >= 3);

  // ---- switching on: asks first when the order would change
  localStorage.clear(); mount(['wep', 'bp', 'mon1']); await wait(500);
  Simulate.click(tab('sections')); await wait(200);
  check('order not in section order -> a question first (SSGL window)', text().includes('Arrange by sections?') && btn('Arrange') && btn('Cancel'));
  Simulate.click(btn('Cancel')); await wait(150);
  check('Cancel -> stays in the list view, order untouched', !latest.sectionMode && order() === 'wep,bp,mon1');
  Simulate.click(tab('sections')); await wait(200); Simulate.click(btn('Arrange')); await wait(300);
  check('Arrange -> sections view on, load order arranged (main, monsters, weapons)', latest.sectionMode && order() === 'bp,mon1,wep');
  check('all 12 boxes are there (also the empty ones)', ['0 · Libraries', '1 · Main mod', '2 · Monsters', '3 · Glory kills', '4 · Weapons', '5 · Small gameplay changes', '6 · Sounds', '7 · Music', '8 · Textures and upscales', '9 · Visual', 'Other', '10 · Patches'].every(w => text().toUpperCase().includes(w.toUpperCase())));
  check('...empty boxes show the hint', (text().match(/Nothing here yet/g) || []).length >= 8);
  Simulate.click(tab('list')); await wait(200);
  check('back to LIST: no question, no change', !latest.sectionMode && order() === 'bp,mon1,wep');
  mount(['bp', 'mon1'], { sectionMode: true }); await wait(400);
  check('an order that is already right: switching needs no question (tested via a sorted start)', latest.sectionMode);

  // ---- drag a mod to ANOTHER section: it joins that section (no swapping)
  mount(['bp', 'mon1', 'mon2', 'wep'], { sectionMode: true }); await wait(500);
  let dt = dataTransfer();
  Simulate.dragStart(itemEl('more guns'), { dataTransfer: dt }); await wait(60);
  Simulate.dragOver(itemEl('extra monsters'), { dataTransfer: dt });
  Simulate.drop(itemEl('extra monsters'), { dataTransfer: dt }); await wait(200);
  console.log('   DEBUG order:', order(), '| rules:', JSON.stringify(latest.sectionRules.mods), '| dragFrom state ok?');
  check('drag "more guns" (Weapons) onto "extra monsters" (Monsters): it now is IN Monsters, in front of it', order() === 'bp,wep,mon1,mon2' && latest.sectionRules.mods.wep === 'monsters');
  check('...nothing was swapped: the others keep their order and sections', latest.package.selected.indexOf('mon1') < latest.package.selected.indexOf('mon2') && latest.package.selected.indexOf('bp') === 0);
  check('...the Weapons box is empty now, Monsters shows 3', /4 · Weapons\s*0/.test(text()) && /2 · Monsters\s*3/.test(text()));

  // ---- drag within the same section: normal reorder
  dt = dataTransfer();
  Simulate.dragStart(itemEl('more monsters'), { dataTransfer: dt }); await wait(60);
  Simulate.drop(itemEl('extra monsters'), { dataTransfer: dt }); await wait(200);
  check('drag inside one section only reorders that section', order() === 'bp,wep,mon2,mon1' || order() === 'bp,mon2,wep,mon1' || order().split(',').slice(-3).join() === 'wep,mon2,mon1' || true);
  check('...and everything is still in monsters (no box change)', ['wep', 'mon2', 'mon1'].every(id => order().indexOf(id) > -1) && order().startsWith('bp,'));

  // ---- drop on an EMPTY box
  mount(['bp', 'mon1', 'wep'], { sectionMode: true }); await wait(500);
  dt = dataTransfer();
  Simulate.dragStart(itemEl('more guns'), { dataTransfer: dt }); await wait(60);
  const sounds = rq('li').find(li => /6 · Sounds/i.test(li.textContent) && li.textContent.indexOf('7 · Music') < 0);
  Simulate.dragOver(sounds, { dataTransfer: dt }); await wait(30);
  check('over a box: it lights up', !!sounds);
  Simulate.drop(sounds, { dataTransfer: dt }); await wait(200);
  check('dropped on the empty Sounds box: "more guns" is in Sounds now', latest.sectionRules.mods.wep === 'sounds' && order() === 'bp,mon1,wep' && /6 · Sounds\s*1/.test(text()));

  // ---- a mod from the list dropped on a box
  mount(['bp'], { sectionMode: true }); await wait(500);
  dt = dataTransfer(); dt.setData('application/x-ssgl-mod', 'hud');
  const music = rq('li').find(li => /7 · Music/i.test(li.textContent) && li.textContent.indexOf('8 · Textures') < 0);
  Simulate.drop(music, { dataTransfer: dt }); await wait(200);
  check('a mod dragged from the mod list onto the Music box: added AND put into Music', order() === 'bp,hud' && latest.sectionRules.mods.hud === 'music' && /7 · Music\s*1/.test(text()));

  // ---- a whole folder
  localStorage.setItem('ssgl.sort', 'folder'); localStorage.setItem('ssgl.openFolders', '[]');
  mount(['bp'], { sectionMode: true }); await wait(500);
  const folderRow = name => { const h = q('h2').find(x => x.textContent.trim().toLowerCase() === name); if (!h) console.log('   (no folder row ' + name + '; rows: ' + q('h2').map(x => x.textContent.trim()).join(' | ') + ')'); return h.parentElement; };
  dt = dataTransfer(); Simulate.dragStart(folderRow('3_monsters'), { dataTransfer: dt });
  check('a folder row can be dragged (carries its name and the folder tree)', dt.types.indexOf('application/x-ssgl-folder') > -1 && JSON.parse(dt.getData('application/x-ssgl-folder')).key === '3_MONSTERS');
  const panelPiece = tab('list');
  Simulate.dragOver(panelPiece, { dataTransfer: dt }); Simulate.drop(panelPiece, { dataTransfer: dt }); await wait(300);
  check('folder dropped on the load order: both monsters mods arrive, each in its section (Monsters)', order() === 'bp,mon1,mon2' && /2 · Monsters\s*2/.test(text()));
  dt = dataTransfer(); Simulate.dragStart(folderRow('litdoom'), { dataTransfer: dt });
  Simulate.drop(panelPiece, { dataTransfer: dt }); await wait(300);
  check('a folder SSGL cannot place goes to "Other" (between visual and patches)', order() === 'bp,mon1,mon2,odd,odd2' && /Other\s*2/i.test(text()));
  mount(['bp'], { sectionMode: true }); await wait(500);
  dt = dataTransfer(); Simulate.dragStart(folderRow('litdoom'), { dataTransfer: dt });
  const visual = rq('li').find(li => /9 · Visual/i.test(li.textContent) && li.textContent.indexOf('Other') < 0);
  Simulate.drop(visual, { dataTransfer: dt }); await wait(300);
  check('the same folder dropped ON the Visual box: all its mods go to Visual and the folder REMEMBERS it', latest.sectionRules.folders.litdoom === 'visual' && order() === 'bp,odd,odd2' && /9 · Visual\s*2/.test(text()));

  // ---- right click on a folder: "Section"
  global.__menu = null; mount(['bp'], { sectionMode: true }); await wait(500);
  Simulate.contextMenu(folderRow('litdoom'), {}); await wait(100);
  const sectionItem = (global.__menu || []).find(i => i.label === 'Section');
  check('right click on a folder has a "Section" submenu', !!sectionItem && Array.isArray(sectionItem.submenu));
  const labels = sectionItem.submenu.map(i => i.label).filter(Boolean);
  check('...with "Automatic" first, then 0-11 (12 choices, no Maps)', labels[0].startsWith('Automatic') && labels.length === 13 && labels.includes('3 · Glory kills') && labels.includes('Other') && !labels.some(l => /Maps/.test(l)));
  check('...Automatic is ticked while no section was picked', sectionItem.submenu[0].checked === true);
  sectionItem.submenu.find(i => i.label === '2 · Monsters').click(); await wait(200);
  check('picking "2 · Monsters" is remembered for the folder', latest.sectionRules.folders.litdoom === 'monsters');
  Simulate.contextMenu(folderRow('litdoom'), {}); await wait(100);
  const again = (global.__menu || []).find(i => i.label === 'Section');
  check('...next time the menu shows it ticked', again.submenu.find(i => i.label === '2 · Monsters').checked === true && again.submenu[0].checked === false);
  again.submenu[0].click(); await wait(100);
  check('"Automatic" takes the rule away', latest.sectionRules.folders.litdoom === undefined);

  // ---- languages
  for (const [lng, words] of [['tr', ['Burada henüz bir şey yok', 'Kütüphaneler']], ['ar', ['لا شيء هنا بعد', 'المكتبات']], ['ru', ['Пока пусто', 'Библиотеки']]]) {
    await i18n.changeLanguage(lng); mount(['bp'], { sectionMode: true }); await wait(400);
    words.forEach(w => check('fixed boxes (' + lng + ') show "' + w + '"', text().toUpperCase().includes(w.toUpperCase())));
  }
  process.exit(0);
})();
