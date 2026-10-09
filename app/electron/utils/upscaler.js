import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  detectType,
  listZipEntries,
  peekZipEntry,
  readAt,
  readZipEntry
} from './archive';
import {
  alphaKind,
  applyAlpha,
  decode,
  defringe,
  encode,
  encodePalette,
  fillHidden,
  halve,
  isJpg,
  isPng,
  jpgInfo,
  meanColor,
  mixColors,
  nearest,
  pngInfo,
  scaleAlpha,
  shrinkTo,
  smoothAlpha
} from './png';
import { scan as scanDoom } from './doom/library';
import ZipWriter from './zipwrite';

// The Upscaler (Tools > Upscaler): makes the pictures of a mod bigger with the
// "realesrgan-ncnn-vulkan" program (the engine, runs on the graphics card) and
// saves them as a NEW mod (PK3). The source mod is never changed.
// The design (readers, what goes into the PK3 and why) is in docs/UPSCALER.md.

// ---------------------------------------------------------------------------
// what a picture is, from its place in the mod
// ---------------------------------------------------------------------------
export const KINDS = ['texture', 'flat', 'sprite', 'graphic', 'other'];

const FOLDER_KIND = {
  textures: 'texture',
  patches: 'texture',
  flats: 'flat',
  sprites: 'sprite',
  graphics: 'graphic'
};

// HUD and menu pictures that mods often keep outside "graphics/" (at the top of the
// PK3): status bar and its numbers, faces, keys, the small and big fonts (STCFN, FONTA,
// FONTB), menu pictures (M_), intermission (WI), title and help screens
export const HUD_NAME = /^(stbar|starms|sttnum[0-9]|sttprcnt|sttminus|stysnum[0-9]|stgnum[0-9]|stkeys[0-9]|stf[a-z]+[0-9]*|stcfn[0-9]+|stpb[0-9]|stdisk|stcdrom|m_[a-z0-9_]+|wi[a-z0-9_]+|cwilv[0-9]+|fonta[0-9]+|fontb[0-9]+|amm?num[0-9]+|brdr_[a-z0-9]+|titlepic|interpic|credit|help[0-9]?|bossback|pfub[0-9]|end[0-9]|victory2)$/i;

export const kindOf = inner => {
  const parts = String(inner).replace(/\\/g, '/').split('/');
  const base = parts[parts.length - 1].replace(/\.[^.]*$/, '');
  if (parts.length < 2) return HUD_NAME.test(base) ? 'graphic' : 'other';
  return FOLDER_KIND[parts[0].toLowerCase()] || (HUD_NAME.test(base) && parts.length === 2 && /^(hud|menu|statusbar)$/i.test(parts[0]) ? 'graphic' : 'other');
};

// the name GZDoom knows a picture by: the file name up to its last dot, at most
// 8 letters, upper case (filesystem.cpp in GZDoom)
export const shortName = inner => {
  const base = path.posix.basename(String(inner).replace(/\\/g, '/'));
  const dot = base.lastIndexOf('.');
  return (dot > 0 ? base.slice(0, dot) : base).slice(0, 8).toUpperCase();
};

const PICTURE = /\.(png|jpe?g)$/i;
// files that are pictures in Doom's own format (or unknown) inside a PK3
const LUMPISH = /\.(lmp|raw|bmp|pcx|tga|dds)$|^[^.]+$/i;

// ---------------------------------------------------------------------------
// source readers. Every reader gives the same list:
//   listImages(source) -> [{ kind, name, path, width, height, format, bytes,
//                            readPng() -> Buffer (PNG or JPG file bytes) }]
// Step 2 adds a WAD reader that turns Doom pictures into PNG inside readPng().
// ---------------------------------------------------------------------------
const imageOf = (inner, head, bytes, readPng) => {
  const info = isPng(head) ? pngInfo(head) : isJpg(head) ? jpgInfo(head) : null;
  if (!info) return null;
  return {
    kind: kindOf(inner),
    name: shortName(inner),
    path: inner,
    width: info.width,
    height: info.height,
    format: isPng(head) ? 'png' : 'jpg',
    alpha: isPng(head) ? info.colorType === 4 || info.colorType === 6 || info.colorType === 3 : false,
    bytes,
    readPng
  };
};

// the pictures in Doom's own formats (and wall textures made of patches) that can be upscaled
const DOOM_KINDS = ['texture', 'flat', 'sprite', 'graphic'];
const doomImages = (found, types) =>
  found.entries
    .filter(e => DOOM_KINDS.indexOf(e.kind) > -1 && types.indexOf(e.type) > -1)
    .map(e => ({
      kind: e.kind,
      name: e.name,
      path: e.path,
      width: e.width,
      height: e.height,
      format: 'png',
      alpha: e.alpha,
      bytes: e.bytes,
      doom: e.type,
      readPng: () => found.readPng(e.id)
    }));
// what the screen is told about the Doom pictures of a mod
const doomInfo = (found, images) => ({
  palette: found.palette,
  needsPalette: !found.palette && images.some(i => i.doom && i.doom !== 'png'),
  unsupported: found.unsupported.slice(0, 50),
  unsupportedCount: found.unsupported.length,
  bad: found.bad
});

const zipReader = {
  id: 'zip',
  canRead: (source, type) => type === 'zip',
  async listImages(source, options = {}) {
    const fd = fs.openSync(source, 'r');
    let listed;
    try {
      const entries = listZipEntries(fd, fs.fstatSync(fd).size);
      const images = [];
      const doom = [];
      entries.forEach(e => {
        const kind = kindOf(e.name);
        if (PICTURE.test(e.name)) {
          const head = peekZipEntry(fd, e);
          const img = head
            ? imageOf(e.name, head, e.size, () => {
                const f = fs.openSync(source, 'r');
                return readZipEntry(f, e).finally(() => fs.closeSync(f));
              })
            : null;
          if (img) images.push(img);
          else doom.push(e.name);
        } else if (kind !== 'other' && LUMPISH.test(path.posix.basename(e.name))) {
          // a picture in Doom's own format (step 2), or a PNG without .png
          const head = peekZipEntry(fd, e, 64);
          if (head && (isPng(head) || isJpg(head))) {
            const full = peekZipEntry(fd, e);
            const img = imageOf(e.name, full, e.size, () => {
              const f = fs.openSync(source, 'r');
              return readZipEntry(f, e).finally(() => fs.closeSync(f));
            });
            if (img) images.push(img);
          } else doom.push(e.name);
        }
      });
      const defs = entries.some(e => /^(texture1|texture2|textures)(\.[^/]*)?$/i.test(e.name));
      listed = { images, doom, defs };
    } finally {
      fs.closeSync(fd);
    }
    if (!listed.doom.length && !listed.defs) return { images: listed.images, doomFormat: [] };
    // Doom pictures without .png and wall textures made of patches (step 2); the PNG and JPG
    // files above are read as before
    const found = await scanDoom(source, { palette: options.palette, skip: l => /\.(png|jpe?g)$/i.test(l.path) });
    const extra = doomImages(found, ['picture', 'flat', 'composed']);
    const known = new Set(found.entries.map(e => e.path));
    return {
      images: listed.images.concat(extra),
      doomFormat: listed.doom.filter(n => !known.has(n)),
      ...doomInfo(found, extra)
    };
  }
};

const walk = (dir, base = '') => {
  let out = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    if (d.name[0] === '.') return;
    const rel = base ? base + '/' + d.name : d.name;
    if (d.isDirectory()) out = out.concat(walk(path.join(dir, d.name), rel));
    else if (d.isFile()) out.push(rel);
  });
  return out;
};

const folderReader = {
  id: 'folder',
  canRead: (source, type) => type === 'folder',
  async listImages(source) {
    const images = [];
    const doom = [];
    walk(source).forEach(rel => {
      const file = path.join(source, ...rel.split('/'));
      const kind = kindOf(rel);
      if (!PICTURE.test(rel) && !(kind !== 'other' && LUMPISH.test(path.posix.basename(rel)))) return;
      const fd = fs.openSync(file, 'r');
      let head;
      try {
        head = readAt(fd, 64 * 1024, 0);
      } finally {
        fs.closeSync(fd);
      }
      const img = imageOf(rel, head, fs.statSync(file).size, () => fs.promises.readFile(file));
      if (img) images.push(img);
      else if (kind !== 'other') doom.push(rel);
    });
    return { images, doomFormat: doom };
  }
};

// WAD files: Doom's own formats (and PNG lumps), read by doom/library.js
const wadReader = {
  id: 'wad',
  canRead: (source, type) => type === 'wad',
  async listImages(source, options = {}) {
    const found = await scanDoom(source, { palette: options.palette });
    const images = doomImages(found, ['picture', 'flat', 'composed', 'png']);
    return { images, doomFormat: [], ...doomInfo(found, images) };
  }
};

export const READERS = [zipReader, folderReader, wadReader];

const typeOf = source => {
  const st = fs.statSync(source);
  if (st.isDirectory()) return 'folder';
  const fd = fs.openSync(source, 'r');
  try {
    return detectType(fd);
  } finally {
    fs.closeSync(fd);
  }
};

// -> { type, supported, reason, images, doomFormat, kinds: { kind: { count, pixels } } }
// options: { palette: the IWAD whose PLAYPAL is used when the mod has none }
export const collect = async (source, options = {}) => {
  let type;
  try {
    type = typeOf(source);
  } catch (e) {
    return { type: 'missing', supported: false, reason: 'missing', images: [], doomFormat: [], kinds: summarize([]) };
  }
  const reader = READERS.find(r => r.canRead(source, type));
  if (!reader) {
    return { type, supported: false, reason: 'format', images: [], doomFormat: [], kinds: summarize([]) };
  }
  const { images, doomFormat, ...doom } = await reader.listImages(source, options);
  images.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    type,
    supported: true,
    reason: images.length ? '' : doomFormat.length ? 'doomOnly' : 'none',
    images,
    doomFormat,
    kinds: summarize(images),
    palette: doom.palette || '',
    needsPalette: !!doom.needsPalette,
    doomCount: images.filter(i => i.doom && i.doom !== 'png').length,
    unsupported: doom.unsupported || [],
    unsupportedCount: doom.unsupportedCount || 0,
    bad: doom.bad || 0
  };
};

export const summarize = images => {
  const out = {};
  KINDS.forEach(k => {
    out[k] = { count: 0, pixels: 0 };
  });
  images.forEach(i => {
    out[i.kind].count++;
    out[i.kind].pixels += i.width * i.height;
  });
  return out;
};

// textures and flats are counted together in the screen
export const pickImages = (images, kinds) => {
  const on = new Set(kinds || []);
  return images.filter(i => on.has(i.kind));
};

// ---------------------------------------------------------------------------
// the engine and its models
// ---------------------------------------------------------------------------
export const EXE = process.platform === 'win32' ? 'realesrgan-ncnn-vulkan.exe' : 'realesrgan-ncnn-vulkan';

// friendly names (the screen translates them); the real name always stays visible.
// What the official builds really have (README + models folder of the release zips):
//   v0.2.5.0 / 20220424 (the one SSGL downloads): realesrgan-x4plus, realesrgan-x4plus-anime,
//     realesr-animevideov3 (-x2, -x3, -x4)
//   older builds (20211212, 20210901) also have realesrnet-x4plus
//   newer builds may have realesr-general-x4v3
// The list on screen is always what is really in the models folder.
export const KNOWN_MODELS = {
  'realesrgan-x4plus': 'general',
  'realesrgan-x4plus-anime': 'drawn',
  'realesrnet-x4plus': 'soft',
  'realesr-animevideov3': 'fast',
  'realesr-general-x4v3': 'generalSmall'
};
export const DEFAULT_MODEL = 'realesrgan-x4plus';
// Look "Smooth": the model with the smoothest, cleanest shapes on game sprites
export const SMOOTH_MODEL = 'realesrgan-x4plus-anime';

// the "Look" of the result: Smooth (4x, made smaller with a soft filter, smooth edges),
// Natural (the model as it is), Sharp (keeps more of the original pixels)
export const LOOKS = ['smooth', 'natural', 'sharp'];
export const DEFAULT_LOOK = 'smooth';
export const lookOf = look => (LOOKS.indexOf(look) > -1 ? look : DEFAULT_LOOK);
export const SHARP_MIX = 0.35; // part of the original pixels in "Sharp"

// each of these kinds has its own model (Compare models); flats and others go with textures
export const MODEL_KINDS = ['texture', 'sprite', 'graphic'];
export const modelKind = kind => (kind === 'sprite' || kind === 'graphic' ? kind : 'texture');

// the model for a kind: the one chosen for it (Compare models), else for Smooth sprites and
// graphics the smooth model, else the model of the settings, else the default
export const modelFor = (list, settings, kind) => {
  const has = id => id && (list || []).find(m => m.id === id);
  const s = settings || {};
  const mk = modelKind(kind);
  return (
    has((s.models || {})[mk]) ||
    (lookOf(s.look) === 'smooth' && mk !== 'texture' && has(SMOOTH_MODEL)) ||
    has(s.model) ||
    has(DEFAULT_MODEL) ||
    (list || [])[0] ||
    null
  );
};

// pairs of .param / .bin. "realesr-animevideov3-x2/-x3/-x4" form one model that can
// do several sizes (the engine adds "-x<scale>" to that one name only, see its main.cpp)
const FAMILIES = ['realesr-animevideov3'];
export const listModels = dir => {
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return [];
  }
  const lower = new Set(files.map(f => f.toLowerCase()));
  const pairs = files
    .filter(f => /\.param$/i.test(f))
    .map(f => f.replace(/\.param$/i, ''))
    .filter(n => lower.has(n.toLowerCase() + '.bin'));
  const byId = new Map();
  pairs.forEach(n => {
    const fam = n.match(/^(.*)-x([234])$/i);
    if (fam && FAMILIES.indexOf(fam[1]) > -1) {
      const id = fam[1];
      const m = byId.get(id) || { id, scales: [], family: true };
      m.scales.push(Number(fam[2]));
      byId.set(id, m);
    } else {
      const s = n.match(/x([234])/i);
      byId.set(n, { id: n, scales: [s ? Number(s[1]) : 4], family: false });
    }
  });
  return Array.from(byId.values())
    .map(m => ({ ...m, scales: m.scales.sort(), known: KNOWN_MODELS[m.id] || '' }))
    .sort((a, b) => {
      const order = Object.keys(KNOWN_MODELS);
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.id.localeCompare(b.id);
    });
};

// the model of every kind with a choice -> { texture, sprite, graphic } (model objects)
export const modelsFor = (list, settings) =>
  MODEL_KINDS.reduce((o, k) => Object.assign(o, { [k]: modelFor(list, settings, k) }), {});

// what may be saved as "the model of a kind": only known kinds, only names
export const cleanModels = models =>
  MODEL_KINDS.reduce((o, k) => {
    const id = models && models[k];
    if (typeof id === 'string' && /^[\w.-]{1,80}$/.test(id)) o[k] = id;
    return o;
  }, {});

// how to reach the wanted size with a model: -s for the engine, then maybe half.
// Smooth: always 4x when the model can, then made smaller with a soft filter
export const engineScaleFor = (model, target, look) => {
  if (!model) return null;
  if (look === 'smooth' && target < 4 && 4 % target === 0 && model.scales.indexOf(4) > -1) return { engineScale: 4, shrink: true };
  if (model.scales.indexOf(target) > -1) return { engineScale: target, shrink: false };
  if (model.scales.indexOf(target * 2) > -1) return { engineScale: target * 2, shrink: true };
  return null;
};

// the engine program in a folder (or one folder below it, as a zip may unpack)
export const findEngine = folder => {
  const res = { ok: false, folder, exe: '', models: '', list: [], problem: 'noFolder' };
  if (!folder || !fs.existsSync(folder)) return res;
  const look = [folder];
  try {
    fs.readdirSync(folder, { withFileTypes: true }).forEach(d => {
      if (d.isDirectory()) look.push(path.join(folder, d.name));
    });
  } catch (e) {
    return res;
  }
  const home = look.find(d => fs.existsSync(path.join(d, EXE)));
  if (!home) return { ...res, problem: 'noExe' };
  const models = fs
    .readdirSync(home)
    .map(n => path.join(home, n))
    .find(p => /^models$/i.test(path.basename(p)) && fs.statSync(p).isDirectory());
  if (!models) return { ...res, exe: path.join(home, EXE), problem: 'noModels' };
  const list = listModels(models);
  if (!list.length) return { ...res, exe: path.join(home, EXE), models, problem: 'noModels' };
  return { ok: true, folder, exe: path.join(home, EXE), models, list, problem: '' };
};

// the command line. The engine wants a models folder whose path contains "models".
export const buildCommand = ({ exe, models, model, engineScale, input, output, tile = 0 }) => ({
  file: exe,
  args: [
    '-i', input,
    '-o', output,
    '-n', model,
    '-s', String(engineScale),
    '-t', String(tile),
    '-m', models,
    '-f', 'png',
    '-v'
  ],
  cwd: path.dirname(exe)
});

// one line of what the engine prints -> what happened
export const parseLine = raw => {
  const line = String(raw || '').trim();
  if (!line) return null;
  const done = line.match(/^(.*) -> (.*) done$/);
  if (done) return { type: 'done', input: done[1], output: done[2] };
  const pct = line.match(/^(\d+(?:\.\d+)?)%$/);
  if (pct) return { type: 'percent', value: Number(pct[1]) };
  if (/out of (device |host )?memory|vkAllocateMemory|VK_ERROR_OUT_OF|vkQueueSubmit failed|bad_alloc/i.test(line)) {
    return { type: 'error', oom: true, text: line };
  }
  if (/vkCreateInstance failed|invalid gpu device|no vulkan|vulkan.*not|failed to create gpu instance/i.test(line)) {
    return { type: 'error', novulkan: true, text: line };
  }
  if (/failed|invalid|error|unknown/i.test(line)) return { type: 'error', text: line };
  return { type: 'info', text: line };
};

// stops the engine and everything it started
export const killTree = child => {
  if (!child || child.exitCode !== null || child.killed) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    } else {
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch (e) {
    try {
      child.kill('SIGKILL');
    } catch (e2) {
      // already gone
    }
  }
};

// runs the engine once: -> { code, lines, done: [outputs], oom, novulkan, killed }
export const runEngine = (cmd, onLine = () => {}, onStart = () => {}) =>
  new Promise(resolve => {
    let child;
    const lines = [];
    const res = { code: null, lines, done: [], oom: false, novulkan: false, killed: false };
    try {
      child = spawn(cmd.file, cmd.args, {
        cwd: cmd.cwd,
        windowsHide: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (e) {
      lines.push(e.message);
      return resolve({ ...res, code: -1, startError: e.message });
    }
    try {
      os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
    } catch (e) {
      // not allowed here: it still works, only at normal priority
    }
    onStart(child);
    let rest = '';
    const feed = data => {
      rest += data.toString();
      const parts = rest.split(/\r?\n/);
      rest = parts.pop();
      parts.forEach(l => {
        if (!l.trim()) return;
        lines.push(l);
        if (lines.length > 400) lines.shift();
        const p = parseLine(l);
        if (p && p.type === 'done') res.done.push(p.output);
        if (p && p.oom) res.oom = true;
        if (p && p.novulkan) res.novulkan = true;
        onLine(p, l);
      });
    };
    child.stdout.on('data', feed);
    child.stderr.on('data', feed);
    child.on('error', e => {
      lines.push(e.message);
      res.startError = e.message;
    });
    child.on('close', (code, signal) => {
      if (rest.trim()) feed('\n');
      res.code = code === null ? -1 : code;
      res.killed = !!signal || child.killed;
      resolve(res);
    });
  });

// ---------------------------------------------------------------------------
// the new PK3: where every picture goes (see docs/UPSCALER.md)
//   every picture -> hires/<same folders>/<same name>.png: GZDoom finds it by its
//   name and shows it at the size and with the offsets of the original (no TEXTURES,
//   no grAb needed). This is also how working upscale packs are made.
//   a flat AND a texture with the same name -> TEXTURES for both (hires/ would put
//   one picture on both); any other name used twice -> the original is kept
// ---------------------------------------------------------------------------
const DEF = { texture: 'WallTexture', flat: 'Flat' };

// (a Doom lump in a PK3 may have .lmp or another extension: GZDoom's name stops at the dot)
export const toPng = inner => String(inner).replace(/\.(png|jpe?g|lmp|raw|bmp|pcx|tga|dds)$/i, '') + '.png';

export const plan = (all, chosen) => {
  // the same name with different kinds anywhere in the mod = a clash
  const kindsByName = new Map();
  all.forEach(i => {
    if (!kindsByName.has(i.name)) kindsByName.set(i.name, new Set());
    kindsByName.get(i.name).add(i.kind);
  });
  // the same name and kind twice: the last one (in path order) is the one GZDoom uses
  const last = new Map();
  chosen.forEach(i => last.set(i.kind + '|' + i.name, i));
  const skipped = [];
  const entries = [];
  chosen.forEach(i => {
    if (last.get(i.kind + '|' + i.name) !== i) {
      skipped.push({ path: i.path, reason: 'sameName' });
      return;
    }
    const kinds = Array.from(kindsByName.get(i.name));
    const clash = kinds.length > 1;
    const wallsOnly = kinds.every(k => k === 'texture' || k === 'flat');
    if (clash && !wallsOnly) {
      skipped.push({ path: i.path, reason: 'sameName' });
      return;
    }
    entries.push({
      image: i,
      viaTextures: clash,
      clash,
      def: clash ? DEF[i.kind] : '',
      dest: (clash ? 'upscaled/' : 'hires/') + toPng(i.path)
    });
  });
  return { entries, skipped };
};

const num = v => (Math.round(v * 1000) / 1000).toString();

// the TEXTURES lump: one definition per picture that needs one
export const texturesText = (defs, scale) => {
  const head = [
    '// Made by SSGL (Tools > Upscaler). The pictures are ' + scale + 'x bigger; the scale',
    '// below shows them at their original size in the game.',
    ''
  ];
  const body = defs.map(d => {
    const lines = [`${d.def} "${d.name}", ${d.width * scale}, ${d.height * scale}`, '{'];
    lines.push(`\tXScale ${num(scale)}`, `\tYScale ${num(scale)}`);
    if (d.def === 'WallTexture' || d.def === 'Flat') lines.push('\tWorldPanning');
    lines.push(`\tPatch "${d.dest}", 0, 0`, '}', '');
    return lines.join('\n');
  });
  return head.concat(body).join('\n');
};

// ---------------------------------------------------------------------------
// names, folders, sizes
// ---------------------------------------------------------------------------
export const DEFAULT_FOLDER = '8_UPSCALE';

const cleanName = n =>
  String(n || 'mod')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/, '')
    .trim() || 'mod';

// "<mod> upscale 2x.pk3", never over an existing file: " (2)", " (3)" ...
export const resultName = (dir, modName, scale) => {
  const base = `${cleanName(modName)} upscale ${scale}x`;
  let name = base + '.pk3';
  for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = `${base} (${n}).pk3`;
  return path.join(dir, name);
};

// a rough size of the result: big pictures made by the AI pack about half as well
// as the original pixel art; palette PNGs ("smaller files") about a third of a byte
// per pixel (measured on a working sprite pack: 37 KB for 440 x 300 on average)
export const estimateBytes = (images, scale, small = true) =>
  Math.round(
    images.reduce((sum, i) => {
      const px = i.width * i.height * scale * scale;
      const pal = small && (i.kind === 'sprite' || i.kind === 'graphic');
      return sum + (pal ? px * 0.35 : px * (i.alpha ? 4 : 3) * 0.55) + 120;
    }, 0) + 4096
  );

export const BIG_RESULT = 500 * 1024 * 1024;

// folders below the wads folder that look like a place for upscales
export const upscaleFolders = folders =>
  (folders || [])
    .map(parts => (Array.isArray(parts) ? parts.join('/') : String(parts)))
    .filter(f => /upscal/i.test(f.split('/').pop()));

// ---------------------------------------------------------------------------
// temp folders: always removed (also after a cancel or a crash: at the next start)
// ---------------------------------------------------------------------------
const TEMP_PREFIX = 'ssgl-upscale-';
export const tempRoot = () => os.tmpdir();

export const makeTemp = () => fs.mkdtempSync(path.join(tempRoot(), TEMP_PREFIX));

export const removeDir = dir => {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (e) {
    // in use: the next start takes it away
  }
};

// left-overs of an earlier run that crashed (not the folders of a running job)
export const cleanOldTemp = (keep = []) => {
  try {
    fs.readdirSync(tempRoot())
      .filter(n => n.indexOf(TEMP_PREFIX) === 0)
      .map(n => path.join(tempRoot(), n))
      .filter(p => keep.indexOf(p) < 0)
      .forEach(removeDir);
  } catch (e) {
    // nothing to do
  }
};

const PARTIAL = /^\.~.*\.upscaling$/;
export const partialName = finalFile =>
  path.join(path.dirname(finalFile), '.~' + path.basename(finalFile) + '.upscaling');

export const cleanPartials = dir => {
  try {
    fs.readdirSync(dir)
      .filter(n => PARTIAL.test(n))
      .forEach(n => fs.unlinkSync(path.join(dir, n)));
  } catch (e) {
    // nothing to do
  }
};

// ---------------------------------------------------------------------------
// one picture: before and after the engine
// ---------------------------------------------------------------------------

// Writes the input for the engine: COLOURS ONLY. The engine never gets an alpha
// channel - its alpha path gave noise and empty pictures on some graphics cards
// (walls, which have no alpha, were fine). The see-through part is made again from
// the original later. -> what is needed to finish the picture
export const prepare = async (image, inFile) => {
  const buf = await image.readPng();
  if (isJpg(buf)) {
    const info = jpgInfo(buf);
    fs.writeFileSync(inFile + '.jpg', buf);
    return { file: inFile + '.jpg', width: info.width, height: info.height, alpha: 'opaque', orig: null };
  }
  const img = decode(buf);
  const orig = { width: img.width, height: img.height, data: Buffer.from(img.data) };
  const alpha = alphaKind(img);
  if (alpha !== 'opaque') fillHidden(img);
  fs.writeFileSync(inFile + '.png', encode(img, { rgb: true, level: 1 }));
  return { file: inFile + '.png', width: img.width, height: img.height, alpha, orig };
};

// ---- the safety net: a result that looks wrong never goes into the PK3 --------
export const NOISE_LIMIT = 32; // average colour difference (0..255) of the small copy
export const ROUGH_LIMIT = 20; // how much rougher than the original a result may be

// roughness: the average colour jump between visible neighbours (noise: about 85;
// a real upscale is smoother than its original, as edges spread over more pixels)
export const roughness = img => {
  const { width: w, height: h, data } = img;
  let sum = 0;
  let n = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x + 1 < w; x++) {
      const p = (y * w + x) * 4;
      if (data[p + 3] < 128 || data[p + 7] < 128) continue;
      sum += (Math.abs(data[p] - data[p + 4]) + Math.abs(data[p + 1] - data[p + 5]) + Math.abs(data[p + 2] - data[p + 6])) / 3;
      n++;
    }
  return n ? sum / n : 0;
};

export const checkResult = (meta, img, scale) => {
  if (img.width !== meta.width * scale || img.height !== meta.height * scale) return 'size';
  let visible = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) visible++;
  if (meta.alpha !== 'opaque' && !visible && meta.orig && !isFullyClear(meta.orig)) return 'empty';
  if (meta.alpha !== 'opaque' && visible === img.width * img.height) return 'noAlpha';
  if (meta.orig) {
    // the result made small again must look like the original (not noise)
    const small = shrinkTo(img, meta.width, meta.height);
    let diff = 0;
    let n = 0;
    for (let i = 0; i < small.data.length; i += 4) {
      if (meta.orig.data[i + 3] < 128) continue;
      for (let c = 0; c < 3; c++) diff += Math.abs(small.data[i + c] - meta.orig.data[i + c]);
      n += 3;
    }
    if (n && diff / n > NOISE_LIMIT) return 'noise';
    if (roughness(img) > roughness(meta.orig) + ROUGH_LIMIT) return 'noise';
  }
  return '';
};

const isFullyClear = img => {
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) return false;
  return true;
};

// the engine's result -> the final picture at the wanted size (or a reason it is not
// used). small: a palette PNG with at most 256 colours ("smaller files"). look: see LOOKS
export const finish = (meta, outBuf, scale, small = false, look = 'natural') => {
  let img = decode(outBuf);
  while (img.width >= meta.width * scale * 2 && img.height >= meta.height * scale * 2) img = halve(img);
  if (img.width !== meta.width * scale || img.height !== meta.height * scale) return { problem: 'size' };
  const pixels = look === 'sharp' && meta.orig ? nearest(meta.orig, scale) : null;
  if (meta.alpha === 'opaque') {
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
  } else if (pixels) {
    // Sharp: the see-through part keeps the pixel steps of the original
    const alpha = new Uint8Array(img.width * img.height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = pixels.data[i * 4 + 3];
    applyAlpha(img, alpha, meanColor(meta.orig));
  } else {
    // Smooth: clean edges without the one-pixel stairs (only for solid / see-through
    // sprites; soft alpha like smoke stays soft)
    const alpha =
      look === 'smooth' && meta.alpha === 'binary' ? smoothAlpha(meta.orig, scale) : scaleAlpha(meta.orig, scale, meta.alpha === 'binary');
    applyAlpha(img, alpha, meanColor(meta.orig));
    if (look === 'smooth') defringe(img);
  }
  if (pixels) mixColors(img, pixels, SHARP_MIX);
  const problem = checkResult(meta, img, scale);
  if (problem) return { problem };
  const png = small ? encodePalette(img) : encode(img, { rgb: meta.alpha === 'opaque' });
  return { png, img };
};

// ---------------------------------------------------------------------------
// the job
// ---------------------------------------------------------------------------
const TILES = [0, 100, 64, 32];
const BATCH = 24;
const BATCH_PIXELS = 8 * 1024 * 1024;

export const batches = list => {
  const out = [];
  let cur = [];
  let px = 0;
  list.forEach(e => {
    const p = e.image.width * e.image.height;
    if (cur.length && (cur.length >= BATCH || px + p > BATCH_PIXELS)) {
      out.push(cur);
      cur = [];
      px = 0;
    }
    cur.push(e);
    px += p;
  });
  if (cur.length) out.push(cur);
  return out;
};

const wait = ms => new Promise(r => setTimeout(r, ms));

export class EngineError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail || '';
  }
}

// Runs the engine on prepared files; smaller tiles when the graphics card runs out
// of memory. -> Map(input file -> output file)
const upscaleFiles = async (job, inputs, dir, opts) => {
  const results = new Map();
  let todo = inputs.slice();
  for (let t = job.tileStep; t < TILES.length && todo.length; t++) {
    job.tileStep = t;
    const inDir = path.join(dir, 'in');
    const outDir = path.join(dir, 'out');
    removeDir(inDir);
    removeDir(outDir);
    fs.mkdirSync(inDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });
    todo.forEach(f => fs.copyFileSync(f, path.join(inDir, path.basename(f))));
    const cmd = buildCommand({ ...opts, input: inDir, output: outDir, tile: TILES[t] });
    const res = await runEngine(
      cmd,
      p => job.onEngineLine && job.onEngineLine(p),
      child => {
        job.child = child;
      }
    );
    job.child = null;
    if (job.stopped || job.paused) return results;
    todo.forEach(f => {
      const out = path.join(outDir, path.basename(f).replace(/\.[^.]+$/, '') + '.png');
      if (fs.existsSync(out) && fs.statSync(out).size > 0) {
        const keep = path.join(dir, 'done-' + path.basename(out));
        fs.renameSync(out, keep);
        results.set(f, keep);
      }
    });
    todo = todo.filter(f => !results.has(f));
    if (!todo.length) break;
    if (res.startError) throw new EngineError('engineStart', res.startError);
    if (res.novulkan) throw new EngineError('noVulkan', res.lines.slice(-6).join('\n'));
    // finished normally: the pictures it could not read are counted as failed
    if (!res.oom && res.code === 0) break;
    if (t === TILES.length - 1) {
      throw new EngineError(res.oom ? 'outOfMemory' : 'engineFailed', res.lines.slice(-6).join('\n'));
    }
  }
  return results;
};

// options: { source, modName, images (all), kinds, scale, model (from listModels),
//            models ({ texture, sprite, graphic } -> model, optional), look,
//            engine (from findEngine), destDir }
// hooks:   onUpdate(state)
export const createJob = (options, hooks = {}) => {
  const job = {
    state: {
      phase: 'starting',
      done: 0,
      total: 0,
      pixelsDone: 0,
      pixelsTotal: 0,
      current: '',
      eta: null,
      startedAt: Date.now(),
      pausedReason: '',
      result: null,
      error: null
    },
    child: null,
    stopped: false,
    paused: false,
    tileStep: 0,
    temp: '',
    pausedAt: 0,
    pausedMs: 0
  };
  let resumeNow = null;
  const update = changes => {
    Object.assign(job.state, changes);
    if (hooks.onUpdate) hooks.onUpdate({ ...job.state });
  };

  job.cancel = () => {
    job.stopped = true;
    killTree(job.child);
    if (resumeNow) resumeNow();
  };
  job.pause = reason => {
    if (job.paused || job.stopped || ['done', 'error', 'cancelled'].indexOf(job.state.phase) > -1) return;
    job.paused = true;
    killTree(job.child); // the pictures of this round are made again later
    job.pausedAt = Date.now();
    update({ phase: 'paused', pausedReason: reason || 'user' });
  };
  job.resume = () => {
    if (!job.paused) return;
    job.paused = false;
    job.pausedMs += Date.now() - job.pausedAt;
    update({ phase: 'running', pausedReason: '' });
    if (resumeNow) resumeNow();
  };
  const waitWhilePaused = async () => {
    while (job.paused && !job.stopped) {
      await new Promise(r => {
        resumeNow = r;
      });
      resumeNow = null;
    }
  };

  job.run = async () => {
    const { images, kinds, scale, model, engine, destDir, modName } = options;
    const look = lookOf(options.look);
    const chosen = pickImages(images, kinds);
    const { entries, skipped } = plan(images, chosen);
    // a model per kind (options.models: { texture, sprite, graphic }), else options.model
    const modelOfImage = image => (options.models && options.models[modelKind(image.kind)]) || model;
    const used = [];
    entries.forEach(e => {
      const m = modelOfImage(e.image);
      if (m && !used.find(u => u.model.id === m.id)) used.push({ model: m, how: engineScaleFor(m, scale, look) });
    });
    const pixelsTotal = entries.reduce((s, e) => s + e.image.width * e.image.height, 0);
    update({ phase: job.paused ? 'paused' : 'running', total: entries.length, pixelsTotal });
    if (used.some(u => !u.how) || (entries.length && !used.length)) {
      update({ phase: 'error', error: { code: 'scale', detail: '' } });
      return job.state;
    }
    if (!entries.length) {
      update({ phase: 'error', error: { code: 'nothing', detail: '' } });
      return job.state;
    }

    fs.mkdirSync(destDir, { recursive: true });
    cleanPartials(destDir);
    const finalFile = resultName(destDir, modName, scale);
    const partial = partialName(finalFile);
    const zip = new ZipWriter(partial);
    job.temp = makeTemp();
    const defs = [];
    const failed = [];
    const rejected = [];
    let added = 0;
    // "smaller files": palette PNGs for monsters, weapons, items and graphics
    const smallFor = image => options.small !== false && (image.kind === 'sprite' || image.kind === 'graphic');
    const started = Date.now();
    // one more picture is finished (made or failed): progress and time left
    const step = e => {
      const pixelsDone = job.state.pixelsDone + e.image.width * e.image.height;
      const active = Date.now() - started - job.pausedMs;
      const rate = pixelsDone / Math.max(1, active);
      update({
        done: job.state.done + 1,
        pixelsDone,
        current: e.image.path,
        eta: pixelsDone > 0 && pixelsDone < pixelsTotal ? Math.round((pixelsTotal - pixelsDone) / rate / 1000) : 0
      });
    };

    try {
      // the pictures of one model together, in batches
      const list = [];
      used.forEach(u =>
        batches(entries.filter(e => modelOfImage(e.image).id === u.model.id)).forEach(items => list.push({ ...u, items }))
      );
      for (let b = 0; b < list.length; b++) {
        const batch = list[b].items;
        const { model: bModel, how } = list[b];
        // one round: prepare -> engine -> finish. A pause (a game was started)
        // stops the engine; the round starts again when the game is closed.
        for (;;) {
          await waitWhilePaused();
          if (job.stopped) break;
          const dir = path.join(job.temp, 'b' + b);
          removeDir(dir);
          fs.mkdirSync(path.join(dir, 'prep'), { recursive: true });
          const metas = [];
          for (let i = 0; i < batch.length; i++) {
            if (job.stopped || job.paused) break;
            const e = batch[i];
            try {
              const meta = await prepare(e.image, path.join(dir, 'prep', String(i).padStart(5, '0')));
              metas.push({ e, meta });
            } catch (err) {
              failed.push({ path: e.image.path, reason: 'unreadable' });
              step(e);
            }
          }
          if (job.stopped) break;
          if (job.paused) continue;
          update({ current: batch[0].image.path });
          const done = metas.length
            ? await upscaleFiles(job, metas.map(m => m.meta.file), dir, {
                exe: engine.exe,
                models: engine.models,
                model: bModel.id,
                engineScale: how.engineScale
              })
            : new Map();
          if (job.stopped) break;
          if (job.paused) continue;
          for (const { e, meta } of metas) {
            if (job.stopped) break;
            const out = done.get(meta.file);
            try {
              const made = out ? finish(meta, fs.readFileSync(out), scale, smallFor(e.image), look) : { problem: 'missing' };
              if (made.problem) {
                // looks wrong: nothing is added, GZDoom keeps the original picture
                rejected.push({ path: e.image.path, reason: made.problem });
              } else {
                await zip.add(e.dest, made.png);
                added++;
                if (e.viaTextures) {
                  defs.push({ def: e.def, name: e.image.name, width: meta.width, height: meta.height, dest: e.dest });
                }
              }
            } catch (err) {
              failed.push({ path: e.image.path, reason: 'engineOutput' });
            }
            step(e);
          }
          removeDir(dir);
          break;
        }
        if (job.stopped) break;
        await wait(0);
      }

      if (job.stopped) {
        zip.abort();
        update({ phase: 'cancelled' });
        return job.state;
      }
      if (!added) throw new EngineError('nothingMade', (failed[0] || rejected[0] || {}).path || '');
      if (defs.length) await zip.add('TEXTURES.txt', Buffer.from(texturesText(defs, scale)), { compress: true });
      const info = [
        'Made by SSGL - Tools > Upscaler',
        'Source: ' + path.basename(options.source),
        'Model: ' + used.map(u => u.model.id).join(', ') + '  Scale: ' + scale + 'x  Look: ' + look,
        'Date: ' + new Date().toISOString(),
        '',
        'For your own use. Upscaled copies of other people\'s graphics should not be shared.'
      ].join('\n');
      await zip.add('ssgl/upscale-info.txt', Buffer.from(info), { compress: true });
      const bytes = zip.close();
      // the name may have been taken in the meantime: never overwrite
      const target = fs.existsSync(finalFile) ? resultName(destDir, modName, scale) : finalFile;
      fs.renameSync(partial, target);
      update({
        phase: 'done',
        eta: 0,
        result: { file: target, bytes, images: added, skipped: skipped.concat(failed), rejected }
      });
      return job.state;
    } catch (err) {
      zip.abort();
      update({
        phase: job.stopped ? 'cancelled' : 'error',
        error: { code: err.code || 'failed', detail: err.detail || err.message || String(err) }
      });
      return job.state;
    } finally {
      killTree(job.child);
      removeDir(job.temp);
    }
  };
  return job;
};

// ---------------------------------------------------------------------------
// preview: up to three pictures (a small texture, a sprite with see-through
// parts, a large one), made in a temp folder; -> [{ path, kind, before, after }]
// ---------------------------------------------------------------------------
export const pickSamples = images => {
  const pics = images.filter(i => i.width >= 8 && i.height >= 8);
  const px = i => i.width * i.height;
  const out = [];
  const add = i => i && out.indexOf(i) < 0 && out.push(i);
  add(
    pics
      .filter(i => i.kind === 'texture' || i.kind === 'flat')
      .sort((a, b) => px(a) - px(b))[0]
  );
  add(
    pics
      .filter(i => i.kind === 'sprite' && i.alpha)
      .sort((a, b) => px(b) - px(a))
      .find(i => px(i) <= 256 * 256)
  );
  add(
    pics
      .filter(i => px(i) <= 512 * 512 && out.indexOf(i) < 0)
      .sort((a, b) => px(b) - px(a))[0]
  );
  pics.forEach(i => out.length < 3 && add(i));
  return out.slice(0, 3);
};

const dataUrl = buf => `data:image/${isJpg(buf) ? 'jpeg' : 'png'};base64,${buf.toString('base64')}`;

// the samples through one model -> [{ after, problem, bytesFull, bytesSmall, small }]
const runSamples = async ({ samples, metas, model, scale, look, engine, small, temp, fake }) => {
  const how = engineScaleFor(model, scale, look);
  if (!how) throw new EngineError('scale');
  const dir = path.join(temp, model.id);
  fs.mkdirSync(dir, { recursive: true });
  const done = await upscaleFiles(fake, metas.map(m => m.file), dir, {
    exe: engine.exe,
    models: engine.models,
    model: model.id,
    engineScale: how.engineScale
  });
  if (fake.stopped) return null;
  return samples.map((s, i) => {
    const file = done.get(metas[i].file);
    const made = file ? finish(metas[i], fs.readFileSync(file), scale, false, look) : { problem: 'missing' };
    const useSmall = small && (s.kind === 'sprite' || s.kind === 'graphic');
    // the size of the picture with all colours and with fewer colours
    const smallPng = made.img ? encodePalette(made.img) : null;
    return {
      after: made.png ? dataUrl(useSmall ? smallPng : made.png) : '',
      problem: made.problem || '',
      bytesFull: made.png ? made.png.length : 0,
      bytesSmall: smallPng ? smallPng.length : 0,
      small: useSmall
    };
  });
};

const withSamples = async ({ images, kinds }, hold, work) => {
  const samples = pickSamples(pickImages(images, kinds));
  if (!samples.length) return null;
  const temp = makeTemp();
  const fake = { tileStep: 0, stopped: false, child: null };
  hold.job = fake;
  try {
    const metas = [];
    for (let i = 0; i < samples.length; i++) metas.push(await prepare(samples[i], path.join(temp, 'p' + i)));
    const before = [];
    for (let i = 0; i < samples.length; i++) before.push(dataUrl(await samples[i].readPng()));
    return await work({ samples, metas, before, temp, fake });
  } finally {
    killTree(fake.child);
    removeDir(temp);
  }
};

const sampleInfo = (s, before) => ({ path: s.path, kind: s.kind, width: s.width, height: s.height, before });

export const preview = async ({ images, kinds, scale, model, models, look = DEFAULT_LOOK, engine, small = true }, hold = {}) =>
  (await withSamples({ images, kinds }, hold, async ({ samples, metas, before, temp, fake }) => {
    // each sample with the model of its kind
    const out = samples.map((s, i) => sampleInfo(s, before[i]));
    const byModel = new Map();
    samples.forEach((s, i) => {
      const m = (models && models[modelKind(s.kind)]) || model;
      if (!byModel.has(m.id)) byModel.set(m.id, { m, idx: [] });
      byModel.get(m.id).idx.push(i);
    });
    for (const { m, idx } of byModel.values()) {
      const made = await runSamples({ samples: idx.map(i => samples[i]), metas: idx.map(i => metas[i]), model: m, scale, look, engine, small, temp, fake });
      if (!made) return [];
      idx.forEach((i, k) => Object.assign(out[i], made[k], { model: m.id }));
    }
    return out;
  })) || [];

// "Compare models": the same samples through up to 4 models, one after the other.
// -> { samples: [{ path, kind, width, height, before }], results: [{ model, ms, items: [...] }] }
export const COMPARE_MAX = 4;
export const compare = async ({ images, kinds, scale, look = DEFAULT_LOOK, models, engine, small = true }, hold = {}, onModel = () => {}) =>
  (await withSamples({ images, kinds }, hold, async ({ samples, metas, before, temp, fake }) => {
    const list = (models || []).slice(0, COMPARE_MAX);
    const results = [];
    for (let k = 0; k < list.length; k++) {
      onModel({ done: k, total: list.length, model: list[k].id });
      const t = Date.now();
      const items = await runSamples({ samples, metas, model: list[k], scale, look, engine, small, temp, fake });
      if (!items) return null;
      results.push({ model: list[k].id, ms: Date.now() - t, items });
    }
    onModel({ done: list.length, total: list.length, model: '' });
    return { samples: samples.map((s, i) => sampleInfo(s, before[i])), results };
  })) || { samples: [], results: [] };

// a tiny picture through the engine: does it start at all on this PC?
export const testEngine = async (engine, model) => {
  const temp = makeTemp();
  try {
    const img = { width: 16, height: 16, data: Buffer.alloc(16 * 16 * 4, 200) };
    const file = path.join(temp, 'test.png');
    fs.writeFileSync(file, encode(img, { rgb: true }));
    const how = engineScaleFor(model, model.scales[0]) || { engineScale: model.scales[0] };
    const out = path.join(temp, 'out.png');
    const res = await runEngine(
      buildCommand({ exe: engine.exe, models: engine.models, model: model.id, engineScale: how.engineScale, input: file, output: out })
    );
    const made = fs.existsSync(out) ? pngInfo(fs.readFileSync(out)) : null;
    if (made && made.width === 16 * how.engineScale) return { ok: true, reason: '', detail: '' };
    const detail = res.lines.slice(-6).join('\n') || res.startError || '';
    return { ok: false, reason: res.startError ? 'engineStart' : res.novulkan ? 'noVulkan' : 'engineFailed', detail };
  } finally {
    removeDir(temp);
  }
};
