// Makes tiny WAD files for the checks (written here, from the public format description;
// no game data): a made-up palette, Doom pictures with posts and see-through gaps, flats,
// PNAMES, TEXTURE1 (Doom or Strife layout), marker lumps.

// a made-up palette: colour i = (i, 255 - i, i * 7 mod 256)
const palette = () => {
  const b = Buffer.alloc(768 * 14);
  for (let i = 0; i < 256; i++) {
    b[i * 3] = i;
    b[i * 3 + 1] = 255 - i;
    b[i * 3 + 2] = (i * 7) & 255;
  }
  return b;
};
const colour = i => [i, 255 - i, (i * 7) & 255];

// rows: array of strings or arrays; a cell is a palette index or -1 (see-through)
// -> Doom picture bytes. tall: posts below 254 written with relative tops ("tall" pictures)
const picture = (grid, { left = 0, top = 0, tall = false } = {}) => {
  const height = grid.length;
  const width = grid[0].length;
  const cols = [];
  for (let x = 0; x < width; x++) {
    const bytes = [];
    let y = 0;
    let last = -1;
    while (y < height) {
      if (grid[y][x] < 0) {
        y++;
        continue;
      }
      const start = y;
      const px = [];
      while (y < height && grid[y][x] >= 0 && px.length < 128) px.push(grid[y++][x]);
      let delta = start;
      if (tall && start > 253) {
        // relative to the last post (its top), as "tall" pictures do
        delta = start - last;
        if (delta > 253 || delta <= 0) throw new Error('test picture too tall');
        if (delta > last) throw new Error('relative top must not be below the last top');
      }
      bytes.push(delta, px.length, 0, ...px, 0);
      last = start;
    }
    bytes.push(255);
    cols.push(Buffer.from(bytes));
  }
  const head = Buffer.alloc(8 + width * 4);
  head.writeInt16LE(width, 0);
  head.writeInt16LE(height, 2);
  head.writeInt16LE(left, 4);
  head.writeInt16LE(top, 6);
  let at = head.length;
  cols.forEach((c, x) => {
    head.writeUInt32LE(at, 8 + x * 4);
    at += c.length;
  });
  return Buffer.concat([head, ...cols]);
};

const name8 = n => {
  const b = Buffer.alloc(8);
  b.write(n.slice(0, 8), 0, 'latin1');
  return b;
};

const pnames = names => {
  const b = Buffer.alloc(4 + names.length * 8);
  b.writeInt32LE(names.length, 0);
  names.forEach((n, i) => name8(n).copy(b, 4 + i * 8));
  return b;
};

// textures: [{ name, width, height, patches: [{ x, y, patch (index) }], scale: [x, y] }]
const textureLump = (textures, { strife = false } = {}) => {
  const bodies = textures.map(t => {
    const head = Buffer.alloc(strife ? 18 : 22);
    name8(t.name).copy(head, 0);
    if (t.scale) {
      head[10] = t.scale[0];
      head[11] = t.scale[1];
    }
    head.writeInt16LE(t.width, 12);
    head.writeInt16LE(t.height, 14);
    head.writeInt16LE(t.patches.length, strife ? 16 : 20);
    const ps = t.patches.map(p => {
      const b = Buffer.alloc(strife ? 6 : 10);
      b.writeInt16LE(p.x, 0);
      b.writeInt16LE(p.y, 2);
      b.writeInt16LE(p.patch, 4);
      if (!strife) b.writeInt16LE(1, 6); // "stepdir", unused
      return b;
    });
    return Buffer.concat([head, ...ps]);
  });
  const dir = Buffer.alloc(4 + textures.length * 4);
  dir.writeInt32LE(textures.length, 0);
  let at = dir.length;
  bodies.forEach((b, i) => {
    dir.writeInt32LE(at, 4 + i * 4);
    at += b.length;
  });
  return Buffer.concat([dir, ...bodies]);
};

// lumps: [{ name, data }] -> WAD bytes. type 'IWAD' / 'PWAD'
const wad = (lumps, type = 'PWAD') => {
  const datas = lumps.map(l => l.data || Buffer.alloc(0));
  const header = Buffer.alloc(12);
  header.write(type, 0, 'latin1');
  header.writeInt32LE(lumps.length, 4);
  let at = 12;
  const pos = datas.map(d => {
    const p = at;
    at += d.length;
    return p;
  });
  header.writeInt32LE(at, 8);
  const dir = Buffer.alloc(lumps.length * 16);
  lumps.forEach((l, i) => {
    dir.writeInt32LE(datas[i].length ? pos[i] : 0, i * 16);
    dir.writeInt32LE(datas[i].length, i * 16 + 4);
    name8(l.name).copy(dir, i * 16 + 8);
  });
  return Buffer.concat([header, ...datas, dir]);
};

// a flat of side x side, index = (x + y) mod 256
const flat = side => {
  const b = Buffer.alloc(side * side);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) b[y * side + x] = (x + y * 3) & 255;
  return b;
};

module.exports = { palette, colour, picture, pnames, textureLump, wad, flat, name8 };
