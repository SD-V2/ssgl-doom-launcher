const fs = require('fs'); const path = require('path'); const os = require('os');
const Module = require('module'); const orig = Module.prototype.require;
const handlers = {}; let userData = '';
Module.prototype.require = function (r) {
  if (r === 'electron') return { ipcMain: { handle: (n, fn) => (handlers[n] = fn) }, app: { getPath: () => userData }, BrowserWindow: { getAllWindows: () => [] }, shell: {} };
  return orig.apply(this, arguments);
};
require('@babel/register')({ presets: [[(require('./paths').APP + '/node_modules/@babel/preset-env'), { targets: { node: 'current' } }]], babelrc:false, configFile:false, extensions:['.js'], cache:false, only:[/app\/electron/] });
const E = (require('./paths').APP + '/electron/');
['handlers/mods.js', 'handlers/folders.js'].forEach(f => require(E + f));
const { scanLibrary } = require(E + 'utils/mods.js');
const { watchModDir, stopWatching } = require(E + 'utils/watcher.js');
const t = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'ssgl5-'));
userData = path.join(T, 'ud'); const wads = path.join(T, 'wads'); const maps = path.join(T, 'maps'); const src = path.join(T, 'src');
[userData, wads, maps, src, path.join(wads, '1_BP'), path.join(maps, 'Episode 1'), path.join(maps, 'Empty')].forEach(d => fs.mkdirSync(d, { recursive: true }));
const w = (p, c) => fs.writeFileSync(p, c);
w(path.join(wads, '1_BP', 'brutal.pk3'), 'bp'); w(path.join(wads, 'doom2.wad'), 'iwad'); w(path.join(wads, 'same.wad'), 'xx');
w(path.join(maps, 'Episode 1', 'map01.wad'), 'm1'); w(path.join(maps, 'same.wad'), 'xx'); w(path.join(maps, 'doom2.wad'), 'not an iwad here');
const set = o => w(path.join(userData, 'settings.json'), JSON.stringify({ modpath: wads, ...o }));
const call = async (n, d) => handlers[n]({ sender: {} }, d);
(async () => {
  set({});
  let lib = await scanLibrary({ modpath: wads });
  t('no maps directory set -> only mods, no map folders', lib.mods.every(m => !m.isMap) && lib.mapFolders.length === 0 && lib.mods.length === 2);
  set({ mappath: maps });
  lib = await scanLibrary({ modpath: wads, mappath: maps });
  const mods = lib.mods.filter(m => !m.isMap), mp = lib.mods.filter(m => m.isMap);
  t('mods and maps come back in one list, maps flagged', mods.length === 2 && mp.length === 2);
  t('map ids start with "map:" - the same file in both folders gets two different ids', mods.find(m => m.name === 'same').id === 'same2WAD' && mp.find(m => m.name === 'same').id === 'map:same2WAD');
  t('map folders are listed separately (even the empty one)', JSON.stringify(lib.mapFolders.map(f => f.join('/')).sort()) === '["Empty","Episode 1"]' && lib.folders.map(f => f.join('/')).join() === '1_BP');
  t('map folder paths are relative to the maps directory', mp.find(m => m.name === 'map01').folders.join() === 'Episode 1');
  t('an IWAD-named file in the maps directory is not an IWAD (and not a mod either)', lib.iwads.length === 1 && lib.iwads[0].path.startsWith(wads) && !mp.some(m => m.name === 'doom2'));
  t('exact duplicates are only searched inside each folder', lib.duplicates.length === 0);

  // maps directory inside the mods directory: nothing shows up twice
  const nested = path.join(wads, 'maps'); fs.mkdirSync(nested); w(path.join(nested, 'nm.wad'), 'nm');
  lib = await scanLibrary({ modpath: wads, mappath: nested });
  t('maps directory INSIDE the mod directory -> its files are maps only, once', lib.mods.filter(m => m.name === 'nm').length === 1 && lib.mods.find(m => m.name === 'nm').isMap === true);
  lib = await scanLibrary({ modpath: wads, mappath: wads });
  t('same directory for both -> everything stays a mod, no map twice', lib.mods.every(m => !m.isMap) && new Set(lib.mods.map(m => m.path)).size === lib.mods.length);
  lib = await scanLibrary({ modpath: wads, mappath: path.join(T, 'does-not-exist') });
  t('maps directory that does not exist -> ignored, mods still work', lib.mods.length > 0 && lib.mapFolders.length === 0);

  // dropping files onto a map folder
  w(path.join(src, 'newmap.wad'), 'nmap'); w(path.join(src, 'notes.txt'), 'x');
  let r = await call('mods/import', { paths: [path.join(src, 'newmap.wad'), path.join(src, 'notes.txt')], folder: 'Episode 1', known: [], root: 'maps' });
  t('drop onto a map folder -> copied into the MAPS directory', r.data.copied === 1 && fs.existsSync(path.join(maps, 'Episode 1', 'newmap.wad')) && !fs.existsSync(path.join(wads, 'Episode 1')));
  r = await call('mods/import', { paths: [path.join(src, 'newmap.wad')], folder: 'Episode 1', known: ['map:newmap4WAD'], root: 'maps' });
  t('same map again -> recognised through its map: id, not copied twice', r.data.copied === 0 && r.data.already.length === 1);
  r = await call('mods/import', { paths: [path.join(src, 'newmap.wad')], folder: '1_BP', known: [], root: 'mods' });
  t('root "mods" still goes to the WAD directory', r.data.copied === 1 && fs.existsSync(path.join(wads, '1_BP', 'newmap.wad')));
  w(path.join(src, 'fresh.wad'), 'fresh!');
  r = await call('mods/add', { paths: [path.join(src, 'fresh.wad')], known: [], root: 'maps' });
  t('drop onto the load order while on the Maps tab -> map copied to "Added via Explorer" in the maps directory, id with map:', r.data.mods.length === 1 && r.data.mods[0].isMap === true && r.data.mods[0].id.startsWith('map:') && fs.existsSync(path.join(maps, 'Added via Explorer', 'fresh.wad')));
  set({ mappath: maps, importFolder: '1_BP/new' });
  w(path.join(src, 'fresh2.wad'), 'fresh2!');
  r = await call('mods/add', { paths: [path.join(src, 'fresh2.wad')], known: [], root: 'maps' });
  t('the "Folder for new mods" setting does NOT apply to maps', fs.existsSync(path.join(maps, 'Added via Explorer', 'fresh2.wad')) && !fs.existsSync(path.join(maps, '1_BP')));
  set({}); r = await call('mods/import', { paths: [path.join(src, 'fresh.wad')], folder: '', known: [], root: 'maps' });
  t('maps directory not set -> a clear error code (E_NO_MAPDIR)', r.error && r.error.code === 'E_NO_MAPDIR');

  // folders in the maps directory
  set({ mappath: maps });
  r = await call('folders/create', { parent: '', name: 'Episode 2', root: 'maps' });
  t('create a folder in the maps directory', r.data.key === 'Episode 2' && fs.existsSync(path.join(maps, 'Episode 2')) && !fs.existsSync(path.join(wads, 'Episode 2')));
  r = await call('folders/rename', { key: 'Episode 2', name: 'Episode Two', root: 'maps' });
  t('rename it', r.data.key === 'Episode Two' && fs.existsSync(path.join(maps, 'Episode Two')));
  r = await call('folders/delete', { key: 'Episode Two', root: 'maps' });
  t('delete it (empty)', !r.error && !fs.existsSync(path.join(maps, 'Episode Two')));
  r = await call('folders/create', { parent: '', name: 'X', root: 'mods' });
  t('root "mods" (or none) still works in the WAD directory', r.data.key === 'X' && fs.existsSync(path.join(wads, 'X')));

  // watching both folders
  let n = 0; const fine = watchModDir([wads, maps], () => n++, 200);
  w(path.join(maps, 'Episode 1', 'late.wad'), 'late'); await new Promise(r => setTimeout(r, 700));
  t('a change in the MAPS directory is noticed too', fine && n === 1);
  w(path.join(wads, '1_BP', 'late.pk3'), 'late'); await new Promise(r => setTimeout(r, 700));
  t('...and one in the WAD directory', n === 2);
  t('same list again -> no new watchers (returns true)', watchModDir([wads, maps], () => n++, 200) === true);
  t('only a WAD directory (old way, plain text) still works', (stopWatching(), watchModDir(wads, () => {}, 200)) === true);
  t('nothing to watch -> false', (stopWatching(), watchModDir(['', undefined], () => {}, 200)) === false);
  stopWatching();
  process.exit(0);
})();
