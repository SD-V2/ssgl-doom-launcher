import fs from 'fs';

// A WAD file: "IWAD" or "PWAD", the number of lumps, where the directory is; the directory
// has 16 bytes per lump (position, size, name of 8 letters). Written from the public
// description of the format (Doom Wiki "WAD"). Only the header and the directory are read;
// a lump is read when it is needed. Nothing is trusted: a lump that points outside the
// file is skipped and counted, a directory bigger than the file is cut to what fits.

export const MAX_LUMPS = 1000000; // more than any real WAD (the biggest have about 60 000)

const name8 = (buf, at) => {
  let end = at;
  while (end < at + 8 && buf[end] !== 0) end++;
  // names are upper case in GZDoom; odd bytes are kept as they are
  return buf.toString('latin1', at, end).toUpperCase();
};

// -> { type, lumps: [{ index, name, pos, size }], bad, problems: [] }   (throws only for "not a WAD")
export const readDirectory = (fd, fileSize) => {
  const head = Buffer.alloc(12);
  const got = fileSize >= 12 ? fs.readSync(fd, head, 0, 12, 0) : 0;
  const type = got === 12 ? head.toString('latin1', 0, 4) : '';
  if (type !== 'IWAD' && type !== 'PWAD') {
    const err = new Error('not a WAD file');
    err.code = 'notWad';
    throw err;
  }
  const problems = [];
  let count = head.readInt32LE(4);
  const dirPos = head.readInt32LE(8);
  if (count < 0 || dirPos < 12 || dirPos > fileSize) {
    problems.push('directory');
    return { type, lumps: [], bad: 0, problems };
  }
  const fits = Math.floor((fileSize - dirPos) / 16);
  if (count > fits) {
    problems.push('directoryCut');
    count = fits;
  }
  if (count > MAX_LUMPS) {
    problems.push('tooManyLumps');
    count = MAX_LUMPS;
  }
  const dir = Buffer.alloc(count * 16);
  if (count) fs.readSync(fd, dir, 0, dir.length, dirPos);
  const lumps = [];
  let bad = 0;
  for (let i = 0; i < count; i++) {
    const at = i * 16;
    const pos = dir.readInt32LE(at);
    const size = dir.readInt32LE(at + 4);
    const name = name8(dir, at + 8);
    if (size < 0 || pos < 0 || (size > 0 && pos + size > fileSize)) {
      bad++;
      continue;
    }
    lumps.push({ index: i, name, pos, size });
  }
  if (bad) problems.push('badLumps');
  return { type, lumps, bad, problems };
};

// the bytes of a lump (or its first `max` bytes)
export const readLump = (fd, lump, max) => {
  const length = max === undefined ? lump.size : Math.min(max, lump.size);
  const buf = Buffer.alloc(length);
  if (length) fs.readSync(fd, buf, 0, length, lump.pos);
  return buf;
};

// open a WAD file: its directory, and a reader for its lumps (open / close per read, so
// nothing stays open while the screen shows the list)
export const openWad = file => {
  const fd = fs.openSync(file, 'r');
  try {
    const dir = readDirectory(fd, fs.fstatSync(fd).size);
    return {
      ...dir,
      file,
      read: (lump, max) => {
        const f = fs.openSync(file, 'r');
        try {
          return readLump(f, lump, max);
        } finally {
          fs.closeSync(f);
        }
      }
    };
  } finally {
    fs.closeSync(fd);
  }
};
