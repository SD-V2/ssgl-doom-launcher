// Tiny made-up PNG pictures for the checks, written byte by byte so that EVERY kind of
// PNG can be made (also the ones the libraries cannot write): palette + tRNS,
// grey + alpha, 16 bit, interlaced. Only for tests - SSGL itself uses pngjs / UPNG.
const zlib = require('zlib');

const crcTable = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc = buf => { let c = -1; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const h = Buffer.alloc(8); h.writeUInt32BE(data.length, 0); h.write(type, 4, 'latin1'); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([h.slice(4), data])), 0); return Buffer.concat([h, data, c]); };
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// rows: array of Buffers (raw samples of one row, without filter byte)
const file = ({ width, height, depth, ctype, rows, interlace = false, plte, trns, grab }) => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = depth; ihdr[9] = ctype; ihdr[12] = interlace ? 1 : 0;
  const parts = [SIG, chunk('IHDR', ihdr)];
  if (grab) { const g = Buffer.alloc(8); g.writeInt32BE(grab.x, 0); g.writeInt32BE(grab.y, 4); parts.push(chunk('grAb', g)); }
  if (plte) parts.push(chunk('PLTE', plte));
  if (trns) parts.push(chunk('tRNS', trns));
  let raw;
  if (!interlace) raw = Buffer.concat(rows.map(r => Buffer.concat([Buffer.from([0]), r])));
  else {
    // Adam7: seven small pictures, every row with filter 0 (bytes per pixel: whole pixels only)
    const bpp = rows[0].length / width;
    const passes = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
    const out = [];
    passes.forEach(([x0, y0, dx, dy]) => {
      for (let y = y0; y < height; y += dy) {
        const px = [];
        for (let x = x0; x < width; x += dx) px.push(rows[y].slice(x * bpp, x * bpp + bpp));
        if (px.length) out.push(Buffer.concat([Buffer.from([0]), ...px]));
      }
    });
    raw = Buffer.concat(out);
  }
  parts.push(chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
};

// the same little figure in every kind of PNG: a red block (solid) on a see-through
// background that hides a "random" colour (cyan / garbage) - the classic sprite
const figure = (w, h) => { const px = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const inside = x >= Math.floor(w / 4) && x < w - Math.floor(w / 4) && y >= Math.floor(h / 5) && y < h - 1; px.push(inside ? [200, 40 + ((x * 7 + y * 3) % 30), 30, 255] : [(x * 53) % 256, 255, (y * 91) % 256, 0]); } return px; };
const rowsOf = (w, h, f) => { const rows = []; for (let y = 0; y < h; y++) rows.push(Buffer.concat(Array.from({ length: w }, (_, x) => f(x, y)))); return rows; };

const rgba = (w, h, opts = {}) => { const px = figure(w, h); return file({ width: w, height: h, depth: 8, ctype: 6, rows: rowsOf(w, h, (x, y) => Buffer.from(px[y * w + x])), ...opts }); };
const rgb = (w, h, color = [90, 90, 90]) => file({ width: w, height: h, depth: 8, ctype: 2, rows: rowsOf(w, h, (x, y) => Buffer.from([(color[0] + x * 3) & 255, (color[1] + y * 5) & 255, color[2]])) });
// palette: index 0 = see-through cyan (like many mods), 1..30 = reds
const palette = (w, h, opts = {}) => { const plte = Buffer.alloc(31 * 3); plte[1] = 255; plte[2] = 255; for (let i = 1; i <= 30; i++) { plte[i * 3] = 200; plte[i * 3 + 1] = 30 + i; plte[i * 3 + 2] = 30; } const px = figure(w, h); return file({ width: w, height: h, depth: 8, ctype: 3, plte, trns: Buffer.from([0]), rows: rowsOf(w, h, (x, y) => Buffer.from([px[y * w + x][3] ? 1 + ((x + y) % 30) : 0])), ...opts }); };
const grayAlpha = (w, h, opts = {}) => { const px = figure(w, h); return file({ width: w, height: h, depth: 8, ctype: 4, rows: rowsOf(w, h, (x, y) => Buffer.from([px[y * w + x][3] ? 180 : 7, px[y * w + x][3]])), ...opts }); };
const rgba16 = (w, h, opts = {}) => { const px = figure(w, h); return file({ width: w, height: h, depth: 16, ctype: 6, rows: rowsOf(w, h, (x, y) => { const p = px[y * w + x]; const b = Buffer.alloc(8); p.forEach((v, i) => b.writeUInt16BE(v * 257, i * 2)); return b; }), ...opts }); };
const interlaced = (w, h, opts = {}) => { const px = figure(w, h); return file({ width: w, height: h, depth: 8, ctype: 6, interlace: true, rows: rowsOf(w, h, (x, y) => Buffer.from(px[y * w + x])), ...opts }); };
// a JPG header (enough for its size)
const jpg = (w, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
const hasChunk = (buf, type) => { let p = 8; while (p + 8 <= buf.length) { const len = buf.readUInt32BE(p); if (buf.toString('latin1', p + 4, p + 8) === type) return true; p += 12 + len; } return false; };

module.exports = { file, figure, rgba, rgb, palette, grayAlpha, rgba16, interlaced, jpg, hasChunk };
