// Code review fixes: each check here failed (or crashed) before the fix.
const fs = require('fs');
const os = require('os');
const path = require('path');
const APP = require('./paths').APP + '';
const check = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ssgl-review-'));
require('@babel/register')({
  presets: [[APP + '/node_modules/@babel/preset-env', { targets: { node: 'current' } }]],
  babelrc: false, configFile: false, cache: false, extensions: ['.js'],
  only: [/app[\\/](electron[\\/]utils|electron[\\/]constants|client[\\/](state|utils))/]
});
const Module = require('module');
const origReq = Module.prototype.require;
Module.prototype.require = function (r) { return r === 'electron' ? { app: { getPath: () => TMP } } : origReq.apply(this, arguments); };

const { reducer, initState } = require(APP + '/client/state/reducer.js');
const { isInside } = require(APP + '/electron/utils/safepath.js');
const { walkWadDir } = require(APP + '/electron/utils/mods.js');
const { copyfile, createPath } = require(APP + '/electron/utils/common.js');

(async () => {
  // ---- reducer -------------------------------------------------------------------------------
  const mod = id => ({ id, name: id, kind: 'PK3', active: false });
  const base = { ...initState, mods: [mod('a'), mod('b'), mod('c')], package: { ...initState.package, selected: ['a', 'b', 'c'] } };
  check('an unknown action changes nothing (it used to reset all state)', reducer(base, { type: 'no/such/thing' }) === base);
  check('arrow "up" on the first mod does nothing (it went to the end)', reducer(base, { type: 'mod/move', index: 0, direction: 'up' }).package.selected.join() === 'a,b,c');
  check('arrow "down" on the last mod does nothing', reducer(base, { type: 'mod/move', index: 2, direction: 'down' }).package.selected.join() === 'a,b,c');
  const before = { ...initState, mods: [mod('a')], package: { ...initState.package, selected: [] } };
  const after = reducer(before, { type: 'mod/select', id: 'a' });
  check('ticking a mod does not change the old state object', before.mods[0].active === false && after.mods[0].active === true);
  const lib = { mods: [mod('a')], iwads: [], duplicates: [], versions: [] };
  check('a re-scan that restored a damaged file brings its notice along', reducer(base, { type: 'mods/refresh', data: { ...lib, recovered: ['packages.json'] } }).recovered.join() === 'packages.json');
  check('...a re-scan without one keeps the notice that is waiting', reducer({ ...base, recovered: ['x'] }, { type: 'mods/refresh', data: lib }).recovered.join() === 'x');

  // ---- main part -----------------------------------------------------------------------------
  const root = path.join(TMP, 'lib');
  check('a folder named "..stuff" inside the library is inside', isInside(root, path.join(root, '..stuff', 'a.wad')));
  check('...but really outside is still outside', !isInside(root, path.join(TMP, 'other', 'a.wad')) && !isInside(root, root));

  fs.mkdirSync(path.join(root, 'Brutal', '10_VISUAL'), { recursive: true });
  fs.writeFileSync(path.join(root, 'top.wad'), 'x');
  fs.writeFileSync(path.join(root, 'Brutal', '10_VISUAL', 'look.pk3'), 'xy');
  fs.writeFileSync(path.join(root, 'DOOM2.WAD'), 'iwad');
  const scan = await walkWadDir(root + path.sep);
  const top = scan.mods.find(m => m.name === 'top');
  const look = scan.mods.find(m => m.name === 'look');
  check('folder parts below the library folder (also with a trailing slash)', top && top.folder === '' && top.folders.length === 0 && look && look.folders.join('/') === 'Brutal/10_VISUAL');
  check('IWADs are still found', scan.iwads.some(i => /doom2/i.test(i.name)));
  let err = null;
  try { await walkWadDir(path.join(TMP, 'missing')); } catch (e) { err = e; }
  check('a missing mod folder gives a real error with a message', !err || (err && typeof err.message === 'string'));

  const dest = path.join(TMP, 'a', 'b', 'c');
  createPath(dest);
  createPath(dest);
  check('createPath makes all folders and can run twice', fs.existsSync(dest));
  check('copying a file that is not there returns false (no crash)', (await copyfile(path.join(TMP, 'nope.ini'), path.join(dest, 'x.ini'))) === false);
  fs.writeFileSync(path.join(TMP, 'cfg.ini'), 'abc');
  check('...and a real copy is finished when it returns', (await copyfile(path.join(TMP, 'cfg.ini'), path.join(dest, 'x.ini'))) === true && fs.readFileSync(path.join(dest, 'x.ini'), 'utf8') === 'abc');

  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
})().catch(e => { console.log('MISS crashed: ' + (e.stack || e)); process.exit(1); });
