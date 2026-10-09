// Tools > Upscaler: monsters, weapons and items (pictures with see-through parts).
// The bug: in GZDoom some sprites were a rectangle of coloured noise, some were gone.
// Checked here with tiny made-up PNGs (fixtures/pngs.js) and the fake engine:
// every PNG kind is read, the engine never gets an alpha channel, the see-through part
// comes from the original, one colour under it, the layout is hires/ only, smaller
// palette files, and the safety net (a result that looks wrong keeps the original).
const fs = require('fs');
const os = require('os');
const path = require('path');
const APP = require('./paths').APP + '';
const check = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ssgl-sprites-'));
process.env.TMPDIR = process.env.TEMP = process.env.TMP = path.join(TMP, 'sys');
fs.mkdirSync(process.env.TMPDIR);
require('@babel/register')({
  presets: [[APP + '/node_modules/@babel/preset-env', { targets: { node: 'current' } }]],
  babelrc: false, configFile: false, cache: false, extensions: ['.js'],
  only: [/app[\\/]electron[\\/]utils/]
});
const Module = require('module');
const origReq = Module.prototype.require;
Module.prototype.require = function (r) { return r === 'electron' ? { app: { getPath: () => TMP } } : origReq.apply(this, arguments); };

const png = require(APP + '/electron/utils/png.js');
const up = require(APP + '/electron/utils/upscaler.js');
const ZipWriter = require(APP + '/electron/utils/zipwrite.js').default;
const archive = require(APP + '/electron/utils/archive.js');
const F = require('./fixtures/pngs');

const readZip = async file => { const fd = fs.openSync(file, 'r'); const out = {}; try { for (const e of archive.listZipEntries(fd, fs.fstatSync(fd).size)) out[e.name] = await archive.readZipEntry(fd, e); } finally { fs.closeSync(fd); } return out; };
const makeEngine = dir => {
  fs.mkdirSync(path.join(dir, 'models'), { recursive: true });
  const exe = path.join(dir, up.EXE);
  fs.writeFileSync(exe, '#!/usr/bin/env node\nrequire(' + JSON.stringify(path.join(__dirname, 'fixtures', 'fake-esrgan.js')) + ');\n');
  fs.chmodSync(exe, 0o755);
  ['realesrgan-x4plus-anime', 'alphabug-x4', 'noisy-x4'].forEach(n => { fs.writeFileSync(path.join(dir, 'models', n + '.param'), 'p'); fs.writeFileSync(path.join(dir, 'models', n + '.bin'), 'b'); });
  return up.findEngine(dir);
};
const visible = img => { let n = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) n++; return n; };

(async () => {
  // ---- every kind of PNG is read the same way (pngjs) ------------------------------
  const kinds = { 'palette + tRNS': F.palette(12, 10), RGBA: F.rgba(12, 10), 'grey + alpha': F.grayAlpha(12, 10), '16 bit': F.rgba16(12, 10), interlaced: F.interlaced(12, 10) };
  const ref = png.decode(F.rgba(12, 10));
  Object.entries(kinds).forEach(([name, buf]) => {
    const img = png.decode(buf);
    let sameAlpha = img.width === 12 && img.height === 10;
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== ref.data[i]) sameAlpha = false;
    check(`PNG kind "${name}": read, 12x10, the see-through part is right`, sameAlpha);
  });
  check('interlaced: the colours are right too', png.decode(F.interlaced(12, 10)).data.equals(png.decode(F.rgba(12, 10)).data));

  // ---- the parts --------------------------------------------------------------------
  const fig = png.decode(F.rgba(12, 10));
  check('alpha kinds: classic sprite = "binary", wall = "opaque"', png.alphaKind(fig) === 'binary' && png.alphaKind(png.decode(F.rgb(8, 8))) === 'opaque');
  const a2 = png.scaleAlpha(fig, 2, true);
  check('the see-through part made 2x bigger from the original: hard edges, same shape', a2.length === 24 * 20 && Array.from(a2).every(v => v === 0 || v === 255) && a2[(5 * 2) * 24 + 6 * 2] === 255 && a2[0] === 0);
  const filled = png.fillHidden(png.decode(F.rgba(12, 10)));
  const sent = png.decode(png.encode(png.fillHidden(png.decode(F.rgba(12, 10))), { rgb: true }));
  check('...and they really reach the engine as they are (no white edges: pngjs would blend with white)', (() => { for (let i = 0; i < sent.data.length; i += 4) if (sent.data[i] !== 200) return false; return true; })());
  check('the colours hidden under the see-through part are replaced (no cyan, no random colours for the engine)', (() => { for (let i = 0; i < filled.data.length; i += 4) if (filled.data[i + 1] === 255) return false; return true; })());

  // ---- a mod with every kind of sprite --------------------------------------------------
  const lib = path.join(TMP, 'wads'); fs.mkdirSync(lib, { recursive: true });
  const pk3 = path.join(lib, 'Sprite_Test.pk3');
  const zw = new ZipWriter(pk3);
  await zw.add('sprites/pal/PALSA0.png', F.palette(24, 30, { grab: { x: 12, y: 28 } }));
  await zw.add('sprites/rgba/RGBAA0.png', F.rgba(24, 30));
  await zw.add('sprites/grey/GREYA0.png', F.grayAlpha(24, 30));
  await zw.add('sprites/deep/DEEPA0.png', F.rgba16(24, 30));
  await zw.add('sprites/inter/INTRA0.png', F.interlaced(24, 30));
  await zw.add('textures/WALL1.png', F.rgb(32, 32));
  zw.close();
  const found = await up.collect(pk3);
  check('collect: 5 sprites (every PNG kind) and 1 wall', found.kinds.sprite.count === 5 && found.kinds.texture.count === 1);

  const eng = makeEngine(path.join(TMP, 'tools', 'realesrgan'));
  const log = path.join(TMP, 'engine.log'); process.env.FAKE_ESRGAN_LOG = log;
  // the fake engine with the graphics-card bug: alpha in -> noise out
  const bugModel = eng.list.find(m => m.id === 'alphabug-x4');
  const dest = path.join(lib, '8_UPSCALE');
  const end = await up.createJob({ source: pk3, modName: 'Sprite Test', images: found.images, kinds: ['texture', 'flat', 'sprite'], scale: 2, model: bugModel, look: 'natural', engine: eng, destDir: dest }).run();
  const inputs = fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(x => !Array.isArray(x));
  check('the engine never gets an alpha channel (every input is RGB, colour type 2)', inputs.length === 6 && inputs.every(x => x.colorType === 2));
  check('so the "alpha bug" of the graphics card cannot make noise: all 6 made, none rejected', end.phase === 'done' && end.result.images === 6 && end.result.rejected.length === 0);
  const z = await readZip(end.result.file);
  const names = Object.keys(z).filter(n => /\.png$/.test(n)).sort();
  check('layout like the working reference: only hires/, file name = original name + .png', JSON.stringify(names) === JSON.stringify(['hires/sprites/deep/DEEPA0.png', 'hires/sprites/grey/GREYA0.png', 'hires/sprites/inter/INTRA0.png', 'hires/sprites/pal/PALSA0.png', 'hires/sprites/rgba/RGBAA0.png', 'hires/textures/WALL1.png']));
  check('no TEXTURES, no grAb (GZDoom takes size and offsets from the original by name)', !z['TEXTURES.txt'] && names.every(n => !F.hasChunk(z[n], 'grAb')));
  let allGood = true;
  names.filter(n => /sprites/.test(n)).forEach(n => {
    const info = png.pngInfo(z[n]);
    const img = png.decode(z[n]);
    const under = new Set();
    let vis = 0;
    for (let i = 0; i < img.data.length; i += 4) { if (img.data[i + 3]) vis++; else under.add(img.data.readUInt32BE(i) >>> 8); }
    const ok = info.width === 48 && info.height === 60 && info.interlace === 0 && info.bitDepth <= 8 && info.colorType === 3 && F.hasChunk(z[n], 'tRNS') && vis > 0 && vis < 48 * 60 && under.size === 1;
    if (!ok) { allGood = false; console.log('  ', n, JSON.stringify(info), vis, under.size); }
  });
  check('every sprite: 2x, 8 bit or less, not interlaced, palette + tRNS, see-through part kept, ONE colour under it', allGood);
  const pal = png.decode(z['hires/sprites/pal/PALSA0.png']);
  const orig = png.decode(F.palette(24, 30));
  let shapeOk = true; for (let y = 0; y < 60; y++) for (let x = 0; x < 48; x++) if ((pal.data[(y * 48 + x) * 4 + 3] > 0) !== (orig.data[((y >> 1) * 24 + (x >> 1)) * 4 + 3] > 0)) shapeOk = false;
  check('Look Natural: the see-through shape is exactly the original\'s, made 2x bigger (Smooth: see upscalelook.js)', shapeOk);
  check('the wall keeps all its colours (RGB, no palette)', png.pngInfo(z['hires/textures/WALL1.png']).colorType === 2);

  // ---- smaller files ---------------------------------------------------------------------
  const one = await up.createJob({ source: pk3, modName: 'Full', images: found.images, kinds: ['sprite'], scale: 2, model: bugModel, engine: eng, destDir: dest, small: false }).run();
  const zf = await readZip(one.result.file);
  const sizeOf = zz => Object.keys(zz).filter(n => /sprites/.test(n)).reduce((s, n) => s + zz[n].length, 0);
  check('"Smaller files" off: sprites stay full colour (RGBA)', png.pngInfo(zf['hires/sprites/rgba/RGBAA0.png']).colorType === 6);
  check(`"Smaller files" on makes the sprites smaller (${sizeOf(z)} vs ${sizeOf(zf)} bytes)`, sizeOf(z) < sizeOf(zf));
  check('size estimate: smaller with "fewer colours"', up.estimateBytes(found.images, 2, true) < up.estimateBytes(found.images, 2, false));

  // ---- the safety net ----------------------------------------------------------------------
  const meta = { width: 12, height: 10, alpha: 'binary', orig: fig };
  const good = png.decode(F.rgba(24, 20));
  check('safety net: a good result passes', up.checkResult(meta, good, 2) === '');
  check('...wrong size is refused', up.checkResult(meta, png.decode(F.rgba(23, 20)), 2) === 'size');
  const clear = png.decode(F.rgba(24, 20)); for (let i = 3; i < clear.data.length; i += 4) clear.data[i] = 0;
  check('...fully see-through (the original was not) is refused', up.checkResult(meta, clear, 2) === 'empty');
  const solid = png.decode(F.rgba(24, 20)); for (let i = 3; i < solid.data.length; i += 4) solid.data[i] = 255;
  check('...alpha lost (the original had see-through parts) is refused', up.checkResult(meta, solid, 2) === 'noAlpha');
  const noise = png.decode(F.rgba(24, 20)); for (let i = 0; i < noise.data.length; i++) if (i % 4 !== 3) noise.data[i] = Math.random() * 256;
  check('...noise (the small copy does not look like the original) is refused', up.checkResult(meta, noise, 2) === 'noise');

  // the whole job with an engine that only makes noise: nothing wrong goes in
  const noisy = await up.createJob({ source: pk3, modName: 'Noisy', images: found.images, kinds: ['texture', 'sprite'], scale: 2, model: eng.list.find(m => m.id === 'noisy-x4'), engine: eng, destDir: dest }).run();
  check('noise from the engine: the job stops with "no picture could be made" and leaves no file', noisy.phase === 'error' && noisy.error.code === 'nothingMade' && !fs.readdirSync(dest).some(n => /Noisy/.test(n)));
  // a mod where only some pictures go wrong: those keep the original, the rest is made, they are counted
  const mixed = path.join(lib, 'Mixed.pk3'); const mz = new ZipWriter(mixed);
  await mz.add('sprites/OKAYA0.png', F.rgba(16, 20)); await mz.add('sprites/BADDA0.png', F.rgba(16, 20)); mz.close();
  const mf = await up.collect(mixed);
  const job = up.createJob({ source: mixed, modName: 'Mixed', images: mf.images, kinds: ['sprite'], scale: 2, model: eng.list.find(m => m.id === 'realesrgan-x4plus-anime'), engine: eng, destDir: dest });
  // the fake engine makes the first input (BADDA0, in path order) noise, as the graphics card did
  process.env.FAKE_ESRGAN_NOISE_FOR = '00000';
  const mixedEnd = await job.run();
  delete process.env.FAKE_ESRGAN_NOISE_FOR;
  const mzz = mixedEnd.result ? await readZip(mixedEnd.result.file) : {};
  check('one picture looks wrong: it is left out (the original stays), the other is made', mixedEnd.phase === 'done' && !!mzz['hires/sprites/OKAYA0.png'] && !mzz['hires/sprites/BADDA0.png']);
  check('...and it is counted for the message at the end ("1 picture was not upscaled")', mixedEnd.result && mixedEnd.result.rejected.length === 1 && /BADDA0/.test(mixedEnd.result.rejected[0].path) && mixedEnd.result.rejected[0].reason === 'noise');
  check('no temp folder left', fs.readdirSync(process.env.TMPDIR).length === 0);

  fs.rmSync(TMP, { recursive: true, force: true });
})().catch(e => { console.log('MISS crashed: ' + (e.stack || e)); process.exit(1); });
