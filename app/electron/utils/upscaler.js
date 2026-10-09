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
  bleed,
  decode,
  encode,
  grabChunk,
  halve,
  hardenAlpha,
  isJpg,
  isPng,
  jpgInfo,
  pngInfo,
  readChunks
} from './png';
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

export const kindOf = inner => {
  const parts = String(inner).replace(/\\/g, '/').split('/');
  if (parts.length < 2) return 'other';
  return FOLDER_KIND[parts[0].toLowerCase()] || 'other';
};

// the name GZDoom knows a picture by: the file name without extension, at most
// 8 letters, upper case
export const shortName = inner => {
  const base = path.posix.basename(String(inner).replace(/\\/g, '/'));
  const dot = base.indexOf('.');
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

const zipReader = {
  id: 'zip',
  canRead: (source, type) => type === 'zip',
  async listImages(source) {
    const fd = fs.openSync(source, 'r');
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
      return { images, doomFormat: doom };
    } finally {
      fs.closeSync(fd);
    }
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

// WAD files keep their pictures in Doom's own format: step 2
const wadReader = {
  id: 'wad',
  canRead: (source, type) => type === 'wad',
  supported: false,
  async listImages() {
    return { images: [], doomFormat: [] };
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
export const collect = async source => {
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
  if (reader.supported === false) {
    return { type, supported: false, reason: 'wad', images: [], doomFormat: [], kinds: summarize([]) };
  }
  const { images, doomFormat } = await reader.listImages(source);
  images.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    type,
    supported: true,
    reason: images.length ? '' : doomFormat.length ? 'doomOnly' : 'none',
    images,
    doomFormat,
    kinds: summarize(images)
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

// friendly names (the screen translates them); the real name always stays visible
export const KNOWN_MODELS = {
  'realesrgan-x4plus-anime': 'drawn',
  'realesrgan-x4plus': 'general',
  'realesr-animevideov3': 'fast',
  'realesrnet-x4plus': 'soft',
  'realesr-general-x4v3': 'generalSmall',
  'realesr-general-wdn-x4v3': 'generalSmall'
};
export const DEFAULT_MODEL = 'realesrgan-x4plus-anime';

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

// how to reach the wanted size with a model: -s for the engine, then maybe half
export const engineScaleFor = (model, target) => {
  if (!model) return null;
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
//   textures, flats, other  -> hires/<path>        (GZDoom scales them back itself)
//   sprites, graphics       -> upscaled/<path> + a TEXTURES entry (size, scale, offset)
//   a name used by two different pictures (flat + texture) -> TEXTURES for both
// ---------------------------------------------------------------------------
const DEF = { texture: 'WallTexture', flat: 'Flat', sprite: 'Sprite', graphic: 'Graphic' };

export const toPng = inner => String(inner).replace(/\.(png|jpe?g)$/i, '') + '.png';

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
    const clash = kindsByName.get(i.name).size > 1;
    const viaTextures = i.kind === 'sprite' || i.kind === 'graphic' || (clash && DEF[i.kind]);
    entries.push({
      image: i,
      viaTextures: !!viaTextures,
      clash,
      def: viaTextures ? DEF[i.kind] : '',
      dest: (viaTextures ? 'upscaled/' : 'hires/') + toPng(i.path)
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
    if (d.grab && (d.grab.x || d.grab.y)) lines.push(`\tOffset ${d.grab.x * scale}, ${d.grab.y * scale}`);
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
// as the original pixel art
export const estimateBytes = (images, scale) =>
  Math.round(
    images.reduce((sum, i) => sum + i.width * i.height * scale * scale * (i.alpha ? 4 : 3) * 0.55 + 120, 0) + 4096
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

// writes the input for the engine; -> what is needed to finish it later
export const prepare = async (image, inFile) => {
  const buf = await image.readPng();
  if (isJpg(buf)) {
    const info = jpgInfo(buf);
    fs.writeFileSync(inFile + '.jpg', buf);
    return { file: inFile + '.jpg', width: info.width, height: info.height, grab: null, alpha: 'opaque', extra: [] };
  }
  const chunks = readChunks(buf);
  const grabC = chunks.find(c => c.type === 'grAb');
  const grab = grabC && grabC.data.length >= 8 ? { x: grabC.data.readInt32BE(0), y: grabC.data.readInt32BE(4) } : null;
  // ZDoom's "alPh" mark (an alpha texture) goes with the picture
  const extra = chunks.filter(c => c.type === 'alPh');
  const img = await decode(buf);
  const alpha = alphaKind(img);
  if (alpha !== 'opaque') bleed(img);
  fs.writeFileSync(inFile + '.png', await encode(img, [], { rgb: alpha === 'opaque', level: 1 }));
  return { file: inFile + '.png', width: img.width, height: img.height, grab, alpha, extra };
};

// the engine's result -> the final PNG at the wanted size, with the offsets
export const finish = async (meta, outBuf, scale) => {
  let img = await decode(outBuf);
  while (img.width >= meta.width * scale * 2 && img.height >= meta.height * scale * 2) img = halve(img);
  if (img.width !== meta.width * scale || img.height !== meta.height * scale) {
    throw new Error(`wrong size ${img.width}x${img.height}`);
  }
  if (meta.alpha === 'binary') hardenAlpha(img);
  if (meta.alpha === 'opaque') for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
  const extra = [...meta.extra];
  if (meta.grab) extra.unshift(grabChunk({ x: meta.grab.x * scale, y: meta.grab.y * scale }));
  return encode(img, extra, { rgb: meta.alpha === 'opaque' });
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
    const chosen = pickImages(images, kinds);
    const { entries, skipped } = plan(images, chosen);
    const how = engineScaleFor(model, scale);
    const pixelsTotal = entries.reduce((s, e) => s + e.image.width * e.image.height, 0);
    update({ phase: job.paused ? 'paused' : 'running', total: entries.length, pixelsTotal });
    if (!how) {
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
    let added = 0;
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
      const list = batches(entries);
      for (let b = 0; b < list.length; b++) {
        const batch = list[b];
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
                model: model.id,
                engineScale: how.engineScale
              })
            : new Map();
          if (job.stopped) break;
          if (job.paused) continue;
          for (const { e, meta } of metas) {
            if (job.stopped) break;
            const out = done.get(meta.file);
            try {
              const png = await finish(meta, fs.readFileSync(out), scale);
              await zip.add(e.dest, png);
              added++;
              if (e.viaTextures) {
                defs.push({ def: e.def, name: e.image.name, width: meta.width, height: meta.height, grab: meta.grab, dest: e.dest });
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
      if (!added) throw new EngineError('nothingMade', failed.length ? failed[0].path : '');
      if (defs.length) await zip.add('TEXTURES.txt', Buffer.from(texturesText(defs, scale)), { compress: true });
      const info = [
        'Made by SSGL - Tools > Upscaler',
        'Source: ' + path.basename(options.source),
        'Model: ' + model.id + '  Scale: ' + scale + 'x',
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
        result: { file: target, bytes, images: added, skipped: skipped.concat(failed) }
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

export const preview = async ({ images, kinds, scale, model, engine }, hold = {}) => {
  const samples = pickSamples(pickImages(images, kinds));
  const how = engineScaleFor(model, scale);
  if (!samples.length) return [];
  if (!how) throw new EngineError('scale');
  const temp = makeTemp();
  const fake = { tileStep: 0, stopped: false, child: null };
  hold.job = fake;
  try {
    const metas = [];
    for (let i = 0; i < samples.length; i++) {
      metas.push(await prepare(samples[i], path.join(temp, 'p' + i)));
    }
    const done = await upscaleFiles(fake, metas.map(m => m.file), temp, {
      exe: engine.exe,
      models: engine.models,
      model: model.id,
      engineScale: how.engineScale
    });
    if (fake.stopped) return [];
    const out = [];
    for (let i = 0; i < samples.length; i++) {
      const before = await samples[i].readPng();
      const after = await finish(metas[i], fs.readFileSync(done.get(metas[i].file)), scale);
      out.push({
        path: samples[i].path,
        kind: samples[i].kind,
        width: samples[i].width,
        height: samples[i].height,
        before: dataUrl(before),
        after: dataUrl(after)
      });
    }
    return out;
  } finally {
    killTree(fake.child);
    removeDir(temp);
  }
};

// a tiny picture through the engine: does it start at all on this PC?
export const testEngine = async (engine, model) => {
  const temp = makeTemp();
  try {
    const img = { width: 16, height: 16, data: Buffer.alloc(16 * 16 * 4, 200) };
    const file = path.join(temp, 'test.png');
    fs.writeFileSync(file, await encode(img, [], { rgb: true }));
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
