// Tools > Upscaler, the main part: finding the pictures of a mod, the engine's command
// line and printed lines, PNG chunks (sprite offsets), the new PK3 (hires + TEXTURES),
// names, sizes, never overwriting, cancel / pause, temp folders, out of memory.
// The engine is faked (fixtures/fake-esrgan.js): no graphics card needed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const APP = require('./paths').APP + '';
const check = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);
const wait = ms => new Promise(r => setTimeout(r, ms));

// a private temp folder, so "nothing left behind" can be checked
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ssgl-uptest-'));
process.env.TMPDIR = process.env.TEMP = process.env.TMP = path.join(TMP, 'sys');
fs.mkdirSync(process.env.TMPDIR);

require('@babel/register')({
  presets: [[APP + '/node_modules/@babel/preset-env', { targets: { node: 'current' } }]],
  babelrc: false, configFile: false, cache: false, extensions: ['.js'],
  only: [/app[\\/]electron[\\/]utils/, /app[\\/]client[\\/]utils[\\/]sections/]
});
const Module = require('module');
const origReq = Module.prototype.require;
Module.prototype.require = function (r) { return r === 'electron' ? { app: { getPath: () => TMP } } : origReq.apply(this, arguments); };

const png = require(APP + '/electron/utils/png.js');
const up = require(APP + '/electron/utils/upscaler.js');
const ZipWriter = require(APP + '/electron/utils/zipwrite.js').default;
const archive = require(APP + '/electron/utils/archive.js');
const dl = require(APP + '/electron/utils/engineDownload.js');

// ---- pictures for the fixtures --------------------------------------------
const solid = (w, h, rgb) => { const d = Buffer.alloc(w * h * 4); for (let i = 0; i < w * h; i++) { d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = 255; } return { width: w, height: h, data: d }; };
// a red figure on black that is see-through (the classic sprite)
const spriteImg = (w, h) => { const img = solid(w, h, [0, 0, 0]); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const inside = x > 3 && x < w - 4 && y > 3 && y < h - 2; img.data[i] = inside ? 210 : 0; img.data[i + 3] = inside ? 255 : 0; } return img; };
// palette PNG with a see-through colour (tRNS), written by hand
const palettePng = () => {
  const w = 4, h = 2; const raw = Buffer.alloc((w + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = (x + y) % 2; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3;
  return png.writeChunks([{ type: 'IHDR', data: ihdr }, { type: 'PLTE', data: Buffer.from([0, 255, 255, 200, 30, 30]) }, { type: 'tRNS', data: Buffer.from([0]) }, { type: 'IDAT', data: require('zlib').deflateSync(raw) }, { type: 'IEND', data: Buffer.alloc(0) }]);
};
// the start of a JPG (enough for its size)
const jpg = (w, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);

const hash = f => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const readZip = async file => { const fd = fs.openSync(file, 'r'); const out = {}; try { for (const e of archive.listZipEntries(fd, fs.fstatSync(fd).size)) out[e.name] = await archive.readZipEntry(fd, e); } finally { fs.closeSync(fd); } return out; };

// a fake engine folder like the real download: the program + models/
const makeEngine = dir => {
  fs.mkdirSync(path.join(dir, 'models'), { recursive: true });
  const exe = path.join(dir, up.EXE);
  fs.writeFileSync(exe, '#!/usr/bin/env node\nrequire(' + JSON.stringify(path.join(__dirname, 'fixtures', 'fake-esrgan.js')) + ');\n');
  fs.chmodSync(exe, 0o755);
  ['realesrgan-x4plus', 'realesrgan-x4plus-anime', 'realesr-animevideov3-x2', 'realesr-animevideov3-x3', 'realesr-animevideov3-x4', 'oom-x4', 'novulkan-x4'].forEach(n => {
    fs.writeFileSync(path.join(dir, 'models', n + '.param'), 'p'); fs.writeFileSync(path.join(dir, 'models', n + '.bin'), 'b');
  });
  fs.writeFileSync(path.join(dir, 'models', 'lonely.param'), 'only half of a pair');
  return dir;
};

(async () => {
  // ---- PNG chunks -------------------------------------------------------------
  const sprite = await png.encode(spriteImg(20, 30), [png.grabChunk({ x: 10, y: 27 })]);
  check('PNG: the sprite offsets (grAb) are read', JSON.stringify(png.readGrab(sprite)) === '{"x":10,"y":27}');
  const moved = png.setGrab(sprite, { x: 20, y: 54 });
  check('PNG: grAb is written again (and stays before the picture data)', JSON.stringify(png.readGrab(moved)) === '{"x":20,"y":54}' && png.readChunks(moved).findIndex(c => c.type === 'grAb') < png.readChunks(moved).findIndex(c => c.type === 'IDAT'));
  check('PNG: negative offsets work too', JSON.stringify(png.readGrab(png.setGrab(sprite, { x: -5, y: -12 }))) === '{"x":-5,"y":-12}');
  const back = await png.decode(sprite);
  check('PNG: encode -> decode gives the same pixels', back.width === 20 && back.height === 30 && back.data.equals(spriteImg(20, 30).data));
  const pal = await png.decode(palettePng());
  check('PNG: palette pictures with a see-through colour are read (cyan = see-through)', pal.data[3] === 0 && pal.data[7] === 255 && pal.data[4] === 200);
  check('PNG: size from the first bytes, JPG size too', png.pngInfo(sprite).width === 20 && JSON.stringify(png.jpgInfo(jpg(32, 16))) === '{"width":32,"height":16}');
  const bled = png.bleed(await png.decode(sprite));
  check('see-through edges: the hidden colour next to the figure becomes the figure\'s colour (no black halo)', bled.data[(3 * 20 + 3) * 4] === 210 && bled.data[(3 * 20 + 3) * 4 + 3] === 0);
  const half = png.halve(png.bleed(await png.decode(await png.encode(spriteImg(40, 60)))));
  const darkEdge = (() => { for (let i = 0; i < half.data.length; i += 4) if (half.data[i + 3] > 0 && half.data[i] < 150) return true; return false; })();
  check('shrinking 4x -> 2x: half the size, edges do not get dark', half.width === 20 && half.height === 30 && !darkEdge);

  // ---- the fixture mod: a PK3 and the same as a folder --------------------------
  const lib = path.join(TMP, 'wads'); fs.mkdirSync(path.join(lib, '1_MAIN'), { recursive: true });
  const files = {
    'textures/walls/STARTAN3.png': await png.encode(solid(64, 32, [90, 90, 90])),
    'flats/FLOOR0_1.png': await png.encode(solid(16, 16, [40, 80, 40])),
    'flats/CLASH.png': await png.encode(solid(16, 16, [1, 2, 3])),
    'textures/CLASH.png': await png.encode(solid(32, 16, [3, 2, 1])),
    'sprites/monsters/TROOA1.png': sprite,
    'sprites/PALSA0.png': palettePng(),
    'graphics/TITLEPIC.png': await png.encode(solid(40, 25, [120, 0, 0]), [png.grabChunk({ x: 2, y: 3 })]),
    'graphics/M_DOOM.jpg': jpg(24, 12),
    'models/imp/skin.png': await png.encode(solid(8, 8, [5, 5, 5])),
    'sprites/POSSA1.lmp': Buffer.from('doom format picture, not PNG'),
    'zscript.txt': Buffer.from('class X {}')
  };
  const pk3 = path.join(lib, '1_MAIN', 'Test_Mod.pk3');
  const zw = new ZipWriter(pk3); for (const [n, b] of Object.entries(files)) await zw.add(n, b, { compress: /txt|lmp/.test(n) }); zw.close();
  const folderMod = path.join(TMP, 'foldermod');
  Object.entries(files).forEach(([n, b]) => { const f = path.join(folderMod, ...n.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); });
  const wad = path.join(lib, 'maps.wad'); const wh = Buffer.alloc(12); wh.write('PWAD', 0, 'latin1'); wh.writeInt32LE(0, 4); wh.writeInt32LE(12, 8); fs.writeFileSync(wad, wh);
  const before = hash(pk3);

  // ---- collect ------------------------------------------------------------------
  const found = await up.collect(pk3);
  const k = found.kinds;
  check('collect PK3: pictures per kind (textures 2, floors 2, sprites 2, graphics 2, other 1)', found.supported && k.texture.count === 2 && k.flat.count === 2 && k.sprite.count === 2 && k.graphic.count === 2 && k.other.count === 1);
  check('...the pixels are counted', k.texture.pixels === 64 * 32 + 32 * 16 && k.sprite.pixels === 20 * 30 + 4 * 2);
  check('...a picture in Doom\'s own format is listed as "not yet" (step 2)', found.doomFormat.length === 1 && /POSSA1/.test(found.doomFormat[0]));
  check('...names as GZDoom knows them, JPG size read', found.images.find(i => i.path === 'graphics/M_DOOM.jpg').name === 'M_DOOM' && found.images.find(i => i.format === 'jpg').width === 24);
  const fromFolder = await up.collect(folderMod);
  check('collect folder: the same pictures as the PK3', fromFolder.supported && fromFolder.images.length === found.images.length && fromFolder.type === 'folder');
  check('...and the pictures can be read (readPng)', (await fromFolder.images[0].readPng()).length > 0 && png.isPng(await found.images.find(i => i.format === 'png').readPng()));
  const w = await up.collect(wad);
  check('a WAD: shown as "not supported yet" (Doom\'s own picture format = step 2)', w.supported === false && w.reason === 'wad' && w.type === 'wad');
  check('a missing file: a clear reason', (await up.collect(path.join(TMP, 'gone.pk3'))).reason === 'missing');
  check('every reader has the same small interface (listImages)', up.READERS.map(r => r.id).join(',') === 'zip,folder,wad' && up.READERS.every(r => typeof r.listImages === 'function'));

  // ---- engine + models --------------------------------------------------------------
  const engDir = makeEngine(path.join(TMP, 'tools', 'realesrgan'));
  const eng = up.findEngine(engDir);
  check('engine found: program + models folder', eng.ok && eng.exe.endsWith(up.EXE) && path.basename(eng.models) === 'models');
  const ids = eng.list.map(m => m.id);
  check('models: pairs of .param/.bin; x2/x3/x4 files are one model; half pairs are ignored', ids.indexOf('realesr-animevideov3') > -1 && JSON.stringify(eng.list.find(m => m.id === 'realesr-animevideov3').scales) === '[2,3,4]' && ids.indexOf('lonely') < 0);
  check('models: the known ones first, with a friendly name', eng.list[0].id === 'realesrgan-x4plus-anime' && eng.list[0].known === 'drawn' && eng.list[1].known === 'general');
  check('a missing folder / no program: a reason', up.findEngine(path.join(TMP, 'nope')).problem === 'noFolder' && up.findEngine(TMP).problem === 'noExe');
  const anime = eng.list.find(m => m.id === 'realesrgan-x4plus-anime');
  const fast = eng.list.find(m => m.id === 'realesr-animevideov3');
  check('2x with a model that only does 4x: 4x and then shrink', JSON.stringify(up.engineScaleFor(anime, 2)) === '{"engineScale":4,"shrink":true}' && JSON.stringify(up.engineScaleFor(fast, 2)) === '{"engineScale":2,"shrink":false}');

  const cmd = up.buildCommand({ exe: eng.exe, models: eng.models, model: 'realesrgan-x4plus-anime', engineScale: 4, input: '/t/in', output: '/t/out', tile: 64 });
  check('command line: -i -o -n -s -t -m -f png -v', cmd.file === eng.exe && cmd.args.join(' ') === `-i /t/in -o /t/out -n realesrgan-x4plus-anime -s 4 -t 64 -m ${eng.models} -f png -v` && cmd.cwd === engDir);
  const p1 = up.parseLine('C:\\t\\in\\00001.png -> C:\\t\\out\\00001.png done');
  check('progress: "a -> b done" = one picture finished', p1.type === 'done' && p1.output === 'C:\\t\\out\\00001.png');
  check('progress: "37.50%" = part of a picture', up.parseLine('37.50%').value === 37.5);
  check('progress: out of memory is recognised', up.parseLine('vkAllocateMemory failed -2').oom === true && up.parseLine('vkQueueSubmit failed -4').oom === true);
  check('progress: no Vulkan / old driver is recognised', up.parseLine('vkCreateInstance failed -9').novulkan === true && up.parseLine('invalid gpu device').novulkan === true);
  check('progress: empty lines are nothing', up.parseLine('   ') === null);

  const test = await up.testEngine(eng, anime);
  check('engine test run (a tiny picture): it starts', test.ok === true);
  const bad = await up.testEngine(eng, eng.list.find(m => m.id === 'novulkan-x4'));
  check('engine test run: no Vulkan is said clearly', bad.ok === false && bad.reason === 'noVulkan' && /vkCreateInstance/.test(bad.detail));

  // ---- plan + TEXTURES ------------------------------------------------------------------
  const chosen = up.pickImages(found.images, ['texture', 'flat', 'sprite', 'graphic']);
  const { entries } = up.plan(found.images, chosen);
  const by = p => entries.find(e => e.image.path === p);
  check('PK3 layout: textures and floors go to hires/ (path kept)', by('textures/walls/STARTAN3.png').dest === 'hires/textures/walls/STARTAN3.png' && by('flats/FLOOR0_1.png').dest === 'hires/flats/FLOOR0_1.png' && !by('flats/FLOOR0_1.png').viaTextures);
  check('PK3 layout: sprites and graphics get a TEXTURES entry (outside the sprites folder)', by('sprites/monsters/TROOA1.png').viaTextures && by('sprites/monsters/TROOA1.png').dest === 'upscaled/sprites/monsters/TROOA1.png' && by('graphics/TITLEPIC.png').def === 'Graphic');
  check('PK3 layout: a name that is a floor AND a texture gets TEXTURES for both (no mix-up)', by('flats/CLASH.png').def === 'Flat' && by('textures/CLASH.png').def === 'WallTexture' && by('flats/CLASH.png').dest.indexOf('upscaled/') === 0);
  const other = up.plan([{ kind: 'sprite', name: 'TROOA1', path: 'sprites/TROOA1.png' }, { kind: 'other', name: 'TROOA1', path: 'skins/TROOA1.png' }], [{ kind: 'sprite', name: 'TROOA1', path: 'sprites/TROOA1.png' }, { kind: 'other', name: 'TROOA1', path: 'skins/TROOA1.png' }]);
  check('PK3 layout: an "other" picture with a sprite\'s name stays out (hires/ would cover the sprite)', other.entries.length === 1 && other.entries[0].image.kind === 'sprite' && other.skipped[0].reason === 'sameName');
  check('names as GZDoom makes them: up to the last dot, 8 letters, upper case', up.shortName('textures/brick.wall.big.png') === 'BRICK.WA' && up.shortName('sprites/a/trooa1.png') === 'TROOA1');
  check('PK3 layout: JPG pictures become PNG', by('graphics/M_DOOM.jpg').dest === 'upscaled/graphics/M_DOOM.png');
  const tx = up.texturesText([{ def: 'Sprite', name: 'TROOA1', width: 20, height: 30, grab: { x: 10, y: 27 }, dest: 'upscaled/sprites/monsters/TROOA1.png' }, { def: 'Flat', name: 'CLASH', width: 16, height: 16, grab: null, dest: 'upscaled/flats/CLASH.png' }], 2);
  check('TEXTURES: size x scale, XScale/YScale, offsets x scale, the patch', /Sprite "TROOA1", 40, 60\n\{\n\tXScale 2\n\tYScale 2\n\tOffset 20, 54\n\tPatch "upscaled\/sprites\/monsters\/TROOA1.png", 0, 0\n\}/.test(tx));
  check('TEXTURES: walls and floors keep their panning (WorldPanning)', /Flat "CLASH", 32, 32\n\{\n\tXScale 2\n\tYScale 2\n\tWorldPanning\n\tPatch/.test(tx));

  // ---- names, sizes, folders ------------------------------------------------------------------
  const dest = path.join(lib, up.DEFAULT_FOLDER);
  fs.mkdirSync(dest, { recursive: true });
  check('result name: "<mod> upscale 2x.pk3" in 8_UPSCALE', up.resultName(dest, 'Test Mod', 2) === path.join(dest, 'Test Mod upscale 2x.pk3'));
  fs.writeFileSync(path.join(dest, 'Test Mod upscale 2x.pk3'), 'older result');
  check('never overwrite: " (2)" is added', up.resultName(dest, 'Test Mod', 2) === path.join(dest, 'Test Mod upscale 2x (2).pk3'));
  check('names with characters Windows does not allow are cleaned', path.basename(up.resultName(dest, 'a:b?', 4)) === 'a_b_ upscale 4x.pk3');
  const e2 = up.estimateBytes(chosen, 2), e4 = up.estimateBytes(chosen, 4);
  check('size estimate: grows with the scale (4x is about 4 times 2x)', e2 > 0 && e4 > e2 * 3.5 && e4 < e2 * 4.5);
  check('"big" means over 500 MB', up.BIG_RESULT === 500 * 1024 * 1024);
  check('folders with "upscale" in their name are offered', JSON.stringify(up.upscaleFolders([['8_UPSCALE'], ['1_BP'], ['Brutal', 'HD Upscales']])) === '["8_UPSCALE","Brutal/HD Upscales"]');
  const { resolveSection } = require(APP + '/client/utils/sections.js');
  check('the sections put a mod in 8_UPSCALE into "Textures and upscales" by themselves', resolveSection({ id: 'x', folders: ['8_UPSCALE'], folder: '8_UPSCALE' }, {}) === 'textures');

  // ---- a real run (2x with the anime model: engine 4x, then shrink) ---------------------------------
  const states = [];
  const job = up.createJob({ source: pk3, modName: 'Test Mod', images: found.images, kinds: ['texture', 'flat', 'sprite', 'graphic'], scale: 2, model: anime, engine: eng, destDir: dest }, { onUpdate: s => states.push(s) });
  const end = await job.run();
  check('the job finishes: ' + (end.error ? JSON.stringify(end.error) : end.phase), end.phase === 'done' && end.result.images === entries.length);
  check('progress went "picture 1 of N" ... "N of N" with a time left', states.some(s => s.done === 1 && s.total === entries.length) && states[states.length - 1].done === entries.length && states.some(s => typeof s.eta === 'number'));
  check('result: next free name (the older file is kept)', end.result.file === path.join(dest, 'Test Mod upscale 2x (2).pk3') && fs.readFileSync(path.join(dest, 'Test Mod upscale 2x.pk3'), 'utf8') === 'older result');
  check('the source mod is not changed', hash(pk3) === before);
  check('no half-made file and no temp folder left', fs.readdirSync(dest).every(n => !/upscaling/.test(n)) && fs.readdirSync(process.env.TMPDIR).length === 0);
  const z = await readZip(end.result.file);
  const sz = n => png.pngInfo(z[n]) || {};
  check('in the PK3: hires/textures/walls/STARTAN3.png at 2x (128x64)', sz('hires/textures/walls/STARTAN3.png').width === 128 && sz('hires/textures/walls/STARTAN3.png').height === 64);
  check('in the PK3: the sprite at 2x with its offsets x2 in the PNG (grAb 20, 54)', sz('upscaled/sprites/monsters/TROOA1.png').width === 40 && JSON.stringify(png.readGrab(z['upscaled/sprites/monsters/TROOA1.png'])) === '{"x":20,"y":54}');
  const sp = await png.decode(z['upscaled/sprites/monsters/TROOA1.png']);
  const alphas = new Set(); let halo = false; for (let i = 0; i < sp.data.length; i += 4) { alphas.add(sp.data[i + 3]); if (sp.data[i + 3] === 255 && sp.data[i] < 150) halo = true; }
  check('the sprite keeps hard see-through edges, no dark halo', alphas.size === 2 && alphas.has(0) && alphas.has(255) && !halo);
  check('the JPG became a PNG of the right size', sz('upscaled/graphics/M_DOOM.png').width === 48);
  const T = z['TEXTURES.txt'] ? z['TEXTURES.txt'].toString() : '';
  check('TEXTURES.txt: sprite, graphics, both clash names - and not the plain textures', /Sprite "TROOA1", 40, 60/.test(T) && /Offset 20, 54/.test(T) && /Graphic "TITLEPIC", 80, 50/.test(T) && /Offset 4, 6/.test(T) && /Flat "CLASH"/.test(T) && /WallTexture "CLASH", 64, 32/.test(T) && !/STARTAN3/.test(T));
  check('a note inside: for your own use', /should not be shared/.test(String(z['ssgl/upscale-info.txt'])));
  check('the "other" pictures were not chosen, so they are not in it', !Object.keys(z).some(n => /skin/.test(n)));

  // ---- out of memory: smaller tiles, then it works -------------------------------------------------
  const log = path.join(TMP, 'engine.log'); process.env.FAKE_ESRGAN_LOG = log;
  const oom = up.createJob({ source: pk3, modName: 'Oom', images: found.images, kinds: ['flat'], scale: 4, model: eng.list.find(m => m.id === 'oom-x4'), engine: eng, destDir: dest });
  const oomEnd = await oom.run();
  const tiles = fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l)).map(a => a[a.indexOf('-t') + 1]);
  check('out of memory: tried again with smaller tiles (0 -> 100 -> 64) and finished', oomEnd.phase === 'done' && tiles.join(',') === '0,100,64');
  delete process.env.FAKE_ESRGAN_LOG;
  const nv = await up.createJob({ source: pk3, modName: 'Nv', images: found.images, kinds: ['flat'], scale: 4, model: eng.list.find(m => m.id === 'novulkan-x4'), engine: eng, destDir: dest }).run();
  check('no Vulkan: the job stops with a clear reason, nothing left behind', nv.phase === 'error' && nv.error.code === 'noVulkan' && fs.readdirSync(dest).every(n => !/Nv upscale|upscaling/.test(n)) && fs.readdirSync(process.env.TMPDIR).length === 0);

  // ---- cancel: the engine really stops, everything is cleaned --------------------------------------
  process.env.FAKE_ESRGAN_SLOW = '400'; const pidFile = path.join(TMP, 'pid'); process.env.FAKE_ESRGAN_PIDFILE = pidFile;
  const slow = up.createJob({ source: folderMod, modName: 'Slow', images: fromFolder.images, kinds: ['texture', 'flat', 'sprite', 'graphic'], scale: 2, model: fast, engine: eng, destDir: dest });
  const running = slow.run();
  for (let i = 0; i < 100 && !fs.existsSync(pidFile); i++) await wait(50);
  await wait(300);
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  slow.cancel();
  const cancelled = await running;
  await wait(300);
  let alive = true; try { process.kill(pid, 0); } catch (e) { alive = false; }
  check('cancel: the engine process is stopped', !alive);
  check('cancel: state "cancelled", no result, no half-made file, temp folder gone', cancelled.phase === 'cancelled' && !cancelled.result && fs.readdirSync(dest).every(n => !/Slow|upscaling/.test(n)) && fs.readdirSync(process.env.TMPDIR).length === 0);

  // ---- pause (a game was started) and go on -------------------------------------------------------
  fs.unlinkSync(pidFile);
  const pj = up.createJob({ source: folderMod, modName: 'Paused', images: fromFolder.images, kinds: ['texture', 'flat'], scale: 2, model: fast, engine: eng, destDir: dest });
  const pr = pj.run();
  for (let i = 0; i < 100 && !fs.existsSync(pidFile); i++) await wait(50);
  const pid2 = Number(fs.readFileSync(pidFile, 'utf8'));
  pj.pause('game');
  await wait(400);
  let alive2 = true; try { process.kill(pid2, 0); } catch (e) { alive2 = false; }
  check('pause for a game: the engine stops, state "paused" (reason: game)', !alive2 && pj.state.phase === 'paused' && pj.state.pausedReason === 'game');
  pj.resume();
  const pend = await pr;
  check('...and after the game the job goes on and finishes (' + pend.phase + ', ' + (pend.result && pend.result.images) + ')', pend.phase === 'done' && pend.result.images === 4);
  delete process.env.FAKE_ESRGAN_SLOW; delete process.env.FAKE_ESRGAN_PIDFILE;

  // ---- preview ----------------------------------------------------------------------------------------
  const pv = await up.preview({ images: found.images, kinds: ['texture', 'flat', 'sprite', 'graphic'], scale: 2, model: anime, engine: eng });
  check('preview: up to three pictures (a small texture, a sprite with see-through parts, a large one)', pv.length === 3 && pv[0].kind !== 'sprite' && pv.some(s => s.kind === 'sprite'));
  check('preview: before and after as pictures for the screen, after = 2x', pv.every(s => /^data:image\/(png|jpeg);base64,/.test(s.before) && /^data:image\/png;base64,/.test(s.after)) && png.pngInfo(Buffer.from(pv[0].after.split(',')[1], 'base64')).width === pv[0].width * 2);
  check('preview: its temp folder is gone', fs.readdirSync(process.env.TMPDIR).length === 0);

  // ---- temp left by a crash is removed at the next start --------------------------------------------------
  fs.mkdirSync(path.join(process.env.TMPDIR, 'ssgl-upscale-crashed'));
  fs.writeFileSync(path.join(dest, '.~X upscale 2x.pk3.upscaling'), 'half');
  up.cleanOldTemp(); up.cleanPartials(dest);
  check('after a crash: old temp folders and half-made files are removed', fs.readdirSync(process.env.TMPDIR).length === 0 && fs.readdirSync(dest).every(n => !/upscaling/.test(n)));

  // ---- download: the newest release that has the program; only the official address ---------------------
  const rel = (tag, date, names) => ({ tag_name: tag, published_at: date, html_url: 'x', assets: names.map(n => ({ name: n, size: 10, browser_download_url: dl.OFFICIAL + tag + '/' + n })) });
  const releases = [rel('v0.3.0', '2022-09-20', ['realesr-general-x4v3.pth']), rel('v0.2.5.0', '2022-04-24', ['realesrgan-ncnn-vulkan-20220424-windows.zip', 'realesrgan-ncnn-vulkan-20220424-ubuntu.zip']), rel('v0.2.3.0', '2021-12-12', ['realesrgan-ncnn-vulkan-20211212-windows.zip'])];
  const a = dl.pickAsset(releases, 'win32');
  check('download: the newest release WITH a Windows program is used (v0.3.0 has none)', a && a.tag === 'v0.2.5.0' && a.name === 'realesrgan-ncnn-vulkan-20220424-windows.zip');
  const evil = [{ tag_name: 'v9', published_at: '2030-01-01', assets: [{ name: 'realesrgan-ncnn-vulkan-x-windows.zip', size: 1, browser_download_url: 'https://evil.example.com/realesrgan-ncnn-vulkan-x-windows.zip' }] }];
  check('download: only from github.com/xinntao/Real-ESRGAN/releases', dl.pickAsset(evil, 'win32') === null && dl.OFFICIAL === 'https://github.com/xinntao/Real-ESRGAN/releases/download/');
  // unpack of a zip like the real one (with a folder inside), then the engine is found
  const fakeZip = path.join(TMP, 'eng.zip'); const ez = new ZipWriter(fakeZip);
  await ez.add('realesrgan-ncnn-vulkan-20220424-windows/' + up.EXE, Buffer.from('x')); await ez.add('realesrgan-ncnn-vulkan-20220424-windows/models/realesrgan-x4plus.param', Buffer.from('p')); await ez.add('realesrgan-ncnn-vulkan-20220424-windows/models/realesrgan-x4plus.bin', Buffer.from('b')); await ez.add('../../evil.txt', Buffer.from('no')); ez.close();
  const unp = path.join(TMP, 'unpacked'); await dl.unpack(fakeZip, unp);
  check('download: unpacked; the program is found one folder down; nothing written outside', up.findEngine(unp).ok && !fs.existsSync(path.join(TMP, '..', 'evil.txt')));

  fs.rmSync(TMP, { recursive: true, force: true });
})().catch(e => { console.log('MISS crashed: ' + (e.stack || e)); process.exit(1); });
