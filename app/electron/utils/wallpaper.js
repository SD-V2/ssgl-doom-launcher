import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// A wallpaper that is much bigger than the screen takes seconds to decode at every
// start (an 8K picture: 1.5 - 4.5 s here). SSGL keeps a copy in the size of the screen
// in the data folder ("wallpaper-cache") and shows that one. The owner's picture is
// never changed. The copy is made by the window in the background (a worker), once.

export const DIR = 'wallpaper-cache';
export const BIGGER = 1.25; // only pictures more than this much bigger than the screen
const KEEP = 3;

// width / height from the first bytes (PNG, JPG, WebP, BMP); null when unknown
export const sizeOf = buf => {
  if (!buf || buf.length < 24) return null;
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.toString('latin1', 12, 16) === 'IHDR') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let p = 2;
    while (p + 9 < buf.length) {
      if (buf[p] !== 0xff) {
        p++;
        continue;
      }
      const m = buf[p + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        p += 2;
        continue;
      }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { width: buf.readUInt16BE(p + 7), height: buf.readUInt16BE(p + 5) };
      }
      p += 2 + buf.readUInt16BE(p + 2);
    }
    return null;
  }
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    const kind = buf.toString('latin1', 12, 16);
    if (kind === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf.toString('latin1', 0, 2) === 'BM') return { width: buf.readInt32LE(18), height: Math.abs(buf.readInt32LE(22)) };
  return null;
};

const readHead = file =>
  new Promise(resolve => {
    fs.open(file, 'r', (err, fd) => {
      if (err) return resolve(null);
      const buf = Buffer.alloc(256 * 1024);
      fs.read(fd, buf, 0, buf.length, 0, (e, n) => {
        fs.close(fd, () => {});
        resolve(e ? null : buf.slice(0, n));
      });
    });
  });

// the name of the copy: the picture (path, size, date) and the screen size
export const keyOf = (file, st, target) =>
  crypto
    .createHash('sha1')
    .update([path.resolve(file), st.size, Math.round(st.mtimeMs), target].join('|'))
    .digest('hex')
    .slice(0, 20) + '.jpg';

// what the window should show: { show: file to show, make: true when a copy should be made }
export const choose = async (dataDir, file, screenWidth, screenHeight) => {
  const none = { show: file, make: false, key: '' };
  if (!file || /\.gif$/i.test(file)) return none; // GIFs move: always the original
  let st;
  try {
    st = await fs.promises.stat(file);
  } catch (e) {
    return none;
  }
  const target = Math.max(1, Math.round(Math.max(screenWidth, screenHeight)));
  const key = keyOf(file, st, target);
  const copy = path.join(dataDir, DIR, key);
  if (fs.existsSync(copy)) return { show: copy, make: false, key };
  const size = sizeOf(await readHead(file));
  if (!size) return none;
  const big = Math.max(size.width, size.height) > target * BIGGER;
  return { show: file, make: big, key, target, size };
};

// a finished copy from the window: written to a temp file, then renamed; old copies go
export const save = async (dataDir, key, bytes) => {
  if (!/^[0-9a-f]{20}\.jpg$/.test(key)) throw new Error('bad name');
  const dir = path.join(dataDir, DIR);
  await fs.promises.mkdir(dir, { recursive: true });
  const file = path.join(dir, key);
  const tmp = file + '.tmp';
  await fs.promises.writeFile(tmp, Buffer.from(bytes));
  await fs.promises.rename(tmp, file);
  const all = (await fs.promises.readdir(dir)).filter(n => /\.jpg$/.test(n) && n !== key);
  const dated = await Promise.all(all.map(async n => ({ n, t: (await fs.promises.stat(path.join(dir, n))).mtimeMs })));
  await Promise.all(
    dated
      .sort((a, b) => b.t - a.t)
      .slice(KEEP - 1)
      .map(({ n }) => fs.promises.unlink(path.join(dir, n)).catch(() => {}))
  );
  return file;
};
