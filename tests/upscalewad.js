// Upscaler step 2, the whole way with the fake engine: a made-up WAD mod (Doom pictures, a flat,
// a wall texture from TEXTURE1, a flat and a wall texture with the same name) and a PK3 with
// Doom lumps -> a new PK3 with hires/ (and TEXTURES only for the same-named flat / wall).
const fs = require('fs');
const os = require('os');
const path = require('path');
const APP = require('./paths').APP + '';
const check = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ssgl-upwad-'));
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
const archive = require(APP + '/electron/utils/archive.js');
const ZipWriter = require(APP + '/electron/utils/zipwrite.js').default;
const W = require('./fixtures/wadmaker.js');
const readZip = async file => { const fd = fs.openSync(file, 'r'); const out = {}; try { for (const e of archive.listZipEntries(fd, fs.fstatSync(fd).size)) out[e.name] = await archive.readZipEntry(fd, e); } finally { fs.closeSync(fd); } return out; };

const makeEngine = dir => {
  fs.mkdirSync(path.join(dir, 'models'), { recursive: true });
  const exe = path.join(dir, up.EXE);
  fs.writeFileSync(exe, '#!/usr/bin/env node\nrequire(' + JSON.stringify(path.join(__dirname, 'fixtures', 'fake-esrgan.js')) + ');\n');
  fs.chmodSync(exe, 0o755);
  ['realesrgan-x4plus', 'realesrgan-x4plus-anime'].forEach(n => { fs.writeFileSync(path.join(dir, 'models', n + '.param'), 'p'); fs.writeFileSync(path.join(dir, 'models', n + '.bin'), 'b'); });
  return dir;
};

(async () => {
  const GRID = [[10, 20, -1], [11, -1, 31], [12, 21, 32]];
  const block = (w, h, c) => Array.from({ length: h }, () => Array.from({ length: w }, () => c));
  const mod = W.wad([
    { name: 'S_START' }, { name: 'TROOA1', data: W.picture(GRID, { left: 1, top: 3 }) }, { name: 'S_END' },
    { name: 'F_START' }, { name: 'FLAT5_4', data: W.flat(64) }, { name: 'SAMEX', data: W.flat(64) }, { name: 'F_END' },
    { name: 'P_START' }, { name: 'PWALL', data: W.picture(block(8, 8, 50)) }, { name: 'P_END' },
    { name: 'TITLEPIC', data: W.picture(block(16, 10, 70)) },
    { name: 'PNAMES', data: W.pnames(['PWALL']) },
    { name: 'TEXTURE1', data: W.textureLump([
      { name: 'AASHITTY', width: 8, height: 8, patches: [{ x: 0, y: 0, patch: 0 }] },
      { name: 'STARTAN2', width: 16, height: 8, patches: [{ x: 0, y: 0, patch: 0 }, { x: 8, y: 0, patch: 0 }] },
      { name: 'SAMEX', width: 8, height: 8, patches: [{ x: 0, y: 0, patch: 0 }] }
    ]) }
  ]);
  const lib = path.join(TMP, 'lib');
  fs.mkdirSync(lib);
  const modFile = path.join(lib, 'classic.wad');
  fs.writeFileSync(modFile, mod);
  const iwad = path.join(TMP, 'GAME.WAD');
  fs.writeFileSync(iwad, W.wad([{ name: 'PLAYPAL', data: W.palette() }], 'IWAD'));

  const noPal = await up.collect(modFile);
  check('a WAD mod: supported; counted by kind (sprite, flats, wall textures, graphic; patches and the "null" texture not)', noPal.supported && noPal.kinds.sprite.count === 1 && noPal.kinds.flat.count === 2 && noPal.kinds.texture.count === 2 && noPal.kinds.graphic.count === 1 && noPal.images.length === 6);
  check('...no PLAYPAL in it and no game chosen: "needs a palette"', noPal.needsPalette === true && noPal.palette === '' && noPal.doomCount === 6);
  const found = await up.collect(modFile, { palette: iwad });
  check('...with the game chosen: the colours come from its PLAYPAL', found.needsPalette === false && found.palette === 'iwad');
  const troo = found.images.find(i => i.name === 'TROOA1');
  const trooPng = await troo.readPng();
  const trooImg = png.decode(trooPng);
  check('readPng of a Doom sprite: a PNG with see-through and the colours of the palette', trooImg.width === 3 && trooImg.data[3] === 255 && trooImg.data[2 * 4 + 3] === 0 && trooImg.data[0] === 10 && trooImg.data[1] === 245);

  const eng = up.findEngine(makeEngine(path.join(TMP, 'tools', 'realesrgan')));
  const dest = path.join(lib, '8_UPSCALE');
  const job = up.createJob({ source: modFile, modName: 'classic', images: found.images, kinds: ['texture', 'flat', 'sprite', 'graphic'], scale: 2, model: eng.list[0], look: 'natural', engine: eng, destDir: dest });
  const end = await job.run();
  check('the job: done, every picture made', end.phase === 'done' && end.result.images === 6 && !end.result.rejected.length);
  const z = await readZip(end.result.file);
  const names = Object.keys(z).sort();
  check('in the new PK3: hires/ by the original names (sprite, flat, wall texture, title)', ['hires/sprites/TROOA1.png', 'hires/flats/FLAT5_4.png', 'hires/textures/STARTAN2.png', 'hires/graphics/TITLEPIC.png'].every(n => names.indexOf(n) > -1));
  check('...2x the size of the originals (wall texture 16x8 -> 32x16, flat 64 -> 128)', png.decode(z['hires/textures/STARTAN2.png']).width === 32 && png.decode(z['hires/textures/STARTAN2.png']).height === 16 && png.decode(z['hires/flats/FLAT5_4.png']).width === 128 && png.decode(z['hires/sprites/TROOA1.png']).width === 6);
  const T = String(z['TEXTURES.txt'] || '');
  check('a flat and a wall texture with the same name (SAMEX): kept apart with TEXTURES "Flat" and "WallTexture" (XScale / YScale 2)', !z['hires/flats/SAMEX.png'] && !z['hires/textures/SAMEX.png'] && !!z['upscaled/flats/SAMEX.png'] && !!z['upscaled/textures/SAMEX.png'] && /Flat "SAMEX", 128, 128\s*\{\s*XScale 2\s*YScale 2\s*WorldPanning\s*Patch "upscaled\/flats\/SAMEX.png", 0, 0/.test(T) && /WallTexture "SAMEX", 16, 16/.test(T));
  check('...no TEXTURES entries for anything else, no patches, no "null" texture', (T.match(/^(Flat|WallTexture|Sprite|Graphic) /gm) || []).length === 2 && !names.some(n => /PWALL|AASHITTY/.test(n)));

  // ---- a PK3 with Doom lumps (no .png) next to PNG files ----------------------------------------
  const pk3 = path.join(lib, 'mixed.pk3');
  const zw = new ZipWriter(pk3);
  await zw.add('playpal.lmp', W.palette());
  await zw.add('sprites/POSSA1', W.picture(GRID));
  await zw.add('graphics/STBAR.lmp', W.picture(block(20, 4, 90)));
  await zw.add('sprites/SHOTA0.png', png.encode({ width: 2, height: 2, data: Buffer.from([200, 90, 40, 255, 200, 90, 40, 255, 0, 0, 0, 0, 200, 90, 40, 255]) }));
  zw.close();
  const mixed = await up.collect(pk3);
  check('PK3: the PNG as before, plus the Doom lumps (now readable, not "coming next")', mixed.images.length === 3 && mixed.doomFormat.length === 0 && mixed.palette === 'mod' && mixed.images.find(i => i.name === 'POSSA1').doom === 'picture');
  const end2 = await up.createJob({ source: pk3, modName: 'mixed', images: mixed.images, kinds: ['sprite', 'graphic'], scale: 2, model: eng.list[0], look: 'natural', engine: eng, destDir: dest }).run();
  const z2 = await readZip(end2.result.file);
  check('...in the new PK3: hires/sprites/POSSA1.png and hires/graphics/STBAR.png (the .lmp is dropped from the name)', end2.phase === 'done' && !!z2['hires/sprites/POSSA1.png'] && !!z2['hires/graphics/STBAR.png'] && !!z2['hires/sprites/SHOTA0.png']);

  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
})().catch(e => { console.log('MISS crashed: ' + (e.stack || e)); process.exit(1); });
