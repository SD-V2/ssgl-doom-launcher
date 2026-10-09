import { encode, isJpg, isPng, jpgInfo, pngInfo } from '../png';

// Doom's own picture formats, written from the public descriptions (Doom Wiki "Picture
// format", "Flat", "PLAYPAL"). Every read is checked against the length of the lump: a
// broken picture gives an error, never a crash or an endless loop.

// ---- PLAYPAL: 14 palettes of 256 colours (3 bytes each); the first one is the normal one
export const readPalette = buf => {
  if (!buf || buf.length < 768) return null;
  return Buffer.from(buf.slice(0, 768));
};

// ---- the Doom picture ("patch") ----------------------------------------------------------
// header: width, height, left offset, top offset (16 bit each), then one 32 bit position per
// column. A column is a list of posts: top (1 byte, 255 = end), length, a spare byte, the
// pixels, a spare byte. In "tall" pictures a top that is not below the last one counts from it.
export const MAX_SIZE = 2048;

// a quick test of the header, as GZDoom does: sizes 1..2048, the first column right after
// the column list, every column inside the lump. `buf` may be only the start of the lump
// (HEAD_BYTES are enough), `total` is the length of the whole lump.
export const HEAD_BYTES = 8 + 4 * MAX_SIZE;
export const looksLikePicture = (buf, total) => {
  if (!buf || buf.length < 12) return false;
  const length = total === undefined ? buf.length : total;
  const width = buf.readInt16LE(0);
  const height = buf.readInt16LE(2);
  const left = buf.readInt16LE(4);
  const top = buf.readInt16LE(6);
  if (width <= 0 || height <= 0 || width > MAX_SIZE || height > MAX_SIZE) return false;
  if (Math.abs(left) >= 4096 || Math.abs(top) >= 4096) return false;
  if (8 + width * 4 > buf.length || 8 + width * 4 > length) return false;
  let first = false;
  for (let x = 0; x < width; x++) {
    const ofs = buf.readUInt32LE(8 + x * 4);
    if (ofs === 8 + width * 4) first = true;
    else if (ofs >= length) return false;
  }
  return first;
};

const fail = (code, detail) => {
  const e = new Error(detail || code);
  e.code = code;
  return e;
};

// -> { width, height, left, top, index: Uint8Array (palette index), mask: Uint8Array (1 = pixel) }
export const decodePicture = buf => {
  if (!looksLikePicture(buf)) throw fail('notPicture');
  const width = buf.readInt16LE(0);
  const height = buf.readInt16LE(2);
  const index = new Uint8Array(width * height);
  const mask = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    let p = buf.readUInt32LE(8 + x * 4);
    let top = -1;
    // every post moves forward by at least 4 bytes: the loop always ends
    for (;;) {
      if (p >= buf.length) throw fail('broken', 'column ' + x + ' runs past the end');
      const delta = buf[p];
      if (delta === 0xff) break;
      if (p + 3 > buf.length) throw fail('broken', 'post header past the end');
      const length = buf[p + 1];
      top = delta <= top ? top + delta : delta;
      if (p + 3 + length > buf.length) throw fail('broken', 'post past the end');
      for (let i = 0; i < length; i++) {
        const y = top + i;
        if (y < 0 || y >= height) continue;
        index[y * width + x] = buf[p + 3 + i];
        mask[y * width + x] = 1;
      }
      p += length + 4;
    }
  }
  return { width, height, left: buf.readInt16LE(4), top: buf.readInt16LE(6), index, mask };
};

// ---- flats: raw palette indexes, square. GZDoom picks the size from the lump length
// (64x64, 8x8, 16x16, 32x32, 128x128, 256x256); any other length is shown as 64x64.
export const FLAT_SIDES = { 64: 8, 256: 16, 1024: 32, 4096: 64, 16384: 128, 65536: 256 };
export const flatSide = length => FLAT_SIDES[length] || 64;

export const decodeFlat = buf => {
  const side = flatSide(buf.length);
  const index = new Uint8Array(side * side);
  index.set(buf.slice(0, Math.min(buf.length, side * side)));
  const mask = new Uint8Array(side * side).fill(1);
  return { width: side, height: side, left: 0, top: 0, index, mask };
};

// a decoded picture + palette -> RGBA ({ width, height, data }); see-through stays 0,0,0,0
export const toRgba = (pic, palette) => {
  const data = Buffer.alloc(pic.width * pic.height * 4);
  for (let i = 0; i < pic.index.length; i++) {
    if (!pic.mask[i]) continue;
    const c = pic.index[i] * 3;
    data[i * 4] = palette[c];
    data[i * 4 + 1] = palette[c + 1];
    data[i * 4 + 2] = palette[c + 2];
    data[i * 4 + 3] = 255;
  }
  return { width: pic.width, height: pic.height, data };
};

// ---- PNG with the offsets: a grAb chunk (x, y), as GZDoom and SLADE read it ----------------
let CRC = null;
const crc32 = buf => {
  if (!CRC) {
    CRC = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

export const withOffsets = (png, left, top) => {
  if (!left && !top) return png;
  const body = Buffer.alloc(12);
  body.write('grAb', 0, 'latin1');
  body.writeInt32BE(left, 4);
  body.writeInt32BE(top, 8);
  const chunk = Buffer.alloc(20);
  chunk.writeUInt32BE(8, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(body), 16);
  // right after IHDR (8 signature + 25 IHDR)
  return Buffer.concat([png.slice(0, 33), chunk, png.slice(33)]);
};

// the offsets of a PNG (its grAb chunk), or 0, 0
export const pngOffsets = buf => {
  let p = 8;
  while (p + 12 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    if (type === 'grAb' && len >= 8 && p + 16 <= buf.length) return { left: buf.readInt32BE(p + 8), top: buf.readInt32BE(p + 12) };
    if (type === 'IDAT' || type === 'IEND') break;
    p += 12 + len;
  }
  return { left: 0, top: 0 };
};

export const pictureToPng = (pic, palette) => withOffsets(encode(toRgba(pic, palette), { rgb: false }), pic.left, pic.top);

// what a lump is, by its content (never by its name or extension)
//   -> 'png' | 'jpg' | 'picture' | ''
export const contentType = (head, total) => {
  if (!head || !head.length) return '';
  if (isPng(head)) return 'png';
  if (isJpg(head)) return 'jpg';
  if (looksLikePicture(head, total)) return 'picture';
  return '';
};

// width / height of a PNG or JPG lump
export const imageSize = head => (isPng(head) ? pngInfo(head) : isJpg(head) ? jpgInfo(head) : null);
