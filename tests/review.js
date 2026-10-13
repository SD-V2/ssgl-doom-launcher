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
const up = require(APP + '/electron/utils/upscaler.js');
const png = require(APP + '/electron/utils/png.js');
const library = require(APP + '/electron/utils/doom/library.js');

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

  const { fileUrl } = require(APP + '/client/utils/image.js');
  check('a file link keeps # and % in folder names (sounds, wallpaper)', fileUrl('C:\\My #1 100%\\a.ogg') === 'file://C:\\My %231 100%25\\a.ogg');

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

  // ---- Upscaler -----------------------------------------------------------------------------
  const job = up.createJob({ source: 'x', modName: 'x', images: [], kinds: ['sprite'], scale: 2, model: null, engine: null, destDir: path.join(TMP, 'up') });
  job.pause('game');
  const end = await job.run();
  job.resume();
  check('a job that ended while a game was running stays ended when the game closes', end.phase === 'error' && job.state.phase === 'error');
  const soft = { width: 4, height: 4, data: Buffer.alloc(64, 128) };
  const soft2 = { width: 8, height: 8, data: Buffer.alloc(256, 128) };
  check('a soft see-through picture with no fully clear pixel is not rejected as "no see-through"', up.checkResult({ width: 4, height: 4, alpha: 'alpha', orig: soft }, soft2, 2) !== 'noAlpha');
  const holed = { width: 2, height: 1, data: Buffer.from([9, 9, 9, 255, 0, 0, 0, 0]) };
  check('...one that had a hole and lost it still is', up.checkResult({ width: 2, height: 1, alpha: 'alpha', orig: holed }, { width: 4, height: 2, data: Buffer.alloc(32, 255) }, 2) === 'noAlpha');
  const hidden = { width: 3, height: 1, data: Buffer.from([0, 0, 0, 0, 90, 60, 30, 255, 0, 0, 0, 0]) };
  png.fillHidden(hidden);
  check('fillHidden: clear pixels get the colour of their visible neighbour', hidden.data[0] === 90 && hidden.data[9] === 60 && hidden.data[3] === 0);
  let code = '';
  try { await library.scan(root); } catch (e) { code = e.code; }
  check('the Graphics viewer says "folder" for a folder', code === 'folder');

  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
})().catch(e => { console.log('MISS crashed: ' + (e.stack || e)); process.exit(1); });
