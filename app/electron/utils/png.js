import { PNG } from 'pngjs';
import UPNG from 'upng-js';

// Pictures for the Upscaler. Reading and writing PNG files is done by two proven
// libraries (pure JavaScript): pngjs (every PNG kind: palette, grey, 16 bit,
// interlaced...) and UPNG.js (palette PNGs with fewer colours, "smaller files").
// Here: only the picture work around them (edges, alpha, sizes, checks).

// a picture in memory: { width, height, data: RGBA bytes }

export const isPng = buf =>
  !!buf && buf.length >= 8 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a;

export const isJpg = buf =>
  !!buf && buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

// size and kind from the first bytes, without reading the picture
export const pngInfo = buf => {
  if (!isPng(buf) || buf.length < 29 || buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
    interlace: buf[28]
  };
};

// size of a JPG (its "start of frame" marker)
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
    const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof) return { width: buf.readUInt16BE(p + 7), height: buf.readUInt16BE(p + 5) };
    p += 2 + buf.readUInt16BE(p + 2);
  }
  return null;
};

// any PNG -> RGBA 8 bit
export const decode = buf => {
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: Buffer.from(png.data) };
};

// RGBA -> PNG (RGB when nothing is see-through)
export const encode = (img, options = {}) => {
  const png = new PNG({ width: img.width, height: img.height });
  img.data.copy(png.data);
  const rgb = options.rgb === undefined ? isOpaque(img) : options.rgb;
  // pngjs blends see-through pixels with white when it leaves out the alpha: the
  // colours are meant as they are, so they are made solid first
  if (rgb) for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
  return PNG.sync.write(png, { colorType: rgb ? 2 : 6, deflateLevel: options.level === undefined ? 6 : options.level });
};

// RGBA -> palette PNG (at most 256 colours, see-through in tRNS): "smaller files"
export const encodePalette = img => {
  const ab = img.data.buffer.slice(img.data.byteOffset, img.data.byteOffset + img.data.length);
  return Buffer.from(UPNG.encode([ab], img.width, img.height, 256));
};

export const isOpaque = img => {
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 255) return false;
  return true;
};

// 'opaque' | 'binary' (only fully solid / fully see-through, classic sprites) | 'soft'
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

// the average colour of the visible pixels
export const meanColor = img => {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (!img.data[i + 3]) continue;
    r += img.data[i];
    g += img.data[i + 1];
    b += img.data[i + 2];
    n++;
  }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : [0, 0, 0];
};

// The colour hidden under see-through pixels is often black, cyan or random. The
// engine only gets colours (no alpha), so every see-through pixel gets the colour of
// the nearest visible pixels (spread out step by step) - no halos at the edges.
export const fillHidden = img => {
  const { width: w, height: h, data } = img;
  const known = new Uint8Array(w * h);
  let todo = 0;
  for (let i = 0; i < w * h; i++) {
    known[i] = data[i * 4 + 3] > 0 ? 1 : 0;
    if (!known[i]) todo++;
  }
  while (todo) {
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
    if (!add.length) break; // nothing visible at all
    add.forEach(([i, r, g, b]) => {
      data[i * 4] = Math.round(r);
      data[i * 4 + 1] = Math.round(g);
      data[i * 4 + 2] = Math.round(b);
      known[i] = 1;
    });
    todo -= add.length;
  }
  return img;
};

// half the size with a soft [1 3 3 1] filter (colours only; the engine gets no alpha)
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
      for (let j = 0; j < 4; j++)
        for (let i = 0; i < 4; i++) {
          const k = K[i] * K[j];
          const p = px(2 * x - 1 + i, 2 * y - 1 + j);
          r += data[p] * k;
          g += data[p + 1] * k;
          b += data[p + 2] * k;
        }
      const o = (y * W + x) * 4;
      out[o] = Math.round(r / 64);
      out[o + 1] = Math.round(g / 64);
      out[o + 2] = Math.round(b / 64);
      out[o + 3] = 255;
    }
  return { width: W, height: H, data: out };
};

// The see-through part of the original, made `scale` times bigger (smooth, from the
// original alpha, not from the engine). Classic sprites (only solid / see-through)
// keep hard edges.
export const scaleAlpha = (orig, scale, hard) => {
  const { width: w, height: h, data } = orig;
  const W = w * scale;
  const H = h * scale;
  const out = new Uint8Array(W * H);
  const a = (x, y) => data[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4 + 3];
  for (let y = 0; y < H; y++) {
    const sy = (y + 0.5) / scale - 0.5;
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    for (let x = 0; x < W; x++) {
      const sx = (x + 0.5) / scale - 0.5;
      const x0 = Math.floor(sx);
      const fx = sx - x0;
      const v =
        a(x0, y0) * (1 - fx) * (1 - fy) +
        a(x0 + 1, y0) * fx * (1 - fy) +
        a(x0, y0 + 1) * (1 - fx) * fy +
        a(x0 + 1, y0 + 1) * fx * fy;
      out[y * W + x] = hard ? (v >= 127.5 ? 255 : 0) : Math.round(v);
    }
  }
  return out;
};

// put the alpha in, and give every see-through pixel ONE colour (the average of the
// visible ones) - no random colours under the see-through part
export const applyAlpha = (img, alpha, color) => {
  const d = img.data;
  for (let i = 0; i < alpha.length; i++) {
    d[i * 4 + 3] = alpha[i];
    if (!alpha[i]) {
      d[i * 4] = color[0];
      d[i * 4 + 1] = color[1];
      d[i * 4 + 2] = color[2];
    }
  }
  return img;
};

// a small copy (box average of the visible pixels), for comparing with the original
export const shrinkTo = (img, W, H) => {
  const out = Buffer.alloc(W * H * 4);
  const sx = img.width / W;
  const sy = img.height / H;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let yy = Math.floor(y * sy); yy < Math.floor((y + 1) * sy); yy++)
        for (let xx = Math.floor(x * sx); xx < Math.floor((x + 1) * sx); xx++) {
          const p = (yy * img.width + xx) * 4;
          const al = img.data[p + 3];
          r += img.data[p] * al;
          g += img.data[p + 1] * al;
          b += img.data[p + 2] * al;
          a += al;
          n++;
        }
      const o = (y * W + x) * 4;
      out[o + 3] = n ? Math.round(a / n) : 0;
      if (a) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
    }
  return { width: W, height: H, data: out };
};
