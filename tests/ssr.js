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

const render = () => renderToString(
  React.createElement(ThemeProvider, { theme: themes.hell },
    React.createElement(StoreContext.Provider, { value: { gstate: state, dispatch() {} } },
      React.createElement(AudioProvider, null,
        React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } },
          React.createElement(Wads))))));
let html;
try { html = render(); } catch (e) { console.log('RENDER FAILED:', e.stack.split('\n').slice(0, 8).join('\n')); process.exit(1); }
const has = (label, needle) => console.log((html.includes(needle) ? 'OK  ' : 'MISS') + ' ' + label);
has('stats bar mod count', '4 mods');
has('stats bar: Tools menu link', 'Tools');
has('notes bar shown', 'Load brutal first!');
has('mod name in list', 'root');
has('star/folder/trash titles', 'Move to Recycle Bin');
has('load order item (brutal)', 'brutal');
console.log('html length', html.length);

// ---- second pass: folder view, duplicates modal, package modal
localStorage.setItem('ssgl.sort', 'folder');
localStorage.setItem('ssgl.openFolders', JSON.stringify(['1_BP']));
html = render();
has('folder row: 1_BP', '1_BP');
has('folder row: add-all button', 'Add all to load order');
has('folder row: remove-all (has active mod)', 'Remove all from load order');
console.log('size snippets:', (html.match(/\d+(\.\d+)? ?[kMG]?B/g) || []).slice(0,8).join(' | '));
has('folder row: size shown', ' · 8');
has('subfolder row inside 1_BP', '>A<');
has('collapsed folder 2_GK present', '2_GK');

const { DuplicatesModal } = require(APP + '/client/components');
const dm = renderToString(React.createElement(ThemeProvider, { theme: themes.hell },
  React.createElement(DuplicatesModal, { active: true, onClose() {}, modpath: '/w',
    duplicates: state.duplicates, versions: state.versions, onShow: () => () => {}, onDelete: () => () => {} })));
console.log((dm.includes('Exact duplicates') && dm.includes('a/dup.pk3') && dm.includes('Possible different versions') ? 'OK  ' : 'MISS') + ' duplicates modal content');

const PackageModal = require(APP + '/client/components/PackageAreaNew/PackageModal.jsx').default;
const pm = renderToString(React.createElement(ThemeProvider, { theme: themes.hell },
  React.createElement(StoreContext.Provider, { value: { gstate: state, dispatch() {} } },
    React.createElement(PackageModal, { active: true, toggle() {}, setForm() {}, onSubmit() {}, onCancel() {},
      form: { name: 'P', iwad: '', sourceport: '', cover: '', userparams: '', notes: 'remember me' } }))));
console.log((pm.includes('remember me') && pm.includes('<textarea') ? 'OK  ' : 'MISS') + ' package modal notes textarea');

// ---- third pass: NEW badge, compact rows, sort-by-folder link
localStorage.clear();
localStorage.setItem('ssgl.firstSeen', JSON.stringify({ brutal5000: 0, sub13000: 0, glory2000: 0 })); // 'root1000' unseen -> new
state.settings = { ...state.settings, compactList: true };
html = render();
has('NEW badge on unseen mod', '>new<');
const newCount = (html.match(/>new</g) || []).length;
console.log((newCount === 1 ? 'OK  ' : 'MISS') + ' exactly one NEW badge (' + newCount + ')');
has('sort-by-folder link (2 in load order)', 'Sort by folder');
has('check-conflicts link (2 in load order)', 'Check conflicts');
has('compact rows: list items are 45px high', 'height:45px');
state.settings = { ...state.settings, compactList: false };
html = render();
has('normal rows: list items are 77px high', 'height:77px');
const fs2 = require('fs');
has_src = (label, file, needle) => console.log((fs2.readFileSync(APP + file, 'utf8').includes(needle) ? 'OK  ' : 'MISS') + ' ' + label);
has_src('recent option in sort menu', '/client/components/ModFilter/index.jsx', "value: 'recent'");
has_src('recent label translated', '/client/locales/en.js', "recent: 'Recently added'");

try {
  const Settings = require(APP + '/client/views/Settings.jsx').default;
  const sh = renderToString(React.createElement(ThemeProvider, { theme: themes.hell },
    React.createElement(StoreContext.Provider, { value: { gstate: state, dispatch() {} } },
      React.createElement(AudioProvider, null,
        React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Settings))))));
  console.log((sh.includes('Compact mod list') ? 'OK  ' : 'MISS') + ' settings: compact checkbox');
  console.log((sh.includes('Refresh mod list automatically') ? 'OK  ' : 'MISS') + ' settings: auto-refresh checkbox');
} catch (e) { console.log('MISS settings render failed: ' + e.message.slice(0, 120)); }

try {
  const { ConflictsModal } = require(APP + '/client/components');
  const result = { checked: 3, skipped: [{ id: 's', name: 'old.pk7', code: 'unsupported', detail: '7z' }, { id: 'p', name: 'x.deh', code: 'patch', detail: '' }],
    conflicts: [{ a: 'modA', aName: 'Brutal', b: 'modB', bName: 'Weapons', count: 3, groups: [{ label: 'Shotgun', count: 2 }, { label: 'Scripts & data files', count: 1 }], sample: ['sprites/SHTGA0'] }] };
  const mk = props => renderToString(React.createElement(ThemeProvider, { theme: themes.hell },
    React.createElement(ConflictsModal, { active: true, onClose() {}, onSwap() {}, onRemove() {}, ...props })));
  let out = mk({ loading: false, result, count: 3 });
  const has2 = (label, needle) => console.log((out.includes(needle) ? 'OK  ' : 'MISS') + ' conflicts modal: ' + label);
  has2('shows both mod names', 'Brutal');
  has2('names the winner', 'Weapons wins (loads later)');
  has2('shared file count', '3 shared files');
  has2('groups', 'Shotgun');
  has2('swap action', 'Swap order');
  has2('remove actions', 'Remove Brutal');
  has2('skipped 7z', '7z archives cannot be looked into');
  has2('skipped patch', 'Dehacked patch, nothing to compare');
  out = mk({ loading: true, result: null, count: 3 });
  has2('loading text', 'Looking inside 3 mods');
  out = mk({ loading: false, result: { checked: 4, skipped: [], conflicts: [] }, count: 4 });
  has2('no conflicts text', 'No conflicts found between the 4 mods');
} catch (e) { console.log('MISS conflicts modal render failed: ' + e.message.slice(0, 140)); }

try {
  const { DiskUsageModal } = require(APP + '/client/components');
  const MB = 1024 * 1024;
  const um = [
    { id: 'a', name: 'Big pack', path: '/w/1_BP/a.pk3', folders: ['1_BP'], folder: '1_BP', bytes: 600 * MB },
    { id: 'b', name: 'Small', path: '/w/1_BP/b.pk3', folders: ['1_BP'], folder: '1_BP', bytes: 100 * MB },
    { id: 'c', name: 'Textures', path: '/w/8_UP/c.pk3', folders: ['8_UP'], folder: '8_UP', bytes: 300 * MB }
  ];
  const mkU = dups => renderToString(React.createElement(ThemeProvider, { theme: themes.hell },
    React.createElement(DiskUsageModal, { active: true, onClose() {}, mods: um, duplicates: dups, onShow: () => () => {}, onDelete: () => () => {}, onOpenDuplicates() {} })));
  let ou = mkU([{ id: 'd', paths: ['/x', '/y'], bytes: 200 * MB }]);
  const hu = (label, needle) => console.log((ou.includes(needle) ? 'OK  ' : 'MISS') + ' usage modal: ' + label);
  console.log('usage text:', (ou.match(/[0-9.]+ [kMG]B in [0-9]+ mods|about [0-9.]+ [kMG]B/g) || []).join(' | '));
  hu('total line', 'B in 3 mods');
  hu('folder bar 1_BP', '1_BP');
  hu('percent 70%', '70%');
  hu('percent 30%', '30%');
  hu('biggest mod listed', 'Big pack');
  hu('duplicate saving', 'about 209.7 MB');
  ou = mkU([]);
  console.log((ou.includes('about') ? 'MISS' : 'OK  ') + ' usage modal: no duplicate line when none');
  const ms = renderToString(React.createElement(ThemeProvider, { theme: themes.hell },
    React.createElement(require(APP + '/client/components').ModStats, { count: 3, bytes: 1000 * MB, groups: 1, onOpen() {}, onUsage() {}, initiallyOpen: true })));
  console.log((ms.includes('Disk usage') && ms.includes('Duplicates: 1') ? 'OK  ' : 'MISS') + ' stats bar: Disk usage + Duplicates links');
} catch (e) { console.log('MISS usage modal render failed: ' + e.message.slice(0, 160)); }

// ---- fifth pass: folders, fixes, ignore
try {
  localStorage.clear();
  localStorage.setItem('ssgl.sort', 'folder');
  localStorage.setItem('ssgl.openFolders', JSON.stringify(['1_BP']));
  const st5 = { ...state,
    folders: [['1_BP'], ['2_GK'], ['9_EMPTY_NEW']],
    settings: { ...state.settings, importFolder: '1_BP', compactList: false },
    packages: [{ id: 'pp', name: 'My pack', selected: ['brutal4000PK3'], modNames: { brutal4000PK3: { name: 'brutal', kind: 'PK3' } } }],
    mods: [mk('brutal', ['1_BP'], 5000, { active: true }), mk('glory', ['2_GK'], 2000)] };
  // brutal's id is 'brutal5000' -> the package's 'brutal4000PK3' is the old version
  const render5 = () => renderToString(React.createElement(ThemeProvider, { theme: themes.hell },
    React.createElement(StoreContext.Provider, { value: { gstate: st5, dispatch() {} } },
      React.createElement(AudioProvider, null,
        React.createElement(ToastContext.Provider, { value: { addToast() {}, toasts: [] } }, React.createElement(Wads))))));
  const h5 = render5();
  const c5 = (label, needle) => console.log((h5.includes(needle) ? 'OK  ' : 'MISS') + ' ' + label);
  c5('empty new folder shows in By folder view', '9_EMPTY_NEW');
  c5('new-folder link in toolbar', 'New folder');
  c5('"new mods" tag on the chosen folder', '>new mods<');
  c5('fix link with count', 'Update mods in packages (1)');

  const { FixPackagesModal, FolderNameModal } = require(APP + '/client/components');
  const wrap = el => renderToString(React.createElement(ThemeProvider, { theme: themes.hell }, el));
  const brutalMod = { ...mk('brutal', ['1_BP'], 5000), kind: 'PK3', size: '5.0 kB' };
  let fm = wrap(React.createElement(FixPackagesModal, { active: true, onClose() {}, onApply() {},
    fixes: [{ id: 'old', name: 'brutal old', packages: ['My pack', 'Other'], candidate: { mod: brutalMod, tier: 1 } },
            { id: 'old2', name: 'weapons v21', packages: ['My pack'], candidate: { mod: { ...brutalMod, name: 'weapons v22' }, tier: 2 } },
            { id: 'x', name: 'gone', packages: ['Z'], candidate: null }] }));
  const f5 = (label, needle) => console.log((fm.includes(needle) ? 'OK  ' : 'MISS') + ' fix window: ' + label);
  f5('old and new name', 'brutal old'); f5('shows folder of replacement', '1_BP'); f5('tier 1 text', 'same file name, new size');
  f5('tier 2 warning', 'similar name, check that it is the right one'); f5('used in', 'Used in: My pack, Other'); f5('not found list', 'gone');
  fm = wrap(React.createElement(FixPackagesModal, { active: true, onClose() {}, onApply() {}, fixes: [{ id: 'a', name: 'a', packages: ['P'], candidate: { mod: brutalMod, tier: 1 } }, { id: 'b', name: 'b', packages: ['P'], candidate: { mod: brutalMod, tier: 1 } }] }));
  f5('"update all" shown for 2+ exact matches', 'Update all exact matches (2)');

  let nm = wrap(React.createElement(FolderNameModal, { dialog: { mode: 'create', key: '1_BP', initial: '' }, onSubmit() {}, onCancel() {} }));
  console.log((nm.includes('Folder name') && nm.includes('Created inside 1_BP') ? 'OK  ' : 'MISS') + ' folder dialog (create)');
  nm = wrap(React.createElement(FolderNameModal, { dialog: { mode: 'rename', key: '1_BP', initial: '1_BP' }, onSubmit() {}, onCancel() {} }));
  console.log((nm.includes('Rename folder') ? 'OK  ' : 'MISS') + ' folder dialog (rename)');
  console.log((wrap(React.createElement(FolderNameModal, { dialog: null, onSubmit() {}, onCancel() {} })).includes('Folder name') ? 'MISS' : 'OK  ') + ' folder dialog hidden when closed');

  const { ConflictsModal } = require(APP + '/client/components');
  const res = { checked: 3, skipped: [], conflicts: [
    { a: 'm1', aName: 'One', b: 'm2', bName: 'Two', count: 2, groups: [{ label: 'Shotgun', count: 2 }], sample: [] },
    { a: 'm2', aName: 'Two', b: 'm3', bName: 'Three', count: 1, groups: [{ label: 'Maps', count: 1 }], sample: [] }] };
  let cm = wrap(React.createElement(ConflictsModal, { active: true, onClose() {}, onSwap() {}, onRemove() {}, result: res, count: 3, ignored: [] }));
  console.log((cm.includes('Ignore this conflict') && cm.includes('2 conflicts found') ? 'OK  ' : 'MISS') + ' conflicts: ignore link, 2 listed');
  cm = wrap(React.createElement(ConflictsModal, { active: true, onClose() {}, onSwap() {}, onRemove() {}, result: { ...res, conflicts: [{ ...res.conflicts[0], a: 'm2', aName: 'Two', b: 'm1', bName: 'One' }, res.conflicts[1]] }, count: 3, ignored: ['m1|m2'] }));
  console.log('   texts:', (cm.match(/[0-9]+ (conflicts? found|ignored)/g) || []).join(' | '), '| One shown:', cm.includes('>One<') || cm.includes('One<'), '| Two->Three shown:', cm.includes('Three'));
  console.log((cm.includes('1 conflict found') && cm.includes('1 ignored') && !cm.includes('>One<') ? 'OK  ' : 'MISS') + ' conflicts: ignored pair hidden even after a swap (order independent), counter shown');
  cm = wrap(React.createElement(ConflictsModal, { active: true, onClose() {}, onSwap() {}, onRemove() {}, result: res, count: 3, ignored: ['m1|m2', 'm2|m3'] }));
  console.log((cm.includes('No conflicts found') ? 'OK  ' : 'MISS') + ' conflicts: all ignored -> "No conflicts"');
} catch (e) { console.log('MISS fifth pass failed: ' + e.stack.split('\n').slice(0, 4).join(' | ')); }
process.exit(0);
