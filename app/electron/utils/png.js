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

// ---- the "Look" of the result (Upscaler: Smooth / Natural / Sharp) ----------------

// Smooth edges for sprites with only solid / see-through pixels: the one-pixel stairs
// of the original become clean lines and curves. The original alpha is made bigger,
// blurred a little (about half an original pixel) and cut again with a short ramp of
// about 1.5 new pixels. The cut is a bit below half, so single pixels and thin lines stay.
export const SMOOTH_SIGMA = 0.55; // blur, in original pixels
export const SMOOTH_CUT = 0.42; // where the edge is cut (0..1)
export const SMOOTH_RAMP = 1.5; // width of the soft edge, in new pixels
export const SMOOTH_THIN = 0.75; // a solid pixel weaker than this after the blur is a thin detail
const blur1 = (src, w, h, sigma, horizontal) => {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v);
    sum += v;
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) {
        const xx = horizontal ? Math.min(w - 1, Math.max(0, x + i)) : x;
        const yy = horizontal ? y : Math.min(h - 1, Math.max(0, y + i));
        v += src[yy * w + xx] * k[i + r];
      }
      out[y * w + x] = v / sum;
    }
  return out;
};
export const smoothAlpha = (orig, scale) => {
  const soft = scaleAlpha(orig, scale, false);
  const W = orig.width * scale;
  const H = orig.height * scale;
  const f = new Float32Array(W * H);
  for (let i = 0; i < f.length; i++) f[i] = soft[i] / 255;
  const sigma = SMOOTH_SIGMA * scale;
  const blurred = blur1(blur1(f, W, H, sigma, true), W, H, sigma, false);
  // the slope of a blurred straight edge is about 1 / (2.5 sigma) per pixel
  const k = (2.5 * sigma) / SMOOTH_RAMP;
  const out = new Uint8Array(W * H);
  for (let i = 0; i < out.length; i++) {
    const v = 0.5 + (blurred[i] - SMOOTH_CUT) * k;
    out[i] = Math.round(255 * Math.min(1, Math.max(0, v)));
  }
  // thin details (one-pixel lines, single pixels: sparks, casings) would fade away.
  // A solid pixel that the blur makes weak is "thin": its place keeps the soft
  // enlargement, a bit stronger. Edges of bigger shapes are never thin.
  const w = orig.width;
  const h = orig.height;
  const a0 = new Float32Array(w * h);
  for (let i = 0; i < a0.length; i++) a0[i] = orig.data[i * 4 + 3] / 255;
  const b0 = blur1(blur1(a0, w, h, SMOOTH_SIGMA, true), w, h, SMOOTH_SIGMA, false);
  const near = new Uint8Array(w * h);
  let any = false;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (a0[y * w + x] < 1 || b0[y * w + x] >= SMOOTH_THIN) continue;
      any = true;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) near[yy * w + xx] = 1;
        }
    }
  if (any)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!near[Math.floor(y / scale) * w + Math.floor(x / scale)]) continue;
        const i = y * W + x;
        out[i] = Math.max(out[i], Math.min(255, Math.round(soft[i] * 1.4)));
      }
  return out;
};

// No dark or light halos: a pixel at the soft edge takes its colour from the solid
// pixels next to it (weighted by how solid they are), not from what was behind it.
export const defringe = img => {
  const { width: w, height: h, data } = img;
  const src = Buffer.from(data);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const a = src[p + 3];
      if (a === 0 || a === 255) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const q = (yy * w + xx) * 4;
          const wt = src[q + 3] * src[q + 3];
          if (src[q + 3] <= a) continue; // only more solid pixels
          r += src[q] * wt;
          g += src[q + 1] * wt;
          b += src[q + 2] * wt;
          n += wt;
        }
      if (!n) continue;
      data[p] = Math.round(r / n);
      data[p + 1] = Math.round(g / n);
      data[p + 2] = Math.round(b / n);
    }
  return img;
};

// every pixel copied into a scale x scale block (the original pixels stay visible)
export const nearest = (img, scale) => {
  const W = img.width * scale;
  const H = img.height * scale;
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) img.data.copy(out, (y * W + x) * 4, (((y / scale) | 0) * img.width + ((x / scale) | 0)) * 4, (((y / scale) | 0) * img.width + ((x / scale) | 0)) * 4 + 4);
  return { width: W, height: H, data: out };
};

// colours of b mixed into a (part 0..1 of b); alpha stays as in a
export const mixColors = (a, b, part) => {
  for (let i = 0; i < a.data.length; i += 4)
    for (let c = 0; c < 3; c++) a.data[i + c] = Math.round(a.data[i + c] * (1 - part) + b.data[i + c] * part);
  return a;
};
