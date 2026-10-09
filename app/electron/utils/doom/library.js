import fs from 'fs';
import path from 'path';

import { listZipEntries, peekZipEntry, readZipEntry } from '../archive';
import { decode as decodePng, encode } from '../png';
import { contentType, decodeFlat, decodePicture, flatSide, HEAD_BYTES, imageSize, pngOffsets, readPalette, toRgba, withOffsets } from './picture';
import { compose, parseTexturesText, readPnames, readTextureLump } from './textures';
import { openWad } from './wad';

// All the pictures of a WAD or a PK3, in Doom's own formats and as PNG / JPG:
//   scan(source, { palette: <IWAD file> }) -> {
//     type: 'wad' | 'zip', entries, unsupported: [{ name, reason }], problems, bad,
//     palette: 'mod' | 'iwad' | '' }
//   entry = { id, name, path, kind, type, width, height, left, top, bytes, alpha, isNull }
//     kind: 'sprite' | 'flat' | 'texture' | 'graphic' | 'patch' | 'hires'
//     type: 'picture' (Doom picture) | 'flat' | 'composed' (wall texture) | 'png' | 'jpg'
//   readRgba(id) -> { width, height, data, left, top }       readPng(id) -> PNG bytes (+ grAb offsets)
// Where a picture belongs comes from the WAD markers or the PK3 folder, what it is from its
// content (never from the name or the extension).

// ---- WAD namespaces ---------------------------------------------------------------------------
const NS_START = {
  S_START: 'sprite', SS_START: 'sprite',
  F_START: 'flat', FF_START: 'flat',
  P_START: 'patch', PP_START: 'patch', P1_START: 'patch', P2_START: 'patch', P3_START: 'patch',
  TX_START: 'texture', HI_START: 'hires',
  C_START: 'skip', A_START: 'skip', V_START: 'skip', VX_START: 'skip'
};
const NS_END = /^(S|SS|F|FF|P|PP|P1|P2|P3|TX|HI|C|A|V|VX)_END$/;
const INNER_MARKER = /^(F[123]|P[123])_(START|END)$/;
const FOLDER = { sprite: 'sprites', flat: 'flats', patch: 'patches', texture: 'textures', graphic: 'graphics', hires: 'hires' };
const MAP_LUMPS = new Set(['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP', 'BEHAVIOR', 'SCRIPTS', 'TEXTMAP', 'ZNODES', 'DIALOGUE', 'ENDMAP', 'LEAFS', 'LIGHTS', 'MACROS']);

// ---- PK3 folders ----------------------------------------------------------------------------
const ZIP_FOLDER = { sprites: 'sprite', flats: 'flat', patches: 'patch', textures: 'texture', graphics: 'graphic', hires: 'hires' };
const shortName = file => {
  const base = path.posix.basename(file);
  const dot = base.lastIndexOf('.');
  return (dot > 0 ? base.slice(0, dot) : base).slice(0, 8).toUpperCase();
};

// a source = a list of lumps { name, path, ns, size, read(max) }
const wadLumps = file => {
  const wad = openWad(file);
  const lumps = [];
  let ns = '';
  const all = wad.lumps;
  for (let i = 0; i < all.length; i++) {
    const l = all[i];
    if (NS_START[l.name] !== undefined) {
      ns = NS_START[l.name];
      continue;
    }
    if (NS_END.test(l.name)) {
      ns = '';
      continue;
    }
    if (INNER_MARKER.test(l.name)) continue;
    // a map: its marker and its lumps
    const nextName = all[i + 1] && all[i + 1].name;
    if (!ns && (nextName === 'THINGS' || nextName === 'TEXTMAP') && l.size === 0) continue;
    if (!ns && MAP_LUMPS.has(l.name)) continue;
    if (!ns && /^GL_/.test(l.name)) continue;
    lumps.push({ name: l.name, path: (FOLDER[ns || 'graphic'] || 'other') + '/' + l.name, ns: ns || 'global', size: l.size, pos: l.pos, read: max => wad.read(l, max) });
  }
  return { type: 'wad', lumps, bad: wad.bad, problems: wad.problems };
};

const zipLumps = file => {
  const fd = fs.openSync(file, 'r');
  try {
    const entries = listZipEntries(fd, fs.fstatSync(fd).size);
    const lumps = [];
    entries.forEach(e => {
      if (/\/$/.test(e.name) || !e.size) return;
      const parts = e.name.split('/');
      const top = parts.length > 1 ? ZIP_FOLDER[parts[0].toLowerCase()] : '';
      // the start of a file is unpacked only as far as needed
      const read = async max => {
        const f = fs.openSync(file, 'r');
        try {
          if (max !== undefined && max < e.size) {
            const head = peekZipEntry(f, e, max);
            if (head) return head.slice(0, max);
          }
          const buf = await readZipEntry(f, e);
          return max === undefined ? buf : buf.slice(0, max);
        } finally {
          fs.closeSync(f);
        }
      };
      const ns = top || (parts.length === 1 ? 'global' : 'other');
      // in other folders (models, sounds ...) only files named like pictures are looked at
      if (ns === 'other' && !/\.(png|jpe?g)$/i.test(e.name)) return;
      lumps.push({ name: shortName(e.name), path: e.name, ns, size: e.size, read });
    });
    return { type: 'zip', lumps, bad: 0, problems: [] };
  } finally {
    fs.closeSync(fd);
  }
};

// ---- the IWAD of the package: palette and patches the mod uses but does not have --------------
const baseCache = new Map();
const baseOf = async iwad => {
  if (!iwad) return null;
  let st;
  try {
    st = fs.statSync(iwad);
  } catch (e) {
    return null;
  }
  const key = iwad + '|' + st.size + '|' + st.mtimeMs;
  if (baseCache.has(key)) return baseCache.get(key);
  let src;
  try {
    src = wadLumps(iwad);
  } catch (e) {
    return null;
  }
  const byName = new Map();
  let palette = null;
  let pnames = null;
  for (const l of src.lumps) {
    if (l.name === 'PLAYPAL' && !palette) palette = readPalette(await l.read(768));
    else if (l.name === 'PNAMES' && !pnames) pnames = readPnames(await l.read());
    if (l.ns === 'patch' || l.ns === 'global' || l.ns === 'sprite') if (!byName.has(l.name) || l.ns === 'patch') byName.set(l.name, l);
  }
  const base = { palette, pnames, byName };
  baseCache.clear();
  baseCache.set(key, base);
  return base;
};

// ---- the scan ---------------------------------------------------------------------------------
export const scan = async (source, options = {}) => {
  const st = fs.statSync(source);
  const fd = fs.openSync(source, 'r');
  let head;
  try {
    head = Buffer.alloc(4);
    fs.readSync(fd, head, 0, 4, 0);
  } finally {
    fs.closeSync(fd);
  }
  const isWad = /^[IP]WAD$/.test(head.toString('latin1'));
  if (st.isDirectory()) throw Object.assign(new Error('folder'), { code: 'folder' });
  const src = isWad ? wadLumps(source) : zipLumps(source);
  const base = await baseOf(options.palette);

  const entries = [];
  const unsupported = [];
  let bad = src.bad;
  let palette = null;
  let pnames = null;
  const textureLumps = [];
  const texturesText = [];
  const byName = new Map(); // name -> lump, for patches of wall textures
  // lumps the caller reads itself (options.skip): not listed, but a wall texture may use them
  const lazy = new Map();

  for (const l of src.lumps) {
    const upper = l.name;
    if (l.ns === 'global' || (src.type === 'zip' && l.ns === 'other' && l.path.split('/').length === 1)) {
      if (upper === 'PLAYPAL' && !palette) {
        palette = readPalette(await l.read(768));
        continue;
      }
      if (upper === 'PNAMES') {
        pnames = readPnames(await l.read());
        continue;
      }
      if (upper === 'TEXTURE1' || upper === 'TEXTURE2') {
        textureLumps.push({ name: upper, lump: l });
        continue;
      }
      if (upper === 'TEXTURES') {
        texturesText.push(l);
        continue;
      }
    }
    if (l.ns === 'skip') continue;
    if (options.skip && options.skip(l)) {
      if (!lazy.has(upper)) lazy.set(upper, l);
      continue;
    }
    const first = await l.read(Math.min(l.size, HEAD_BYTES));
    let type = contentType(first, l.size);
    if (!type && l.ns === 'flat') type = 'flat';
    if (l.ns === 'other' && type !== 'png' && type !== 'jpg') continue;
    if (!type) {
      // in a namespace a lump that is no picture is counted; outside it is just not a picture
      if (l.ns !== 'global') bad++;
      continue;
    }
    const kind = l.ns === 'global' ? 'graphic' : l.ns;
    let width;
    let height;
    let left = 0;
    let top = 0;
    if (type === 'picture') {
      width = first.readInt16LE(0);
      height = first.readInt16LE(2);
      left = first.readInt16LE(4);
      top = first.readInt16LE(6);
    } else if (type === 'flat') {
      width = flatSide(l.size);
      height = width;
    } else {
      const info = imageSize(first);
      if (!info) {
        bad++;
        continue;
      }
      width = info.width;
      height = info.height;
      if (type === 'png') ({ left, top } = pngOffsets(first));
    }
    const entry = { id: entries.length, name: upper, path: l.path, kind, type, width, height, left, top, bytes: l.size, alpha: type !== 'flat' && type !== 'jpg', lump: l };
    entries.push(entry);
    if (kind === 'patch' || !byName.has(upper) || byName.get(upper).kind !== 'patch') byName.set(upper, entry);
  }

  // wall textures: TEXTURE1 / TEXTURE2 + PNAMES (the IWAD's PNAMES if the mod has none),
  // then TEXTURES (later ones win)
  const defs = [];
  for (const t of textureLumps) {
    const r = readTextureLump(await t.lump.read(), pnames || (base && base.pnames) || [], t.name);
    r.problems.forEach(p => unsupported.push({ name: t.name, reason: p }));
    r.textures.forEach(d => defs.push(d));
  }
  for (const l of texturesText) {
    const r = parseTexturesText((await l.read()).toString('latin1'));
    r.skipped.forEach(s => unsupported.push({ name: s.name, reason: s.reason }));
    r.defs.forEach(d => defs.push(d));
  }
  const lastDef = new Map();
  defs.forEach(d => lastDef.set(d.kind + '|' + d.name, d));
  lastDef.forEach(d => {
    if (d.unsupported) {
      unsupported.push({ name: d.name, reason: d.unsupported });
      return;
    }
    if (d.isNull || d.kind === 'patch') return;
    entries.push({ id: entries.length, name: d.name, path: FOLDER[d.kind] + '/' + d.name, kind: d.kind, type: 'composed', width: d.width, height: d.height, left: d.offset ? d.offset.x : 0, top: d.offset ? d.offset.y : 0, bytes: 0, alpha: true, def: d });
  });

  const pal = palette || (base && base.palette) || null;
  const ctx = { entries, byName, lazy, base, palette: pal, cache: new Map() };
  return {
    type: src.type,
    entries: entries.map(({ lump, def, ...e }) => e),
    unsupported,
    problems: src.problems,
    bad,
    palette: palette ? 'mod' : pal ? 'iwad' : '',
    readRgba: id => readRgba(ctx, entries[id]),
    readPng: async id => {
      const img = await readRgba(ctx, entries[id]);
      return withOffsets(encode(img), img.left, img.top);
    }
  };
};

const noPalette = () => Object.assign(new Error('no palette'), { code: 'noPalette' });

// one picture as RGBA
const readRgba = async (ctx, e) => {
  if (!e) throw Object.assign(new Error('no such picture'), { code: 'missing' });
  if (e.type === 'composed') {
    const pics = new Map();
    for (const p of e.def.patches) {
      if (pics.has(p.name)) continue;
      pics.set(p.name, await patchRgba(ctx, p.name));
    }
    const img = compose(e.def, name => pics.get(name));
    return { ...img, left: e.left, top: e.top };
  }
  const buf = await e.lump.read();
  if (e.type === 'png' || e.type === 'jpg') {
    if (e.type === 'jpg') throw Object.assign(new Error('jpg'), { code: 'jpg' });
    const img = decodePng(buf);
    return { width: img.width, height: img.height, data: img.data, left: e.left, top: e.top };
  }
  if (!ctx.palette) throw noPalette();
  const pic = e.type === 'flat' ? decodeFlat(buf) : decodePicture(buf);
  return { ...toRgba(pic, ctx.palette), left: pic.left, top: pic.top };
};

// a patch of a wall texture, by name: from the mod, else from the IWAD
const patchRgba = async (ctx, name) => {
  if (ctx.cache.has(name)) return ctx.cache.get(name);
  let out = null;
  try {
    const own = ctx.byName.get(name);
    if (own && own.type !== 'composed') out = await readRgba(ctx, own);
    else if (ctx.lazy.has(name) || (ctx.base && ctx.base.byName.has(name))) {
      const l = ctx.lazy.get(name) || ctx.base.byName.get(name);
      const buf = await l.read();
      const type = contentType(buf);
      if (type === 'png') out = decodePng(buf);
      else if (type === 'picture' && ctx.palette) out = toRgba(decodePicture(buf), ctx.palette);
    }
  } catch (e) {
    out = null;
  }
  ctx.cache.set(name, out);
  return out;
};
