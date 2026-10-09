// Faster start (main part): the startup log, the faster folder scan, the library cache
// (used at once at the start, checked in the background: added / removed / renamed while
// SSGL was closed, broken cache, another mods folder, the maps folder) and the smaller
// copy of a big wallpaper.
const fs = require('fs');
const os = require('os');
const path = require('path');
const APP = require('./paths').APP + '';
const check = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);
const wait = ms => new Promise(r => setTimeout(r, ms));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ssgl-start-'));
const DATA = path.join(TMP, 'data'); fs.mkdirSync(DATA);
const handlers = {};
const sent = [];
const Module = require('module');
const origReq = Module.prototype.require;
Module.prototype.require = function (r) {
  if (r === 'electron') return {
    app: { getPath: () => DATA, getVersion: () => '1.0.0', name: 'ssgl' },
    ipcMain: { handle: (ch, f) => { handlers[ch] = f; }, on: (ch, f) => { handlers['on:' + ch] = f; } },
    BrowserWindow: { getAllWindows: () => [{ isDestroyed: () => false, webContents: { send: (ch, d) => sent.push([ch, d]) } }] }
  };
  return origReq.apply(this, arguments);
};
require('@babel/register')({
  presets: [[APP + '/node_modules/@babel/preset-env', { targets: { node: 'current' } }]],
  babelrc: false, configFile: false, cache: false, extensions: ['.js'],
  only: [/app[\\/]electron[\\/]/]
});

const startup = require(APP + '/electron/utils/startup.js');
const mods = require(APP + '/electron/utils/mods.js');
const wall = require(APP + '/electron/utils/wallpaper.js');
const json = require(APP + '/electron/utils/json.js');
require(APP + '/electron/handlers/main.js');
const { stopWatching } = require(APP + '/electron/utils/watcher.js');

const put = (file, text = 'x') => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const setSettings = s => fs.writeFileSync(path.join(DATA, 'settings.json'), JSON.stringify(s));
const init = opts => handlers['main/init']({}, opts);
const waitFor = async (fn, ms = 4000) => { for (let i = 0; i < ms / 20; i++) { const v = fn(); if (v) return v; await wait(20); } return null; };

(async () => {
  // ---- the startup log ------------------------------------------------------------
  const log = path.join(TMP, 'startup-log.txt');
  for (let i = 1; i <= 12; i++) startup.appendLog({ date: '2026-10-09T08:00:' + String(i).padStart(2, '0') + 'Z', window: 500 + i, usable: 2000 + i * 100, marks: { usable: 2000 + i * 100 }, extra: { mods: 560 } }, log);
  const lines = fs.readFileSync(log, 'utf8').trim().split('\n');
  check('startup log: only the last 10 starts are kept', lines.length === 10 && /08:00:03Z/.test(lines[0]) && /08:00:12Z/.test(lines[9]));
  check('startup log: easy to read ("window 0.5 s  usable 3.2 s")', /window 0\.5 s {2}usable 3\.2 s/.test(lines[9]));
  const back = startup.readLog(log);
  check('startup log: read back with all the moments', back.length === 10 && back[9].usable === 3200 && back[9].marks.usable === 3200 && back[9].extra.mods === 560);
  fs.writeFileSync(log, 'garbage\n' + lines[9] + '\n');
  check('startup log: a broken line does not break the rest', startup.readLog(log).length === 1);
  check('startup marks: milliseconds since the program started, the first time only', startup.mark('x1') >= 0 && startup.mark('x1', Date.now() + 99999) === startup.mark('x1'));

  // ---- the folder scan ---------------------------------------------------------------
  const lib = path.join(TMP, 'lib');
  const M = path.join(lib, 'mods'); const P = path.join(lib, 'maps');
  put(path.join(M, '1_BP', 'brutal.pk3')); put(path.join(M, '1_BP', 'Sub', 'addon.pk3')); put(path.join(M, 'root.wad'));
  put(path.join(M, '3_MONSTERS', 'more monsters.zip')); put(path.join(M, 'doom2.wad')); put(path.join(M, 'notes.txt'));
  put(path.join(M, 'node_modules', 'x', 'hidden.pk3')); put(path.join(M, '.git', 'objects', 'a.pk3')); put(path.join(M, '.hidden', 'b.pk3'));
  for (let d = 0; d < 20; d++) for (let i = 0; i < 400; i++) put(path.join(M, 'Unpacked mod', 'sprites', 's' + d, 'S' + i + '.png'));
  try { fs.symlinkSync(path.join(TMP, 'nowhere'), path.join(M, 'broken link')); } catch (e) { /* no symlinks here */ }
  put(path.join(P, 'Episode 1', 'castle.wad'));
  const settings = { modpath: M, mappath: P, savepath: DATA, language: 'en' };
  const t0 = Date.now();
  const r = await mods.scanLibrary(settings);
  const took = Date.now() - t0;
  const names = r.mods.map(m => m.name);
  check(`scan: the mods (breadth first, as before) - ${names.join(', ')}`, JSON.stringify(names.filter(n => n !== 'castle')) === JSON.stringify(['root', 'brutal', 'more monsters', 'addon']));
  check('scan: IWADs are found and kept apart', r.iwads.length === 1 && r.iwads[0].name === 'doom2');
  check('scan: node_modules, .git and hidden folders are not looked into', !names.some(n => /hidden|a$/.test(n)) && !r.folders.some(f => f[0] === 'node_modules' || f[0] === '.git'));
  check('scan: a broken link does not stop the scan', r.mods.length === 5);
  check('scan: the maps folder gives maps', r.mods.some(m => m.isMap && m.name === 'castle' && m.id.indexOf('map:') === 0) && JSON.stringify(r.mapFolders) === '[["Episode 1"]]');
  check(`scan: 8000 loose files (an unpacked mod) do not slow it down (${took} ms)`, took < 3000);
  check('scan: folders still listed (also the unpacked one)', r.folders.some(f => f.join('/') === '1_BP/Sub') && r.folders.some(f => f.join('/') === 'Unpacked mod/sprites/s19'));

  // ---- the library cache: first start, then quick starts --------------------------------
  setSettings(settings);
  const first = await init({ quick: true });
  check('first start (no cache): the folders are read, the list comes back', !first.error && first.data.mods.length === 5 && !first.data.fromCache);
  await waitFor(() => fs.existsSync(path.join(DATA, 'library-cache.json')));
  check('...and the list is saved as the cache (safe saving)', fs.existsSync(path.join(DATA, 'library-cache.json')));

  sent.length = 0;
  const q1 = await init({ quick: true });
  check('next start: the cached list comes at once (fromCache)', q1.data.fromCache === true && q1.data.mods.length === 5 && q1.data.settings.modpath === M);
  const checked = await waitFor(() => sent.find(s => s[0] === 'library/checked' || s[0] === 'library/updated'));
  check('...the background check finds nothing new: "library/checked"', checked && checked[0] === 'library/checked');

  // changes while SSGL was closed
  put(path.join(M, '5_WEAPONS', 'new guns.pk3'));
  fs.unlinkSync(path.join(M, 'root.wad'));
  fs.renameSync(path.join(M, '1_BP', 'Sub', 'addon.pk3'), path.join(M, '1_BP', 'Sub', 'addon v2.pk3'));
  put(path.join(P, 'Episode 2', 'tower.wad'));
  sent.length = 0;
  const q2 = await init({ quick: true });
  check('changed while closed: the old list still comes at once', q2.data.fromCache === true && q2.data.mods.some(m => m.name === 'root'));
  const upd = await waitFor(() => sent.find(s => s[0] === 'library/updated'));
  const un = upd ? upd[1].mods.map(m => m.name) : [];
  check('...and a moment later the real list: added, removed and renamed mods are right', !!upd && un.indexOf('new guns') > -1 && un.indexOf('root') < 0 && un.indexOf('addon v2') > -1 && un.indexOf('addon') < 0);
  check('...the new map and its folder are there too', !!upd && un.indexOf('tower') > -1 && upd[1].mapFolders.some(f => f[0] === 'Episode 2'));
  await wait(100);
  sent.length = 0;
  const q3 = await init({ quick: true });
  check('...and the next start has the new list in its cache', q3.data.mods.some(m => m.name === 'new guns') && !q3.data.mods.some(m => m.name === 'root'));
  await waitFor(() => sent.length);

  // another mods folder in Settings: the cache does not fit
  const M2 = path.join(TMP, 'other'); put(path.join(M2, 'only.pk3'));
  setSettings({ ...settings, modpath: M2 });
  const q4 = await init({ quick: true });
  check('another mods folder: the cache is not used, the folder is read', q4.data.fromCache !== true && q4.data.mods.map(m => m.name).join() === 'only,castle,tower');
  setSettings(settings);
  await wait(100);

  // a broken cache: ignored, no "file restored" notice
  fs.writeFileSync(path.join(DATA, 'library-cache.json'), '{"version":1,"key":');
  json.takeRecovered();
  const q5 = await init({ quick: true });
  check('broken cache: ignored, the folders are read (no "restored" notice)', q5.data.fromCache !== true && q5.data.mods.length === 6 && q5.data.recovered.length === 0);
  await wait(100);
  check('...and a good cache is written again', JSON.parse(fs.readFileSync(path.join(DATA, 'library-cache.json'), 'utf8')).result.mods.length === 6);

  // a refresh (Settings saved, files changed while SSGL runs) never uses the cache
  const plain = await init();
  check('a normal refresh reads the folders (never the cache)', plain.data.fromCache !== true);

  // ---- the wallpaper ----------------------------------------------------------------------
  const jpg = (w, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
  const png = (w, h) => { const b = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b); b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'latin1'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
  check('wallpaper size from the first bytes (JPG, PNG)', JSON.stringify(wall.sizeOf(jpg(7680, 4320))) === '{"width":7680,"height":4320}' && JSON.stringify(wall.sizeOf(png(1920, 1080))) === '{"width":1920,"height":1080}');
  const big = path.join(TMP, 'big.jpg'); fs.writeFileSync(big, jpg(7680, 4320));
  const small = path.join(TMP, 'small.png'); fs.writeFileSync(small, png(1920, 1080));
  const gif = path.join(TMP, 'moving.gif'); fs.writeFileSync(gif, 'GIF89a');
  const cBig = await wall.choose(DATA, big, 2560, 1440);
  check('a wallpaper much bigger than the screen: shown as it is now, a copy will be made', cBig.show === big && cBig.make === true && /^[0-9a-f]{20}\.jpg$/.test(cBig.key));
  const cSmall = await wall.choose(DATA, small, 2560, 1440);
  check('a wallpaper about the size of the screen: no copy', cSmall.show === small && cSmall.make === false);
  check('a GIF (it moves): always the original', (await wall.choose(DATA, gif, 2560, 1440)).make === false);
  const saved = await wall.save(DATA, cBig.key, Buffer.from('jpeg bytes'));
  const cBig2 = await wall.choose(DATA, big, 2560, 1440);
  check('the copy is kept in the data folder and used next time (the original is not touched)', cBig2.show === saved && cBig2.make === false && fs.readFileSync(big).length === jpg(7680, 4320).length);
  fs.utimesSync(big, new Date(), new Date(Date.now() + 5000));
  check('the picture was changed: a new copy is needed', (await wall.choose(DATA, big, 2560, 1440)).make === true);
  for (let i = 0; i < 4; i++) await wall.save(DATA, String(i).repeat(20) + '.jpg', Buffer.from('x'));
  check('only the last 3 copies are kept', fs.readdirSync(path.join(DATA, 'wallpaper-cache')).filter(n => /\.jpg$/.test(n)).length === 3);
  let refused = false; try { await wall.save(DATA, '../../evil.jpg', Buffer.from('x')); } catch (e) { refused = true; }
  check('a strange file name is refused', refused);

  stopWatching();
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
})().catch(e => { console.log('MISS crashed: ' + (e.stack || e)); process.exit(1); });
