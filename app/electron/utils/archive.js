import fs from 'fs';

// Looks at the table of contents of a mod file without unpacking it.
// Supports WAD files and zip based files (pk3 / zip). 7z, rar and the like are
// reported as "unsupported".

const readAt = (fd, length, position) => {
  const buf = Buffer.alloc(length);
  const read = fs.readSync(fd, buf, 0, length, position);
  return read < length ? buf.slice(0, read) : buf;
};

const detectType = fd => {
  const b = readAt(fd, 4, 0);
  const text = b.toString('latin1');
  if (text === 'IWAD' || text === 'PWAD') return 'wad';
  if (b.length === 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5)) {
    return 'zip';
  }
  if (b.length === 4 && b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf) {
    return '7z';
  }
  if (text === 'Rar!') return 'rar';
  return 'unknown';
};

const MAX_DIRECTORY_BYTES = 512 * 1024 * 1024;

// returns all file names inside a zip
const listZip = (fd, size) => {
  const tailLength = Math.min(size, 65535 + 22 + 20);
  const tail = readAt(fd, tailLength, size - tailLength);

  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('no zip directory');

  let count = tail.readUInt16LE(eocd + 10);
  let dirSize = tail.readUInt32LE(eocd + 12);
  let dirOffset = tail.readUInt32LE(eocd + 16);

  // big archives (more than 65534 files or 4 GB) use the zip64 record
  if (count === 0xffff || dirSize === 0xffffffff || dirOffset === 0xffffffff) {
    const locator = eocd - 20;
    if (locator >= 0 && tail.readUInt32LE(locator) === 0x07064b50) {
      const zip64At = Number(tail.readBigUInt64LE(locator + 8));
      const rec = readAt(fd, 56, zip64At);
      if (rec.length === 56 && rec.readUInt32LE(0) === 0x06064b50) {
        count = Number(rec.readBigUInt64LE(32));
        dirSize = Number(rec.readBigUInt64LE(40));
        dirOffset = Number(rec.readBigUInt64LE(48));
      }
    }
  }

  if (dirSize > MAX_DIRECTORY_BYTES || dirOffset + dirSize > size) {
    throw new Error('damaged zip directory');
  }

  const dir = readAt(fd, dirSize, dirOffset);
  const names = [];
  let p = 0;
  while (p + 46 <= dir.length && dir.readUInt32LE(p) === 0x02014b50) {
    const flags = dir.readUInt16LE(p + 8);
    const nameLength = dir.readUInt16LE(p + 28);
    const extraLength = dir.readUInt16LE(p + 30);
    const commentLength = dir.readUInt16LE(p + 32);
    const name = dir.toString(
      flags & 0x800 ? 'utf8' : 'latin1',
      p + 46,
      p + 46 + nameLength
    );
    if (name.length && name[name.length - 1] !== '/') names.push(name);
    p += 46 + nameLength + extraLength + commentLength;
  }
  return names;
};

// returns the lump names of a WAD in file order
const listWad = (fd, size) => {
  const head = readAt(fd, 12, 0);
  if (head.length < 12) throw new Error('damaged WAD');
  const count = head.readInt32LE(4);
  const offset = head.readInt32LE(8);
  if (count < 0 || offset < 12 || offset + count * 16 > size) {
    throw new Error('damaged WAD');
  }
  const dir = readAt(fd, count * 16, offset);
  const lumps = [];
  for (let i = 0; i < count; i++) {
    const at = i * 16;
    lumps.push(
      dir
        .toString('latin1', at + 8, at + 16)
        .replace(/\0[\s\S]*$/, '')
        .toUpperCase()
    );
  }
  return lumps;
};

// -> { type: 'wad' | 'zip', entries: [...] }
//    or throws an Error whose message is 'unsupported:<type>' / a reason
const readContents = file => {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const type = detectType(fd);

    if (type === 'wad') return { type, entries: listWad(fd, size) };
    if (type === 'zip') return { type, entries: listZip(fd, size) };

    const err = new Error(`unsupported:${type}`);
    err.code = 'unsupported';
    throw err;
  } finally {
    fs.closeSync(fd);
  }
};

export { readContents };
