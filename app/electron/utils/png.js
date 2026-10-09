import zlib from 'zlib';

// PNG pictures in plain JavaScript (no native modules): read the chunks, read and
// write the "grAb" offsets (where a sprite stands), decode to RGBA and encode again.
// Used by the Upscaler (utils/upscaler.js). The compression itself runs in zlib's
// own threads (async), so the main part of SSGL stays free while pictures are made.

export const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const inflate = buf =>
  new Promise((res, rej) => zlib.inflate(buf, (e, out) => (e ? rej(e) : res(out))));
const deflate = (buf, level = 6) =>
  new Promise((res, rej) =>
    zlib.deflate(buf, { level }, (e, out) => (e ? rej(e) : res(out)))
  );

// --- CRC32 (zlib.crc32 is there since Node 22.2; the table is the fallback) --
let TABLE = null;
const crcTable = () => {
  if (TABLE) return TABLE;
  TABLE = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    TABLE[n] = c;
  }
  return TABLE;
};
export const crc32 = (buf, start = 0) => {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf, start) >>> 0;
  const t = crcTable();
  let c = (start ^ -1) >>> 0;
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

export const isPng = buf =>
  !!buf && buf.length >= 8 && buf.slice(0, 8).equals(SIGNATURE);

export const isJpg = buf =>
  !!buf && buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

// -> [{ type, data }] (stops at IEND; a broken file throws)
export const readChunks = buf => {
  if (!isPng(buf)) throw new Error('not a PNG');
  const chunks = [];
  let p = 8;
  while (p + 12 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    if (p + 12 + len > buf.length) throw new Error('damaged PNG');
    chunks.push({ type, data: buf.slice(p + 8, p + 8 + len) });
    p += 12 + len;
    if (type === 'IEND') break;
  }
  if (!chunks.length || chunks[0].type !== 'IHDR') throw new Error('damaged PNG');
  return chunks;
};

const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.slice(4), data])), 0);
  return Buffer.concat([head, data, crc]);
};

// chunks -> PNG file
export const writeChunks = chunks =>
  Buffer.concat([SIGNATURE, ...chunks.map(c => chunk(c.type, c.data))]);

// width / height / colour type without decoding (from the first bytes only)
export const pngInfo = buf => {
  if (!isPng(buf) || buf.length < 33) return null;
  if (buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
    interlace: buf[28]
  };
};

// width / height of a JPG (the first "start of frame" marker)
export const jpgInfo = buf => {
  if (!isJpg(buf)) return null;
  let p = 2;
  while (p + 9 < buf.length) {
    if (buf[p] !== 0xff) {
      p++;
      continue;
    }
    const marker = buf[p + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      p += 2;
      continue;
    }
    const len = buf.readUInt16BE(p + 2);
    const sof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof) return { width: buf.readUInt16BE(p + 7), height: buf.readUInt16BE(p + 5) };
    p += 2 + len;
  }
  return null;
};

// "grAb" = the offsets of a sprite / graphic (ZDoom): two signed 32 bit numbers
export const readGrab = buf => {
  const c = readChunks(buf).find(x => x.type === 'grAb');
  if (!c || c.data.length < 8) return null;
  return { x: c.data.readInt32BE(0), y: c.data.readInt32BE(4) };
};

export const grabChunk = ({ x, y }) => {
  const data = Buffer.alloc(8);
  data.writeInt32BE(Math.round(x), 0);
  data.writeInt32BE(Math.round(y), 4);
  return { type: 'grAb', data };
};

// put (or replace) the grAb chunk; it must come before the picture data
export const setGrab = (buf, grab) => {
  const chunks = readChunks(buf).filter(c => c.type !== 'grAb');
  const at = chunks.findIndex(c => c.type === 'IDAT');
  chunks.splice(at < 0 ? 1 : at, 0, grabChunk(grab));
  return writeChunks(chunks);
};

// ---------------------------------------------------------------------------
// decode: any PNG -> { width, height, data: RGBA bytes }
// ---------------------------------------------------------------------------
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const ADAM7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2]
];

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
};

// undo the row filters of one (sub) picture; -> rows of raw bytes
const unfilter = (raw, at, w, h, bpp, rowBytes) => {
  const rows = [];
  let prev = Buffer.alloc(rowBytes);
  let p = at;
  for (let y = 0; y < h; y++) {
    const type = raw[p++];
    const row = Buffer.from(raw.slice(p, p + rowBytes));
    p += rowBytes;
    for (let i = 0; i < rowBytes; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      if (type === 1) row[i] = (row[i] + a) & 255;
      else if (type === 2) row[i] = (row[i] + b) & 255;
      else if (type === 3) row[i] = (row[i] + ((a + b) >> 1)) & 255;
      else if (type === 4) row[i] = (row[i] + paeth(a, b, c)) & 255;
    }
    rows.push(row);
    prev = row;
  }
  return { rows, end: p };
};

export const decode = async buf => {
  const chunks = readChunks(buf);
  const h0 = chunks[0].data;
  const width = h0.readUInt32BE(0);
  const height = h0.readUInt32BE(4);
  const depth = h0[8];
  const ctype = h0[9];
  const interlace = h0[12];
  const ch = CHANNELS[ctype];
  if (!ch || !width || !height) throw new Error('unsupported PNG');
  if (width * height > 64 * 1024 * 1024) throw new Error('picture too big');

  const plte = chunks.find(c => c.type === 'PLTE');
  const trns = chunks.find(c => c.type === 'tRNS');
  const raw = await inflate(Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data)));

  const out = Buffer.alloc(width * height * 4);
  const bitsPerPixel = ch * depth;
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const max = (1 << depth) - 1;

  // the value of one sample (0..255) or a raw palette index
  const sample = (row, x, c) => {
    if (depth === 8) return row[x * ch + c];
    if (depth === 16) return row[(x * ch + c) * 2]; // high byte
    const bit = (x * ch + c) * depth;
    return (row[bit >> 3] >> (8 - depth - (bit & 7))) & max;
  };
  const scale = v => (depth < 8 && ctype !== 3 ? Math.round((v * 255) / max) : v);

  let key = null;
  if (trns && ctype === 0 && trns.data.length >= 2) key = [trns.data.readUInt16BE(0)];
  if (trns && ctype === 2 && trns.data.length >= 6)
    key = [trns.data.readUInt16BE(0), trns.data.readUInt16BE(2), trns.data.readUInt16BE(4)];
  const rawSample = (row, x, c) =>
    depth === 16 ? row.readUInt16BE((x * ch + c) * 2) : sample(row, x, c);

  const put = (row, x, ox, oy) => {
    const o = (oy * width + ox) * 4;
    if (ctype === 3) {
      const i = sample(row, x, 0);
      out[o] = plte ? plte.data[i * 3] : 0;
      out[o + 1] = plte ? plte.data[i * 3 + 1] : 0;
      out[o + 2] = plte ? plte.data[i * 3 + 2] : 0;
      out[o + 3] = trns && i < trns.data.length ? trns.data[i] : 255;
    } else if (ctype === 0 || ctype === 4) {
      const g = scale(sample(row, x, 0));
      out[o] = out[o + 1] = out[o + 2] = g;
      out[o + 3] = ctype === 4 ? scale(sample(row, x, 1)) : key && rawSample(row, x, 0) === key[0] ? 0 : 255;
    } else {
      out[o] = scale(sample(row, x, 0));
      out[o + 1] = scale(sample(row, x, 1));
      out[o + 2] = scale(sample(row, x, 2));
      if (ctype === 6) out[o + 3] = scale(sample(row, x, 3));
      else
        out[o + 3] =
          key && rawSample(row, x, 0) === key[0] && rawSample(row, x, 1) === key[1] && rawSample(row, x, 2) === key[2]
            ? 0
            : 255;
    }
  };

  if (!interlace) {
    const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
    const { rows } = unfilter(raw, 0, width, height, bpp, rowBytes);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) put(rows[y], x, x, y);
  } else {
    let at = 0;
    ADAM7.forEach(([x0, y0, dx, dy]) => {
      const w = Math.ceil((width - x0) / dx);
      const h = Math.ceil((height - y0) / dy);
      if (w <= 0 || h <= 0) return;
      const rowBytes = Math.ceil((w * bitsPerPixel) / 8);
      const r = unfilter(raw, at, w, h, bpp, rowBytes);
      at = r.end;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) put(r.rows[y], x, x0 + x * dx, y0 + y * dy);
    });
  }
  return { width, height, data: out };
};

// ---------------------------------------------------------------------------
// encode: RGBA (or RGB when nothing is see-through) -> PNG, with extra chunks
// ---------------------------------------------------------------------------
export const isOpaque = img => {
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 255) return false;
  return true;
};

export const encode = async (img, extra = [], options = {}) => {
  const { width, height, data } = img;
  const rgb = options.rgb === undefined ? isOpaque(img) : options.rgb;
  const ch = rgb ? 3 : 4;
  const rowBytes = width * ch;
  const filtered = Buffer.alloc((rowBytes + 1) * height);
  let prev = Buffer.alloc(rowBytes);
  const row = Buffer.alloc(rowBytes);
  const cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(rowBytes));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const d = x * ch;
      row[d] = data[s];
      row[d + 1] = data[s + 1];
      row[d + 2] = data[s + 2];
      if (ch === 4) row[d + 3] = data[s + 3];
    }
    // the filter with the smallest sum (the usual rule of thumb) per row
    let best = 0;
    let bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      const c = cand[f];
      let sum = 0;
      for (let i = 0; i < rowBytes; i++) {
        const a = i >= ch ? row[i - ch] : 0;
        const b = prev[i];
        const cc = i >= ch ? prev[i - ch] : 0;
        let v = row[i];
        if (f === 1) v -= a;
        else if (f === 2) v -= b;
        else if (f === 3) v -= (a + b) >> 1;
        else if (f === 4) v -= paeth(a, b, cc);
        v &= 255;
        c[i] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) {
        bestSum = sum;
        best = f;
      }
    }
    const o = y * (rowBytes + 1);
    filtered[o] = best;
    cand[best].copy(filtered, o + 1);
    prev = Buffer.from(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = rgb ? 2 : 6;
  return writeChunks([
    { type: 'IHDR', data: ihdr },
    ...extra,
    { type: 'IDAT', data: await deflate(filtered, options.level) },
    { type: 'IEND', data: Buffer.alloc(0) }
  ]);
};

// ---------------------------------------------------------------------------
// see-through edges
// ---------------------------------------------------------------------------

// "binary" = every pixel is either fully see-through or fully solid (classic sprites)
export const alphaKind = img => {
  let soft = false;
  let any = false;
  for (let i = 3; i < img.data.length; i += 4) {
    const a = img.data[i];
    if (a !== 255) any = true;
    if (a !== 0 && a !== 255) soft = true;
  }
  return !any ? 'opaque' : soft ? 'soft' : 'binary';
};

// The colour hidden under see-through pixels is often black or cyan. The AI would
// smear it into the edges (dark or bright halos), so the edge colours are first
// spread into the see-through area. The alpha itself is not changed.
export const bleed = (img, passes = 16) => {
  const { width: w, height: h, data } = img;
  const known = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) known[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  for (let pass = 0; pass < passes; pass++) {
    const add = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (known[i]) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = yy * w + xx;
            if (!known[j]) continue;
            r += data[j * 4];
            g += data[j * 4 + 1];
            b += data[j * 4 + 2];
            n++;
          }
        if (n) add.push([i, r / n, g / n, b / n]);
      }
    if (!add.length) break;
    add.forEach(([i, r, g, b]) => {
      data[i * 4] = Math.round(r);
      data[i * 4 + 1] = Math.round(g);
      data[i * 4 + 2] = Math.round(b);
      known[i] = 1;
    });
  }
  return img;
};

// back to hard edges (for pictures that had only solid / see-through pixels)
export const hardenAlpha = img => {
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
  return img;
};

// half the size with a soft [1 3 3 1] filter, in "premultiplied" colours so the
// see-through parts do not darken the edges
export const halve = img => {
  const { width: w, height: h, data } = img;
  const W = Math.max(1, w >> 1);
  const H = Math.max(1, h >> 1);
  const out = Buffer.alloc(W * H * 4);
  const K = [1, 3, 3, 1];
  const px = (x, y) => (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let wsum = 0;
      for (let j = 0; j < 4; j++)
        for (let i = 0; i < 4; i++) {
          const k = K[i] * K[j];
          const p = px(2 * x - 1 + i, 2 * y - 1 + j);
          const al = data[p + 3];
          r += data[p] * al * k;
          g += data[p + 1] * al * k;
          b += data[p + 2] * al * k;
          a += al * k;
          wsum += k;
        }
      const o = (y * W + x) * 4;
      out[o + 3] = Math.round(a / wsum);
      if (a > 0) {
        out[o] = Math.min(255, Math.round(r / a));
        out[o + 1] = Math.min(255, Math.round(g / a));
        out[o + 2] = Math.min(255, Math.round(b / a));
      }
    }
  return { width: W, height: H, data: out };
};
