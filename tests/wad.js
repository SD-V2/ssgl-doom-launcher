// Upscaler step 2: Doom's own picture formats, read by SSGL's own code. Tiny made-up WADs and
// PK3s (fixtures/wadmaker.js, no game data): the WAD directory, Doom pictures (posts, gaps,
// offsets, "tall" pictures), flats, the palette (of the mod or of the IWAD), namespaces,
// wall textures from TEXTURE1 / PNAMES and TEXTURES, broken files, a 20 MB WAD.
const fs = require('fs');
const os = require('os');
const path = require('path');
const APP = require('./paths').APP + '';
const check = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ssgl-wad-'));
require('@babel/register')({
  presets: [[APP + '/node_modules/@babel/preset-env', { targets: { node: 'current' } }]],
  babelrc: false, configFile: false, cache: false, extensions: ['.js'],
  only: [/app[\\/]electron[\\/]utils/]
});
const wadjs = require(APP + '/electron/utils/doom/wad.js');
const pic = require(APP + '/electron/utils/doom/picture.js');
const tex = require(APP + '/electron/utils/doom/textures.js');
const lib = require(APP + '/electron/utils/doom/library.js');
const png = require(APP + '/electron/utils/png.js');
const ZipWriter = require(APP + '/electron/utils/zipwrite.js').default;
const W = require('./fixtures/wadmaker.js');

const file = (name, buf) => { const f = path.join(TMP, name); fs.writeFileSync(f, buf); return f; };
const px = (img, x, y) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rgba = i => W.colour(i).concat(255);
const CLEAR = [0, 0, 0, 0];

// a patch 4 x 5 with two posts in column 1 and an empty column 3
const GRID = [
  [10, 20, 30, -1],
  [11, -1, 31, -1],
  [12, -1, -1, -1],
  [13, 21, -1, -1],
  [14, 22, 32, -1]
];

(async () => {
  // ---- the directory --------------------------------------------------------------------------
  const small = W.wad([{ name: 'PLAYPAL', data: W.palette() }, { name: 'S_START' }, { name: 'TROOA1', data: W.picture(GRID, { left: 2, top: -3 }) }, { name: 'S_END' }]);
  const f1 = file('small.wad', small);
  const fd = fs.openSync(f1, 'r');
  const dir = wadjs.readDirectory(fd, small.length);
  fs.closeSync(fd);
  check('WAD directory: type, names, positions and sizes', dir.type === 'PWAD' && dir.lumps.map(l => l.name).join() === 'PLAYPAL,S_START,TROOA1,S_END' && dir.lumps[0].size === 768 * 14 && dir.lumps[1].size === 0 && dir.bad === 0);
  let notWad = '';
  try { const f = fs.openSync(file('x.wad', Buffer.from('JUNKJUNKJUNKJUNK')), 'r'); wadjs.readDirectory(f, 16); } catch (e) { notWad = e.code; }
  check('not a WAD: a clear error', notWad === 'notWad');

  // ---- Doom pictures ----------------------------------------------------------------------------
  const p = pic.decodePicture(W.picture(GRID, { left: 2, top: -3 }));
  check('picture: size and offsets (also negative)', p.width === 4 && p.height === 5 && p.left === 2 && p.top === -3);
  const img = pic.toRgba(p, W.palette());
  check('picture: every pixel exactly (two posts in a column, a gap, an empty column)', GRID.every((row, y) => row.every((v, x) => same(px(img, x, y), v < 0 ? CLEAR : rgba(v)))));
  const tallGrid = [];
  for (let y = 0; y < 300; y++) tallGrid.push([y >= 260 || (y >= 200 && y < 204) ? (y & 127) : -1, y === 10 ? 5 : -1]);
  const tall = pic.toRgba(pic.decodePicture(W.picture(tallGrid, { tall: true })), W.palette());
  check('a "tall" picture (300 pixels high, tops counted from the last post)', tall.height === 300 && same(px(tall, 0, 299), rgba(299 & 127)) && same(px(tall, 0, 260), rgba(260 & 127)) && same(px(tall, 0, 259), CLEAR) && same(px(tall, 0, 201), rgba(201 & 127)) && same(px(tall, 1, 10), rgba(5)));
  check('header test like GZDoom: sizes 1..2048, first column right after the list', pic.looksLikePicture(W.picture(GRID)) && !pic.looksLikePicture(Buffer.from('MUS\x1a' + 'x'.repeat(40))) && !pic.looksLikePicture(Buffer.alloc(20)));

  // ---- flats ------------------------------------------------------------------------------------
  const fl = pic.toRgba(pic.decodeFlat(W.flat(64)), W.palette());
  check('flat 64 x 64: every pixel', fl.width === 64 && same(px(fl, 5, 7), rgba((5 + 21) & 255)) && same(px(fl, 63, 63), rgba((63 + 189) & 255)));
  check('flat sizes from the lump length as GZDoom (8, 16, 32, 128, 256; anything else = 64)', [64, 256, 1024, 16384, 65536, 4160, 8192].map(n => pic.flatSide(n)).join() === '8,16,32,128,256,64,64');

  // ---- PNG out: the offsets go along -----------------------------------------------------------
  const out = pic.pictureToPng(p, W.palette());
  const back = png.decode(out);
  check('PNG with alpha and the offsets (grAb chunk), pixels the same', same(pic.pngOffsets(out), { left: 2, top: -3 }) && back.width === 4 && same(px(back, 1, 1), CLEAR) && same(px(back, 2, 0), rgba(30)));

  // ---- textures: TEXTURE1 + PNAMES --------------------------------------------------------------
  const A = W.picture([[1, 1], [1, 1]]); // 2 x 2
  const B = W.picture([[2, -1, 2], [-1, 2, -1]]); // 3 x 2 with holes
  const T1 = W.textureLump([
    { name: 'AASHITTY', width: 4, height: 4, patches: [{ x: 0, y: 0, patch: 0 }] },
    { name: 'WALL1', width: 4, height: 4, patches: [{ x: 0, y: 0, patch: 0 }, { x: 1, y: 1, patch: 1 }, { x: -1, y: 3, patch: 0 }, { x: 3, y: -1, patch: 1 }, { x: 9, y: 9, patch: 0 }] },
    { name: 'WALL2', width: 2, height: 2, patches: [{ x: 0, y: 0, patch: 5 }], scale: [16, 16] }
  ]);
  const names = tex.readPnames(W.pnames(['PA', 'PB']));
  const r1 = tex.readTextureLump(T1, names);
  check('TEXTURE1: names, sizes, patches, ZDoom scale bytes; the first one is the "null" texture', r1.textures.length === 3 && r1.textures[1].patches.length === 5 && r1.textures[0].isNull && r1.textures[2].xscale === 2 && r1.textures[2].patches[0].name === '');
  const rs = tex.readTextureLump(W.textureLump([{ name: 'STRIFE1', width: 2, height: 2, patches: [{ x: 1, y: -1, patch: 1 }] }], { strife: true }), names);
  check('Strife layout found and read', rs.textures.length === 1 && rs.textures[0].patches[0].name === 'PB' && rs.textures[0].patches[0].x === 1 && rs.textures[0].patches[0].y === -1);
  const pal = W.palette();
  const pics = { PA: pic.toRgba(pic.decodePicture(A), pal), PB: pic.toRgba(pic.decodePicture(B), pal) };
  const w1 = tex.compose(r1.textures[1], n => pics[n]);
  // the expected pixels, by the rules: patches in order, later ones cover earlier ones, holes stay
  const want = Array.from({ length: 4 }, () => [-1, -1, -1, -1]);
  const put = (g, ox, oy) => g.forEach((row, y) => row.forEach((v, x) => { const tx = ox + x; const ty = oy + y; if (v >= 0 && tx >= 0 && ty >= 0 && tx < 4 && ty < 4) want[ty][tx] = v; }));
  put([[1, 1], [1, 1]], 0, 0); put([[2, -1, 2], [-1, 2, -1]], 1, 1); put([[1, 1], [1, 1]], -1, 3); put([[2, -1, 2], [-1, 2, -1]], 3, -1);
  check('wall texture put together: every pixel (overlap: later wins; holes; negative and outside offsets)', want.every((row, y) => row.every((v, x) => same(px(w1, x, y), v < 0 ? CLEAR : rgba(v)))) && w1.missing.length === 0);
  check('...a patch number that is not in PNAMES is reported, not guessed', tex.compose(r1.textures[2], n => pics[n]).missing.join() === '?');

  // ---- TEXTURES (text) --------------------------------------------------------------------------
  const txt = `// a comment
WallTexture "BIGWALL", 4, 2 { XScale 2.0 YScale 2 Patch "PA", 0, 0 Patch "PB", 1, 0 }
Flat "FLOOR9", 2, 2 { Patch PA, 0, 0 }
Sprite "SPRTA0", 2, 2 { Offset 1, 2 Patch "PA", 0, 0 }
Texture "FANCY", 2, 2 { Patch "PA", 0, 0 { FlipX Rotate 90 } }
/* old style */ define OLDTEX 64 64
Graphic optional "M_LOGO", 2, 2 { Patch "PA", 0, 0 }`;
  const pt = tex.parseTexturesText(txt);
  const byName = n => pt.defs.find(d => d.name === n);
  check('TEXTURES: WallTexture with scale and two patches', byName('BIGWALL') && byName('BIGWALL').kind === 'texture' && byName('BIGWALL').xscale === 2 && byName('BIGWALL').patches.length === 2 && !byName('BIGWALL').unsupported);
  check('TEXTURES: Flat, Sprite (with Offset), Graphic optional', byName('FLOOR9').kind === 'flat' && byName('SPRTA0').offset.x === 1 && byName('SPRTA0').offset.y === 2 && byName('M_LOGO').optional);
  check('TEXTURES: patch options (FlipX, Rotate) and old "define" lines are listed as not supported, with the reason', /patchOptions: FlipX Rotate/.test(byName('FANCY').unsupported) && pt.skipped.some(s => s.reason === 'oldDefine'));

  // ---- a whole WAD: namespaces, palette, textures ----------------------------------------------
  const mod = W.wad([
    { name: 'PLAYPAL', data: W.palette() },
    { name: 'MAP01' }, { name: 'THINGS', data: Buffer.alloc(20) }, { name: 'LINEDEFS', data: Buffer.alloc(28) },
    { name: 'TITLEPIC', data: W.picture(GRID) },
    { name: 'DECORATE', data: Buffer.from('actor Foo { states { spawn: TNT1 A -1 stop } }') },
    { name: 'DSPISTOL', data: Buffer.from([3, 0, 0x11, 0x2b, 4, 0, 0, 0, 1, 2, 3, 4]) },
    { name: 'S_START' }, { name: 'TROOA1', data: W.picture(GRID, { left: 2, top: 30 }) }, { name: 'BADSPR', data: Buffer.from('not a picture at all') }, { name: 'S_END' },
    { name: 'SS_START' }, { name: 'PNGSPR', data: pic.withOffsets(png.encode(pics.PA), 5, 6) }, { name: 'SS_END' },
    { name: 'F_START' }, { name: 'F1_START' }, { name: 'FLAT5_4', data: W.flat(64) }, { name: 'F1_END' }, { name: 'F_END' },
    { name: 'P_START' }, { name: 'PA', data: A }, { name: 'PB', data: B }, { name: 'P_END' },
    { name: 'TX_START' }, { name: 'TXWALL', data: W.picture([[3, 3]]) }, { name: 'TX_END' },
    { name: 'HI_START' }, { name: 'HIRESX', data: png.encode(pics.PA) }, { name: 'HI_END' },
    { name: 'PNAMES', data: W.pnames(['PA', 'PB']) },
    { name: 'TEXTURE1', data: T1 },
    { name: 'TEXTURES', data: Buffer.from(txt) }
  ]);
  const modFile = file('mod.wad', mod);
  const s = await lib.scan(modFile);
  const e = n => s.entries.find(x => x.name === n);
  check('namespaces: sprite, flat (inner F1_ markers skipped), patch, TX texture, HI hires, global graphic', e('TROOA1').kind === 'sprite' && e('FLAT5_4').kind === 'flat' && e('PA').kind === 'patch' && e('TXWALL').kind === 'texture' && e('HIRESX').kind === 'hires' && e('TITLEPIC').kind === 'graphic' && !e('F1_START') && !e('S_START'));
  check('by content, not by name: PNG in a sprite namespace is a PNG (with its offsets); a sound or text lump is no picture', e('PNGSPR').type === 'png' && e('PNGSPR').left === 5 && e('PNGSPR').top === 6 && !e('DSPISTOL') && !e('DECORATE'));
  check('map lumps are never pictures; a broken lump in a namespace is counted', !e('THINGS') && !e('LINEDEFS') && !e('MAP01') && !e('BADSPR') && s.bad === 1);
  check('wall textures from TEXTURE1 and TEXTURES; the "null" texture is left out; unsupported ones listed', e('WALL1').type === 'composed' && e('BIGWALL').type === 'composed' && !e('AASHITTY') && s.unsupported.some(u => u.name === 'FANCY'));
  check('sizes and offsets in the list', e('TROOA1').width === 4 && e('TROOA1').height === 5 && e('TROOA1').left === 2 && e('TROOA1').top === 30 && e('FLAT5_4').width === 64);
  check('the palette of the mod is used', s.palette === 'mod' && same(px(await s.readRgba(e('TROOA1').id), 0, 0), rgba(10)));
  const wallImg = await s.readRgba(e('WALL1').id);
  check('a wall texture from the WAD: every pixel', want.every((row, y) => row.every((v, x) => same(px(wallImg, x, y), v < 0 ? CLEAR : rgba(v)))));
  const sprPng = await s.readPng(e('TROOA1').id);
  check('readPng: a PNG with the offsets of the original', same(pic.pngOffsets(sprPng), { left: 2, top: 30 }) && png.decode(sprPng).width === 4);

  // ---- the palette of the IWAD when the mod has none ---------------------------------------------
  const otherPal = W.palette(); for (let i = 0; i < 768; i++) otherPal[i] = 255 - otherPal[i];
  const iwad = file('game.wad', W.wad([{ name: 'PLAYPAL', data: otherPal }, { name: 'PNAMES', data: W.pnames(['PA', 'PB']) }, { name: 'P_START' }, { name: 'PA', data: A }, { name: 'PB', data: B }, { name: 'P_END' }], 'IWAD'));
  const noPal = file('nopal.wad', W.wad([{ name: 'S_START' }, { name: 'TROOA1', data: W.picture(GRID) }, { name: 'S_END' }, { name: 'TEXTURE1', data: T1 }]));
  const sNo = await lib.scan(noPal);
  let code = ''; try { await sNo.readRgba(sNo.entries.find(x => x.name === 'TROOA1').id); } catch (err) { code = err.code; }
  check('no palette in the mod and no game chosen: listed, but "needs a palette"', sNo.palette === '' && sNo.entries.length > 0 && code === 'noPalette');
  const sIw = await lib.scan(noPal, { palette: iwad });
  check('the chosen IWAD gives the palette', sIw.palette === 'iwad' && same(px(await sIw.readRgba(sIw.entries.find(x => x.name === 'TROOA1').id), 0, 0), [255 - 10, 10, 255 - ((10 * 7) & 255), 255]));
  const w1b = await sIw.readRgba(sIw.entries.find(x => x.name === 'WALL1').id);
  check('...and its PNAMES and patches for wall textures the mod defines but does not have the patches for', w1b.missing.length === 0 && same(px(w1b, 0, 0).slice(3), [255]));
  const withPal = await lib.scan(modFile, { palette: iwad });
  check('a mod with its own PLAYPAL keeps it even when a game is chosen', withPal.palette === 'mod');

  // ---- PK3: lumps without extension, PNG without .png ------------------------------------------
  const pk3 = path.join(TMP, 'lumps.pk3');
  const zw = new ZipWriter(pk3);
  await zw.add('playpal.lmp', W.palette());
  await zw.add('sprites/monsters/TROOA1', W.picture(GRID, { left: 1, top: 2 }));
  await zw.add('flats/FLOOR7', W.flat(64));
  await zw.add('textures/PNGTEX', png.encode(pics.PA));
  await zw.add('graphics/STBAR.lmp', W.picture([[4, 5]]));
  await zw.add('patches/PA', A);
  await zw.add('textures.txt', Buffer.from('WallTexture "ZWALL", 2, 2 { Patch "PA", 0, 0 }'));
  await zw.add('sounds/DSPISTOL', Buffer.from([3, 0, 0x11, 0x2b]));
  await zw.add('models/skin.png', png.encode(pics.PA));
  zw.close();
  const z = await lib.scan(pk3);
  const ze = n => z.entries.find(x => x.name === n);
  check('PK3: a Doom picture without extension in sprites/, a raw flat, a PNG without .png, a .lmp graphic, TEXTURES in textures.txt', z.palette === 'mod' && ze('TROOA1').type === 'picture' && ze('TROOA1').left === 1 && ze('FLOOR7').type === 'flat' && ze('PNGTEX').type === 'png' && ze('STBAR').type === 'picture' && ze('STBAR').kind === 'graphic' && ze('ZWALL').type === 'composed');
  check('PK3: sounds are not looked at; PNG pictures in other folders are "other" (viewer)', !ze('DSPISTOL') && ze('SKIN').kind === 'other');
  check('PK3: pixels of a lump in sprites/', same(px(await z.readRgba(ze('TROOA1').id), 0, 4), rgba(14)));

  // ---- broken files: never a crash, never a hang ----------------------------------------------
  const cut = file('cut.wad', mod.slice(0, Math.floor(mod.length * 0.6)));
  let cutOk = true; let cutRes = null; try { cutRes = await lib.scan(cut); } catch (err) { cutOk = err.code === 'notWad'; }
  check('a WAD cut in the middle (directory lost): no crash, an empty list with a reason', cutOk && cutRes && cutRes.entries.length === 0 && cutRes.problems.length > 0);
  const huge = Buffer.from(small); huge.writeInt32LE(0x7fffffff, 4);
  const t0 = Date.now();
  const hres = await lib.scan(file('huge.wad', huge));
  check(`a directory count of 2 147 483 647: cut to what fits in the file (${Date.now() - t0} ms)`, hres.problems.indexOf('directoryCut') > -1 && Date.now() - t0 < 1000);
  const badPos = Buffer.from(small); badPos.writeInt32LE(small.length + 5000, 12 + small.length - 12 - 16 * 4 + 16 * 2); // TROOA1 points outside
  const bp = await lib.scan(file('badpos.wad', badPos));
  check('a lump that points outside the file is skipped and counted', bp.bad >= 1 && !bp.entries.find(x => x.name === 'TROOA1'));
  const brokenPic = W.picture(GRID); brokenPic[8 + 4 * 4 + 1] = 250; // a post far longer than the lump
  let brokenCode = ''; try { pic.decodePicture(brokenPic); } catch (err) { brokenCode = err.code; }
  check('a picture whose post runs past the end: an error, no crash', brokenCode === 'broken');
  const loop = W.picture([[1]]); loop.writeUInt32LE(8, 8); // the column points into the header
  check('a column that points back into the header is not a picture (no endless loop)', !pic.looksLikePicture(loop));
  const garbage = Buffer.alloc(4096); for (let i = 0; i < garbage.length; i++) garbage[i] = (i * 2654435761) >>> 24;
  let gOk = true; for (let k = 0; k < 200; k++) { const g = Buffer.from(garbage); g.writeInt16LE(1 + (k % 40), 0); g.writeInt16LE(1 + (k % 50), 2); g.writeUInt32LE(8 + 4 * (1 + (k % 40)), 8); try { if (pic.looksLikePicture(g)) pic.decodePicture(g); } catch (err) { gOk = gOk && err.code === 'broken'; } }
  check('200 random broken pictures: only clear errors', gOk);

  // ---- a 20 MB WAD ------------------------------------------------------------------------------
  const big = [{ name: 'PLAYPAL', data: W.palette() }, { name: 'S_START' }];
  const g64 = Array.from({ length: 64 }, (_, y) => Array.from({ length: 64 }, (__, x) => ((x + y) % 7 === 0 ? -1 : (x * y) & 255)));
  const sprite = W.picture(g64);
  let bytes = 0; let n = 0;
  while (bytes < 20 * 1024 * 1024) { big.push({ name: 'SPR' + String(n++).padStart(4, '0') + 'A0', data: sprite }); bytes += sprite.length; }
  big.push({ name: 'S_END' });
  const bigFile = file('big.wad', W.wad(big));
  const t1 = Date.now();
  const bs = await lib.scan(bigFile);
  const scanMs = Date.now() - t1;
  const t2 = Date.now();
  const one = await bs.readRgba(bs.entries[n - 1].id);
  check(`a 20 MB WAD (${n} sprites): listed in ${scanMs} ms (under 4 s), one picture read in ${Date.now() - t2} ms`, bs.entries.length === n && scanMs < 4000 && one.width === 64);

  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
})().catch(e => { console.log('MISS crashed: ' + (e.stack || e)); process.exit(1); });
