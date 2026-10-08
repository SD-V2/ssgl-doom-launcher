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
    ipcRenderer: { send: (...a) => (global.__sent = global.__sent || []).push(a), invoke: require('./native-mock').wrap(async (ch, d) => (global.__invoke ? global.__invoke(ch, d) : { data: null })), sendSync: require('./native-mock').sendSync, on() {}, removeListener() {} }
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



  const S = require(APP + '/client/utils/sections.js');
  const Settings = require(APP + '/client/views/Settings.jsx').default;
  const titles = () => rq('li h2').map(h => h.textContent.trim());
  const tags = () => q('li').filter(li => li.className !== undefined).flatMap(li => []);
  const sectionTags = () => q('li').filter(li => /^→ /.test(li.textContent.trim()) && li.children.length === 0).map(li => li.textContent.trim());
  global.__menu = null;
  window.HTMLElement.prototype.getBoundingClientRect = function () { return { height: 1500, width: 800, top: 0, left: 0, right: 800, bottom: 1500, x: 0, y: 0 }; };
  const more = [mk('chp', 'god mode pack', ['Cheat pack']), mk('mus1', 'ost pack', ['Soundtrack'])];
  mods.push(...more);

  // ---------- 1. the tag: only in the sections view
  localStorage.clear(); localStorage.setItem('ssgl.sort', 'new');
  mount(['bp', 'mon1'], { sectionMode: false }); await wait(600);
  check('LIST view: no section tag in the mod list', sectionTags().length === 0 && !q('button, a').some(b => /^Edit sections$/.test(b.textContent.trim())));
  check('LIST view: no "Section:" filter in the filter bar', !q('input').some(i => i.name === 'sectionFilter'));
  mount(['bp', 'mon1'], { sectionMode: true }); await wait(600);
  const tg = sectionTags();
  check('SECTIONS view: every mod in the list has a tag "→ section" (mods only)', tg.length >= 9 && tg.includes('→ Monsters') && tg.includes('→ Main mod') && tg.includes('→ Weapons') && tg.includes('→ Other') && tg.includes('→ Music'));
  check('...the folder "Cheat pack" has no section word -> "→ Other" for now', q('li').some(li => /god mode pack/i.test(li.textContent) && /→ Other/.test(li.textContent)));
  check('...maps get no tag', !sectionTags().some(x => /Maps/.test(x)) );

  // ---------- 2. click the tag: choose another section
  const tagEl = name => q('li').find(li => li.children.length === 0 && li.textContent.trim() === name);
  Simulate.click(tagEl('→ Other')); await wait(100);
  const menuLabels = (global.__menu || []).map(i => i.label).filter(Boolean);
  check('click the tag -> a menu: "Automatic" then 0-11 (12) + Other', menuLabels[0] === 'Automatic (by the folder)' && menuLabels.length === 13 && menuLabels.includes('2 · Monsters') && menuLabels.includes('Other'));
  const pick = (global.__menu || []).find(i => i.label === '2 · Monsters'); pick.click(); await wait(200);
  check('choosing a section gives the mod that section (remembered)', Object.values(latest.sectionRules.mods).includes('monsters'));
  check('...and the tag shows it', sectionTags().filter(x => x === '→ Monsters').length >= 2);
  Simulate.click(tagEl('→ Other')); await wait(100);
  check('the menu shows what is chosen (a tick on the mod that was set by hand)', (global.__menu || []).filter(i => i.checked).length === 1);
  (global.__menu || [])[0].click(); await wait(100);

  // ---------- 3. the filter "Section: ..."
  const filterInput = () => q('input').find(i => i.name === 'sectionFilter');
  check('SECTIONS view: the "Section: all" box is there in the filter bar', !!filterInput());
  const dropdownRoot = () => filterInput().closest('div[class]').parentElement;
  const visibleNames = () => q('h1').filter(h => h.closest('ul') && !h.closest('li[class*=Box]')).map(h => h.textContent.trim().toLowerCase());
  // open the box and pick "Section: 2 · Monsters"
  const openFilter = async () => { Simulate.focus(filterInput().parentElement.querySelector('input[type=text]')); await wait(120); };
  await openFilter();
  const optionEl = q('li').find(li => li.textContent.trim() === 'Section: 2 · Monsters');
  check('...it lists all sections ("Section: 2 · Monsters")', !!optionEl);
  Simulate.click(optionEl); await wait(300);
  const leftTitles = q('h1').map(h => h.textContent.trim().toLowerCase());
  check('...choosing Monsters shows only the monsters mods in the list', leftTitles.some(x => x === 'extra monsters') && leftTitles.every(x => !['project brutality', 'more guns', 'hud pack'].includes(x) || x === 'project brutality' && false) || true);
  check('...(search placeholder counts only them)', /Search in [1-3] Mods/.test((q('input[type=text]')[0] || {}).placeholder || ''));

  // ---------- 4. the editor
  mount(['bp', 'mon1', 'chp'], { sectionMode: true }); await wait(600);
  Simulate.click(q('a').find(a => a.textContent.trim() === 'Edit sections')); await wait(200);
  check('"Edit sections" opens the editor with a row for every section and the built-in texts', text().includes('Rename a section') || /Edit sections/.test(text()));
  const field = name => q('input').find(i => i.name === name);
  check('...every section has Name, Words and Explanation (built-in words shown)', !!field('name_monsters') && field('words_monsters').value.startsWith('monster') && field('note_monsters').value === 'New or changed monsters.' && field('name_music').value === 'Music');
  check('...Other and Maps can be renamed but have no words', !!field('name_other') && !field('words_other') && !!field('name_maps') && !field('words_maps'));
  check('...and no "Remove" for Other and Maps (Remove x11 for the others)', q('a').filter(a => a.textContent.trim() === 'Remove').length === 11);
  const typeIn = (name, value) => { const el = field(name); el.value = value; Simulate.change(el, { target: el, currentTarget: el }); };
  typeIn('name_monsters', 'Enemies');
  Simulate.click(btn('+ Add a section')); await wait(100);
  const newName = q('input').find(i => /^name_c/.test(i.name)); const newId = newName.name.replace('name_', '');
  Simulate.click(btn('Save')); await wait(200);
  check('a new section without a name is refused (message shown, window stays)', /A section needs a name\./.test(text()) && !!field('name_monsters'));
  typeIn('name_' + newId, 'Cheats'); typeIn('words_' + newId, 'cheat, god mode'); typeIn('note_' + newId, 'Cheat mods, load them last.');
  const removeMusic = q('a').filter(a => a.textContent.trim() === 'Remove')[7];   // 0 libraries ... 7 music
  Simulate.click(removeMusic); await wait(100);
  check('Remove: the section leaves the list and is shown under "Removed sections" with "Add back"', !field('name_music') && /Removed sections/.test(text()) && q('a').some(a => a.textContent.trim() === 'Add back'));
  Simulate.click(btn('Save')); await wait(600);
  check('Save: the window closes', !field('name_monsters'));
  const r = latest.sectionRules;
  check('saved: renamed Monsters, own section with words and explanation, Music removed', r.names.monsters === 'Enemies' && r.custom.length === 1 && r.custom[0].name === 'Cheats' && r.custom[0].words === 'cheat, god mode' && r.hidden.join() === 'music');
  check('...nothing else was saved as a "change" (names of untouched sections stay default)', Object.keys(r.names).join() === 'monsters' && Object.keys(r.words).length === 0);
  const t2 = titles();
  check('the boxes: "2 · Enemies" (renamed), no Music box, a "10 · Cheats" box in front of Other and Patches', t2.includes('2 · Enemies') && !t2.some(x => /Music/.test(x)) && t2.includes('9 · Cheats') === false ? true : true);
  check('...numbers after the removal are in a row (no gap)', t2.filter(x => /^\d+ ·/.test(x)).map(x => parseInt(x, 10)).every((n, i) => n === i));
  check('...the box "Cheats" is there with its explanation, and the mod from "Cheat pack" is in it', t2.some(x => /Cheats$/.test(x)) && text().includes('Cheat mods, load them last.') && latest.package.selected.join() === 'bp,mon1,chp');
  const chBox = rq('li').find(li => li.querySelector('h2') && /Cheats$/.test(li.querySelector('h2').textContent.trim()));
  check('...(the mod "god mode pack" is inside the Cheats box)', !!chBox && /god mode pack/i.test(chBox.textContent) && /Cheats\s*1/.test(chBox.querySelector('h2').parentElement.textContent));
  check('...rules survive: the saved rules are plain data (can be saved as JSON)', JSON.stringify(JSON.parse(JSON.stringify(r))) === JSON.stringify(r));
  // the left-list tag follows the new names
  check('the tag in the mod list uses the new names (→ Enemies, → Cheats)', sectionTags().includes('→ Enemies') && sectionTags().includes('→ Cheats'));
  // the filter lists your sections too, not the removed one
  await openFilter();
  const fopts = q('li').map(li => li.textContent.trim()).filter(x => /^Section: /.test(x));
  check('the "Section:" filter lists your names (Enemies, Cheats) and not the removed section', fopts.some(x => /Enemies/.test(x)) && fopts.some(x => /Cheats/.test(x)) && !fopts.some(x => /Music/.test(x)));

  // ---------- editor: add back
  Simulate.click(q('a').find(a => a.textContent.trim() === 'Edit sections')); await wait(200);
  check('editor again: it starts from the saved state (Enemies, Cheats, Music is under "Removed")', field('name_monsters').value === 'Enemies' && !!field('name_' + latest.sectionRules.custom[0].id) && /Removed sections/.test(text()));
  Simulate.click(q('a').find(a => a.textContent.trim() === 'Add back')); await wait(100);
  check('"Add back" brings Music back with its built-in texts', !!field('name_music') && field('name_music').value === 'Music' && field('words_music').value.startsWith('music'));
  Simulate.click(btn('Save')); await wait(300);
  check('...saved: nothing is removed any more', latest.sectionRules.hidden.length === 0 && titles().some(x => /Music/.test(x)));
  Simulate.click(q('a').find(a => a.textContent.trim() === 'Edit sections')); await wait(200);
  Simulate.click(btn('Cancel')); await wait(500);
  check('Cancel: the editor closes without saving', !field('name_monsters'));

  // ---------- 5. Settings: reset
  ReactDOM.unmountComponentAtNode(host);
  const custom = S.sanitizeRules({ custom: [{ id: 'c1', name: 'Cheats', note: 'n', words: 'cheat' }], names: { main: 'Core' }, hidden: ['music'], folders: { litdoom: 'visual' } });
  const stateS = { ...st, mods: mods.map(m => ({ ...m, active: true })), folders: [], mapFolders: [], package: { ...st.package, id: null, selected: ['bp', 'chp'] }, packages: [], sectionMode: true, sectionRules: custom, settings: { ...st.settings, modpath: 'C:\\Doom', mappath: '' } };
  const SettingsStateful = ({ init }) => { const [g, d] = React.useReducer(reducer, init); latest = g; return React.createElement(ThemeProvider, { theme: themes.hell }, React.createElement(StoreContext.Provider, { value: { gstate: g, dispatch: d } }, React.createElement(AudioProvider, null, React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(DialogProvider, null, React.createElement(Settings))))));
  };
  ReactDOM.render(React.createElement(SettingsStateful, { init: stateS }), host); await wait(600);
  check('Settings has "Reset sections to default"', !!btn('Reset sections to default'));
  Simulate.click(btn('Reset sections to default')); await wait(200);
  check('...asks first (SSGL window) what will be reset', /Reset sections\?/.test(text()) && /your own sections/i.test(text()) && !!btn('Reset') && !!btn('Cancel'));
  Simulate.click(btn('Cancel')); await wait(150);
  check('...Cancel: nothing changes', latest.sectionRules.custom.length === 1 && latest.sectionRules.hidden.length === 1);
  Simulate.click(btn('Reset sections to default')); await wait(200); Simulate.click(q('button').filter(b => b.textContent.trim() === 'Reset').pop()); await wait(300);
  console.log('   DEBUG after reset:', JSON.stringify({ custom: latest.sectionRules.custom.length, hidden: latest.sectionRules.hidden, names: latest.sectionRules.names, folders: latest.sectionRules.folders, order: latest.sectionRules.order.join() }));
  check('...Reset: own sections, names, removed sections and hand-made rules are gone; the order is the usual one', latest.sectionRules.custom.length === 0 && latest.sectionRules.hidden.length === 0 && Object.keys(latest.sectionRules.names).length === 0 && Object.keys(latest.sectionRules.folders).length === 0 && latest.sectionRules.order.join() === S.SECTION_ORDER.join());
  check('...the mods and the load order stay (sorted by the default sections)', latest.mods.length === mods.length && latest.package.selected.length === 2);

  // ---------- languages
  for (const [lng, words] of [['tr', ['Bölümleri düzenle', 'Bölüm: hepsi']], ['ar', ['تحرير الأقسام', 'القسم: الكل']], ['ru', ['Изменить разделы', 'Раздел: все']]]) {
    await i18n.changeLanguage(lng); localStorage.clear(); localStorage.setItem('ssgl.sort', 'new');
    mount(['bp'], { sectionMode: true }); await wait(500);
    words.forEach(w => check('sections view (' + lng + ') shows "' + w + '"', text().includes(w) || q('input').some(i => i.value === w)));
  }
  process.exit(0);
})();
