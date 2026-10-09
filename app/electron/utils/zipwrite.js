import fs from 'fs';
import zlib from 'zlib';


// Writes a zip (PK3) file entry by entry, so a big result never has to be held in
// memory. Pictures are stored as they are (PNG is already packed), text is packed.
// Big results (over 4 GB or 65535 files) get the zip64 records GZDoom can read.

const LIMIT = 0xffffffff;

// CRC32 (zlib.crc32 is there since Node 22.2; the table is the fallback)
let TABLE = null;
const crc32 = buf => {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  if (!TABLE) {
    TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

const dosTime = date => {
  const d = date || new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const day = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, day };
};

const deflateRaw = buf =>
  new Promise((res, rej) => zlib.deflateRaw(buf, (e, out) => (e ? rej(e) : res(out))));

export default class ZipWriter {
  constructor(file) {
    this.file = file;
    this.fd = fs.openSync(file, 'w');
    this.offset = 0;
    this.entries = [];
    this.names = new Set();
    this.when = dosTime();
  }

  write(buf) {
    let done = 0;
    while (done < buf.length) done += fs.writeSync(this.fd, buf, done, buf.length - done, this.offset + done);
    this.offset += buf.length;
  }

  has(name) {
    return this.names.has(name.toLowerCase());
  }

  // name: path inside the zip with "/" (kept exactly), data: Buffer
  async add(name, data, { compress = false } = {}) {
    if (this.has(name)) throw new Error('twice in the zip: ' + name);
    this.names.add(name.toLowerCase());
    const crc = crc32(data);
    let body = data;
    let method = 0;
    if (compress) {
      const packed = await deflateRaw(data);
      if (packed.length < data.length) {
        body = packed;
        method = 8;
      }
    }
    const nameBuf = Buffer.from(name, 'utf8');
    const big = this.offset >= LIMIT || data.length >= LIMIT || body.length >= LIMIT;
    const extra = big ? Buffer.alloc(20) : Buffer.alloc(0);
    if (big) {
      extra.writeUInt16LE(0x0001, 0);
      extra.writeUInt16LE(16, 2);
      extra.writeBigUInt64LE(BigInt(data.length), 4);
      extra.writeBigUInt64LE(BigInt(body.length), 12);
    }
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(big ? 45 : 20, 4);
    head.writeUInt16LE(0x800, 6); // names are UTF-8
    head.writeUInt16LE(method, 8);
    head.writeUInt16LE(this.when.time, 10);
    head.writeUInt16LE(this.when.day, 12);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(big ? LIMIT : body.length, 18);
    head.writeUInt32LE(big ? LIMIT : data.length, 22);
    head.writeUInt16LE(nameBuf.length, 26);
    head.writeUInt16LE(extra.length, 28);
    const at = this.offset;
    this.write(Buffer.concat([head, nameBuf, extra]));
    this.write(body);
    this.entries.push({ nameBuf, crc, method, size: data.length, packed: body.length, at });
  }

  close() {
    const start = this.offset;
    const parts = this.entries.map(e => {
      const need64 = e.size >= LIMIT || e.packed >= LIMIT || e.at >= LIMIT;
      const extra = need64 ? Buffer.alloc(28) : Buffer.alloc(0);
      if (need64) {
        extra.writeUInt16LE(0x0001, 0);
        extra.writeUInt16LE(24, 2);
        extra.writeBigUInt64LE(BigInt(e.size), 4);
        extra.writeBigUInt64LE(BigInt(e.packed), 12);
        extra.writeBigUInt64LE(BigInt(e.at), 20);
      }
      const h = Buffer.alloc(46);
      h.writeUInt32LE(0x02014b50, 0);
      h.writeUInt16LE(need64 ? 45 : 20, 4);
      h.writeUInt16LE(need64 ? 45 : 20, 6);
      h.writeUInt16LE(0x800, 8);
      h.writeUInt16LE(e.method, 10);
      h.writeUInt16LE(this.when.time, 12);
      h.writeUInt16LE(this.when.day, 14);
      h.writeUInt32LE(e.crc, 16);
      h.writeUInt32LE(need64 ? LIMIT : e.packed, 20);
      h.writeUInt32LE(need64 ? LIMIT : e.size, 24);
      h.writeUInt16LE(e.nameBuf.length, 28);
      h.writeUInt16LE(extra.length, 30);
      h.writeUInt32LE(need64 ? LIMIT : e.at, 42);
      return Buffer.concat([h, e.nameBuf, extra]);
    });
    parts.forEach(p => this.write(p));
    const dirSize = this.offset - start;
    const count = this.entries.length;
    const need64 = count >= 0xffff || start >= LIMIT || dirSize >= LIMIT;
    if (need64) {
      const rec = Buffer.alloc(56);
      rec.writeUInt32LE(0x06064b50, 0);
      rec.writeBigUInt64LE(BigInt(44), 4);
      rec.writeUInt16LE(45, 12);
      rec.writeUInt16LE(45, 14);
      rec.writeBigUInt64LE(BigInt(count), 24);
      rec.writeBigUInt64LE(BigInt(count), 32);
      rec.writeBigUInt64LE(BigInt(dirSize), 40);
      rec.writeBigUInt64LE(BigInt(start), 48);
      const recAt = this.offset;
      this.write(rec);
      const loc = Buffer.alloc(20);
      loc.writeUInt32LE(0x07064b50, 0);
      loc.writeBigUInt64LE(BigInt(recAt), 8);
      loc.writeUInt32LE(1, 16);
      this.write(loc);
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(need64 ? 0xffff : count, 8);
    end.writeUInt16LE(need64 ? 0xffff : count, 10);
    end.writeUInt32LE(need64 ? LIMIT : dirSize, 12);
    end.writeUInt32LE(need64 ? LIMIT : start, 16);
    this.write(end);
    fs.closeSync(this.fd);
    this.fd = null;
    return this.offset;
  }

  // give up: close and remove the half-made file
  abort() {
    try {
      if (this.fd !== null) fs.closeSync(this.fd);
    } catch (e) {
      // already closed
    }
    this.fd = null;
    try {
      fs.unlinkSync(this.file);
    } catch (e) {
      // already gone
    }
  }
}
