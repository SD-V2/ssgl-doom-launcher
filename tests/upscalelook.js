// Tools > Upscaler, the "smooth" work: the Look presets (Smooth / Natural / Sharp) and their
// command lines, the model of every kind (chosen in "Compare models", remembered), the
// Compare models flow with the fake engine, HUD and menu pictures counted as "graphics",
// and the edges of sprites: no dark or light halos, no pixel stairs at 2x and 4x.
// Only made-up pictures (fixtures/weapon-sprite.js and shapes drawn here).
const fs = require('fs');
const os = require('os');
const path = require('path');
const APP = require('./paths').APP + '';
const check = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ssgl-uplook-'));
process.env.TMPDIR = process.env.TEMP = process.env.TMP = path.join(TMP, 'sys');
fs.mkdirSync(process.env.TMPDIR);
require('@babel/register')({
  presets: [[APP + '/node_modules/@babel/preset-env', { targets: { node: 'current' } }]],
  babelrc: false, configFile: false, cache: false, extensions: ['.js'],
  only: [/app[\\/]electron[\\/]utils/, /app[\\/]client[\\/]utils[\\/]upscale/]
});
const Module = require('module');
const origReq = Module.prototype.require;
Module.prototype.require = function (r) { return r === 'electron' ? { app: { getPath: () => TMP } } : origReq.apply(this, arguments); };
const png = require(APP + '/electron/utils/png.js');
const up = require(APP + '/electron/utils/upscaler.js');
const ZipWriter = require(APP + '/electron/utils/zipwrite.js').default;
const client = require(APP + '/client/utils/upscale.js');
const weapon = require('./fixtures/weapon-sprite.js');
const archive = require(APP + '/electron/utils/archive.js');
const readZip = async file => { const fd = fs.openSync(file, 'r'); const out = {}; try { for (const e of archive.listZipEntries(fd, fs.fstatSync(fd).size)) out[e.name] = await archive.readZipEntry(fd, e); } finally { fs.closeSync(fd); } return out; };

// the fake engine (fixtures/fake-esrgan.js) with the models of the official build
const makeEngine = dir => {
  fs.mkdirSync(path.join(dir, 'models'), { recursive: true });
  const exe = path.join(dir, up.EXE);
  fs.writeFileSync(exe, '#!/usr/bin/env node\nrequire(' + JSON.stringify(path.join(__dirname, 'fixtures', 'fake-esrgan.js')) + ');\n');
  fs.chmodSync(exe, 0o755);
  ['realesrgan-x4plus', 'realesrgan-x4plus-anime', 'realesr-animevideov3-x2', 'realesr-animevideov3-x3', 'realesr-animevideov3-x4'].forEach(n => {
    fs.writeFileSync(path.join(dir, 'models', n + '.param'), 'p');
    fs.writeFileSync(path.join(dir, 'models', n + '.bin'), 'b');
  });
  return dir;
};

// a picture of w x h, paint(x, y) -> [r, g, b] or null (see-through, hidden colour `under`)
const draw = (w, h, paint, under = [0, 0, 0]) => {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = paint(x, y);
      const p = (y * w + x) * 4;
      if (c) { data[p] = c[0]; data[p + 1] = c[1]; data[p + 2] = c[2]; data[p + 3] = 255; } else { data[p] = under[0]; data[p + 1] = under[1]; data[p + 2] = under[2]; data[p + 3] = 0; }
    }
  return { width: w, height: h, data };
};

// the whole way of one picture, with an "engine" that only copies pixels (like the fake
// one): prepare -> engine output (scaled by -s) -> finish with the Look
const through = async (img, scale, look, model = { scales: [4] }) => {
  const how = up.engineScaleFor(model, scale, look);
  const meta = await up.prepare({ readPng: async () => png.encode(img) }, path.join(TMP, 'p' + Math.random().toString(36).slice(2)));
  const prepared = png.decode(fs.readFileSync(meta.file));
  const made = up.finish(meta, png.encode(png.nearest(prepared, how.engineScale)), scale, false, look);
  return made.img;
};

// how much the outline of a straight slanted edge jumps: for every row, where the edge is
// (the sum of alpha up to it), then how far each step differs from the average step.
// Pixel stairs: steps of 0 and `scale`; a clean line: the same step every row.
const stairs = (img, rows) => {
  const pos = [];
  for (const y of rows) {
    let s = 0;
    for (let x = 0; x < img.width; x++) s += img.data[(y * img.width + x) * 4 + 3] / 255;
    pos.push(s);
  }
  const d = pos.slice(1).map((p, i) => p - pos[i]);
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  return Math.max(...d.map(v => Math.abs(v - mean)));
};

(async () => {
  // ---- models: what the official builds really have ------------------------------------------
  check('models: realesrgan-x4plus is the default; the known names are the ones of the official builds (no made-up names)', up.DEFAULT_MODEL === 'realesrgan-x4plus' && JSON.stringify(Object.keys(up.KNOWN_MODELS)) === '["realesrgan-x4plus","realesrgan-x4plus-anime","realesrnet-x4plus","realesr-animevideov3","realesr-general-x4v3"]');
  const eng = up.findEngine(makeEngine(path.join(TMP, 'tools', 'realesrgan')));
  check('models: the list is what is really in the models folder (v0.2.5.0: three models)', JSON.stringify(eng.list.map(m => m.id)) === '["realesrgan-x4plus","realesrgan-x4plus-anime","realesr-animevideov3"]');
  const [general, anime, fast] = eng.list;

  // ---- the Look: command lines ---------------------------------------------------------------
  const sOf = (m, scale, look) => { const h = up.engineScaleFor(m, scale, look); return up.buildCommand({ exe: eng.exe, models: eng.models, model: m.id, engineScale: h.engineScale, input: 'i', output: 'o' }).args.join(' '); };
  check('Look Smooth: always 4x, then made smaller (fast model at 2x: -s 4)', / -n realesr-animevideov3 -s 4 /.test(sOf(fast, 2, 'smooth')) && up.engineScaleFor(fast, 2, 'smooth').shrink === true);
  check('Look Natural and Sharp: the model as it is (fast model at 2x: -s 2)', / -s 2 /.test(sOf(fast, 2, 'natural')) && / -s 2 /.test(sOf(fast, 2, 'sharp')));
  check('a 4x-only model: -s 4 in every Look; at 4x: -s 4 and nothing made smaller', ['smooth', 'natural', 'sharp'].every(l => / -s 4 /.test(sOf(anime, 2, l))) && up.engineScaleFor(anime, 4, 'smooth').shrink === false);
  check('an unknown Look is Smooth; the three Looks', up.lookOf('shiny') === 'smooth' && up.lookOf('sharp') === 'sharp' && up.LOOKS.join() === 'smooth,natural,sharp');

  // ---- the model of every kind ---------------------------------------------------------------
  const list = eng.list;
  const ids = s => Object.entries(up.modelsFor(list, s)).map(([k, m]) => k + ':' + m.id).join(' ');
  check('Smooth, nothing chosen: textures with the default, sprites and HUD with the drawn-art model', ids({ look: 'smooth' }) === 'texture:realesrgan-x4plus sprite:realesrgan-x4plus-anime graphic:realesrgan-x4plus-anime');
  check('Natural, nothing chosen: everything with the model of the settings', ids({ look: 'natural', model: 'realesr-animevideov3' }) === 'texture:realesr-animevideov3 sprite:realesr-animevideov3 graphic:realesr-animevideov3');
  check('a model chosen for a kind wins (flats and others go with textures)', ids({ look: 'smooth', models: { sprite: 'realesrgan-x4plus', texture: 'realesr-animevideov3' } }) === 'texture:realesr-animevideov3 sprite:realesrgan-x4plus graphic:realesrgan-x4plus-anime' && up.modelKind('flat') === 'texture' && up.modelKind('other') === 'texture');
  check('a chosen model that is not in the folder any more: the next rule is used', up.modelFor(list, { models: { sprite: 'realesrnet-x4plus' }, look: 'natural' }, 'sprite').id === 'realesrgan-x4plus');
  check('saved choices: only the three kinds and real names', JSON.stringify(up.cleanModels({ sprite: 'realesrgan-x4plus', bogus: 'x', graphic: '../../evil', texture: 5 })) === '{"sprite":"realesrgan-x4plus"}');
  check('the screen uses the same rules', ['texture', 'sprite', 'graphic'].every(k => client.modelFor(list, { model: 'realesrgan-x4plus', look: 'smooth', models: { graphic: 'realesr-animevideov3' } }, k).id === up.modelFor(list, { model: 'realesrgan-x4plus', look: 'smooth', models: { graphic: 'realesr-animevideov3' } }, k).id));

  // ---- HUD and menu pictures are "graphics" ------------------------------------------------
  const kinds = n => up.kindOf(n);
  check('HUD and menus at the top of the PK3 are graphics: STBAR, numbers, faces, keys, small font, menu, intermission, title', ['STBAR.png', 'STTNUM0.png', 'STFST01.png', 'STKEYS3.png', 'STCFN065.png', 'FONTA33.png', 'M_DOOM.png', 'WIBP1.png', 'TITLEPIC.png', 'graphics/hud/AMMO.png'].every(n => kinds(n) === 'graphic'));
  check('...but not walls that start the same way (STEP1, STARTAN3, STONE2) or loose pictures', ['STEP1.png', 'STARTAN3.png', 'STONE2.png', 'readme.png'].every(n => kinds(n) === 'other') && kinds('sprites/STBAR.png') === 'sprite');

  // ---- a mod with a wall, a weapon sprite and HUD pictures: the job, Compare models --------
  const pk3 = path.join(TMP, 'lib', 'Look Mod.pk3');
  fs.mkdirSync(path.dirname(pk3), { recursive: true });
  const zw = new ZipWriter(pk3);
  await zw.add('textures/WALL1.png', png.encode(draw(32, 32, (x, y) => [100 + ((x * 7 + y * 3) % 60), 60, 40])));
  await zw.add('sprites/weapons/SHTGA0.png', png.encode(weapon.make()));
  await zw.add('STBAR.png', png.encode(draw(64, 16, (x, y) => [120, 120, 120 + (x % 5) * 10])));
  await zw.add('STTNUM0.png', png.encode(draw(14, 16, (x, y) => (x > 2 && x < 11 && y > 1 && y < 14 && !(x > 5 && x < 8 && y > 4 && y < 11) ? [200, 30, 20] : null))));
  zw.close();
  const found = await up.collect(pk3);
  check('the mod: the status bar and its numbers are found as graphics', found.kinds.graphic && found.kinds.graphic.count === 2);

  const log = path.join(TMP, 'engine.log');
  process.env.FAKE_ESRGAN_LOG = log;
  const dest = path.join(TMP, 'lib', '8_UPSCALE');
  const job = up.createJob({ source: pk3, modName: 'Look Mod', images: found.images, kinds: ['texture', 'flat', 'sprite', 'graphic'], scale: 2, model: general, models: up.modelsFor(list, { look: 'smooth' }), look: 'smooth', engine: eng, destDir: dest });
  const end = await job.run();
  const runs = fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(a => Array.isArray(a));
  const used = runs.map(a => a[a.indexOf('-n') + 1] + ' -s ' + a[a.indexOf('-s') + 1]);
  check('job, Smooth: one engine run per model (textures: x4plus, sprites + HUD: anime), each at 4x', end.phase === 'done' && used.length === 2 && used.indexOf('realesrgan-x4plus -s 4') > -1 && used.indexOf('realesrgan-x4plus-anime -s 4') > -1);
  const made = await readZip(end.result.file);
  check('...the HUD pictures are in the new mod at 2x (hires/STBAR.png, hires/STTNUM0.png)', made['hires/STBAR.png'] && png.decode(made['hires/STBAR.png']).width === 128 && made['hires/STTNUM0.png'] && png.decode(made['hires/STTNUM0.png']).width === 28);
  check('...the info file names the models and the Look', /Model: (realesrgan-x4plus, realesrgan-x4plus-anime|realesrgan-x4plus-anime, realesrgan-x4plus) {2}Scale: 2x {2}Look: smooth/.test(String(made['ssgl/upscale-info.txt'])));
  fs.writeFileSync(log, '');

  const steps = [];
  const cmp = await up.compare({ images: found.images, kinds: ['texture', 'flat', 'sprite', 'graphic'], scale: 2, look: 'smooth', models: list, engine: eng }, {}, p => steps.push(p.done + '/' + p.total));
  const cmpRuns = fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(a => Array.isArray(a));
  check('Compare models: the samples through every model, one after the other (3 engine runs, progress 0/3 .. 3/3)', cmp.results.length === 3 && cmpRuns.length === 3 && steps.join() === '0/3,1/3,2/3,3/3' && cmp.results.map(r => r.model).join() === list.map(m => m.id).join());
  check('...a texture, the weapon sprite and a HUD picture; every model made all of them', cmp.samples.map(s => s.kind).sort().join() === 'graphic,sprite,texture' && cmp.results.every(r => r.items.length === cmp.samples.length && r.items.every(i => /^data:image\/png;base64,/.test(i.after) && !i.problem)));
  check('...the original is sent along (shown with its pixels on screen)', cmp.samples.every(s => /^data:image\/png;base64,/.test(s.before) && s.width > 0));
  check('...at most 4 models', up.COMPARE_MAX === 4 && (await up.compare({ images: found.images, kinds: ['sprite'], scale: 2, models: [general, anime, fast, general, anime], engine: eng })).results.length === 4);
  const pv = await up.preview({ images: found.images, kinds: ['texture', 'flat', 'sprite', 'graphic'], scale: 2, model: general, models: up.modelsFor(list, { look: 'smooth', models: { texture: 'realesr-animevideov3' } }), look: 'smooth', engine: eng });
  check('preview: every sample with the model of its kind', pv.find(s => s.kind === 'texture').model === 'realesr-animevideov3' && pv.find(s => s.kind === 'sprite').model === 'realesrgan-x4plus-anime');
  delete process.env.FAKE_ESRGAN_LOG;

  // ---- edges: no pixel stairs ------------------------------------------------------------------
  // a solid shape with a 45 degree edge and one with a 1:2 edge (one-pixel stairs)
  const diag = draw(40, 40, (x, y) => (x <= y ? [200, 40, 30] : null));
  const shallow = draw(40, 40, (x, y) => (x <= y / 2 + 5 ? [200, 40, 30] : null));
  for (const scale of [2, 4]) {
    const rows = []; for (let y = 10 * scale; y < 30 * scale; y++) rows.push(y);
    const res = {};
    for (const look of ['natural', 'smooth', 'sharp']) res[look] = [stairs(await through(diag, scale, look), rows), stairs(await through(shallow, scale, look), rows)];
    check(`${scale}x: Natural and Sharp keep the pixel stairs of the original (steps off by ${res.natural.map(v => v.toFixed(1)).join(' / ')} and ${res.sharp.map(v => v.toFixed(1)).join(' / ')} px)`, res.natural.every(v => v >= 0.9) && res.sharp.every(v => v >= scale - 1));
    check(`${scale}x: Smooth makes clean lines - the edge moves the same amount every row (stairs ${res.smooth.map(v => v.toFixed(2)).join(' / ')} < 0.35 px)`, res.smooth.every(v => v < 0.35));
  }

  // ---- edges: no halos -------------------------------------------------------------------------
  const ORANGE = [230, 120, 30];
  const blob = under => draw(32, 32, (x, y) => ((x - 15.5) ** 2 + (y - 15.5) ** 2 <= 121 ? ORANGE : null), under);
  const haloOf = img => { let worst = 0; let soft = 0; for (let i = 0; i < img.data.length; i += 4) { if (!img.data[i + 3]) continue; if (img.data[i + 3] < 255) soft++; for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(img.data[i + c] - ORANGE[c])); } return { worst, soft }; };
  for (const scale of [2, 4]) {
    const dark = haloOf(await through(blob([0, 0, 0]), scale, 'smooth'));
    const light = haloOf(await through(blob([255, 255, 255]), scale, 'smooth'));
    check(`${scale}x Smooth: soft edges (${dark.soft} soft pixels) without a dark halo (black behind it) or a light one (white behind it) - colour off by at most ${Math.max(dark.worst, light.worst)}`, dark.soft > 10 && dark.worst <= 12 && light.worst <= 12);
  }
  // a weapon sprite: a thin line and a single pixel stay; the shape is the same
  const w2 = await through(weapon.make(), 2, 'smooth');
  const wSmall = png.shrinkTo(w2, weapon.W, weapon.H);
  let missing = 0; let added = 0;
  const orig = weapon.make();
  for (let i = 3; i < orig.data.length; i += 4) { if (orig.data[i] === 255 && wSmall.data[i] < 64) missing++; if (orig.data[i] === 0 && wSmall.data[i] > 192) added++; }
  check(`weapon sprite 2x Smooth: the same shape (made small again: ${missing} pixels lost, ${added} added)`, missing <= 4 && added <= 4);
  const line = draw(30, 20, (x, y) => (y === 10 && x > 3 && x < 26) || (x === 15 && y === 4) ? [250, 250, 250] : null);
  const l2 = await through(line, 2, 'smooth');
  const aAt = (img, x, y) => img.data[(y * img.width + x) * 4 + 3];
  check('a one-pixel line and a single pixel stay visible in Smooth', aAt(l2, 30, 21) > 200 && Math.max(aAt(l2, 30, 8), aAt(l2, 31, 9), aAt(l2, 30, 9), aAt(l2, 31, 8)) > 100);
  const s2 = await through(weapon.make(), 2, 'sharp');
  const n2 = png.nearest(weapon.make(), 2);
  let off = 0; for (let i = 3; i < s2.data.length; i += 4) if (s2.data[i] !== n2.data[i]) off++;
  check('Sharp: the see-through part is exactly the original, made bigger pixel by pixel', off === 0);

  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
})().catch(e => { console.log('MISS crashed: ' + (e.stack || e)); process.exit(1); });
