// Wall textures made of patches, written from the public descriptions (Doom Wiki "PNAMES",
// "TEXTURE1 and TEXTURE2"; ZDoom Wiki "TEXTURES"). A texture is a list of patches put on a
// canvas at x, y (negative and outside the canvas are fine, later patches cover earlier ones).

// ---- PNAMES: a count, then 8-letter names ----------------------------------------------
export const readPnames = buf => {
  if (!buf || buf.length < 4) return [];
  const n = Math.max(0, Math.min(buf.readInt32LE(0), Math.floor((buf.length - 4) / 8)));
  const out = [];
  for (let i = 0; i < n; i++) {
    const at = 4 + i * 8;
    let end = at;
    while (end < at + 8 && buf[end] !== 0) end++;
    out.push(buf.toString('latin1', at, end).toUpperCase());
  }
  return out;
};

// ---- TEXTURE1 / TEXTURE2 ----------------------------------------------------------------
// a count, a position per texture; a texture: name (8), flags (2) + x scale (1) + y scale (1)
// (ZDoom; 0 = 1), width, height, [4 unused bytes in Doom], patch count, patches of
// [x, y, patch number (+ 4 unused bytes in Doom)]. Strife leaves out the unused bytes;
// it is found as GZDoom does: a negative patch count or a non-zero "unused" field.
const nameAt = (buf, at) => {
  let end = at;
  while (end < at + 8 && buf[end] !== 0) end++;
  return buf.toString('latin1', at, end).toUpperCase();
};

export const readTextureLump = (buf, pnames, source = 'TEXTURE1') => {
  const out = { textures: [], problems: [] };
  if (!buf || buf.length < 4) return out;
  const count = buf.readInt32LE(0);
  if (count < 0 || 4 + count * 4 > buf.length) {
    out.problems.push(source + ': bad texture count');
    return out;
  }
  const offs = [];
  for (let i = 0; i < count; i++) offs.push(buf.readInt32LE(4 + i * 4));
  const fits = o => o >= 4 && o + 22 <= buf.length;
  // Doom or Strife layout?
  let strife = false;
  for (const o of offs) {
    if (!fits(o)) continue;
    if (buf.readInt16LE(o + 20) < 0 || buf[o + 18] !== 0 || buf[o + 19] !== 0) {
      strife = true;
      break;
    }
  }
  const head = strife ? 18 : 22;
  const each = strife ? 6 : 10;
  offs.forEach((o, i) => {
    if (o < 4 || o + head > buf.length) {
      out.problems.push(source + ': texture ' + i + ' outside the lump');
      return;
    }
    const name = nameAt(buf, o);
    const sx = buf[o + 10];
    const sy = buf[o + 11];
    const width = buf.readInt16LE(o + 12);
    const height = buf.readInt16LE(o + 14);
    const n = buf.readInt16LE(o + (strife ? 16 : 20));
    if (width <= 0 || height <= 0 || n < 0 || o + head + n * each > buf.length) {
      out.problems.push(source + ': ' + name + ' is broken');
      return;
    }
    const patches = [];
    for (let k = 0; k < n; k++) {
      const p = o + head + k * each;
      const num = buf.readInt16LE(p + 4);
      patches.push({ name: num >= 0 && num < pnames.length ? pnames[num] : '', x: buf.readInt16LE(p), y: buf.readInt16LE(p + 2) });
    }
    out.textures.push({
      kind: 'texture',
      name,
      width,
      height,
      xscale: sx ? sx / 8 : 1,
      yscale: sy ? sy / 8 : 1,
      patches,
      // the first texture of TEXTURE1 is never drawn by Doom (the "null" texture)
      isNull: source === 'TEXTURE1' && i === 0,
      source,
      unsupported: ''
    });
  });
  return out;
};

// ---- ZDoom TEXTURES (text) -------------------------------------------------------------------
// The simple cases: Texture / WallTexture / Flat / Sprite / Graphic "NAME", width, height
// { XScale, YScale, Offset, WorldPanning, NoDecals, NoTrim, Patch / Graphic / Sprite "NAME", x, y }.
// Everything else (patch options like FlipX or Translation, old "define" lines, #include ...)
// is listed with its reason, never guessed.
const TYPES = { texture: 'texture', walltexture: 'texture', flat: 'flat', sprite: 'sprite', graphic: 'graphic', wallpatch: 'patch' };

export const tokenize = text => {
  const out = [];
  const s = String(text);
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) i++;
    else if (c === '/' && s[i + 1] === '/') while (i < s.length && s[i] !== '\n') i++;
    else if (c === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      i = end < 0 ? s.length : end + 2;
    } else if (c === '"') {
      const end = s.indexOf('"', i + 1);
      out.push({ t: 'str', v: s.slice(i + 1, end < 0 ? s.length : end) });
      i = end < 0 ? s.length : end + 1;
    } else if ('{},;'.indexOf(c) > -1) {
      out.push({ t: c, v: c });
      i++;
    } else {
      let j = i;
      while (j < s.length && !/[\s{},;"]/.test(s[j]) && !(s[j] === '/' && (s[j + 1] === '/' || s[j + 1] === '*'))) j++;
      const v = s.slice(i, j);
      out.push({ t: /^[-+]?(\d+\.?\d*|\.\d+)$/.test(v) ? 'num' : 'word', v });
      i = j;
    }
  }
  return out;
};

export const parseTexturesText = text => {
  const tk = tokenize(text);
  const defs = [];
  const skipped = [];
  let i = 0;
  const peek = () => tk[i];
  const next = () => tk[i++];
  const word = t => t && (t.t === 'word' || t.t === 'str');
  const num = () => {
    const t = next();
    return t && t.t === 'num' ? Number(t.v) : NaN;
  };
  const comma = () => peek() && peek().t === ',' && next();
  // skip a { ... } block (with blocks inside)
  const skipBlock = () => {
    let depth = 0;
    while (i < tk.length) {
      const t = next();
      if (t.t === '{') depth++;
      else if (t.t === '}' && --depth <= 0) return;
    }
  };
  while (i < tk.length) {
    const t = next();
    if (!word(t)) continue;
    const type = TYPES[t.v.toLowerCase()];
    if (!type) {
      // something this reader does not know: its block is skipped
      if (t.v[0] === '#' || /^define$/i.test(t.v)) skipped.push({ name: (peek() || {}).v || t.v, reason: t.v.toLowerCase() === 'define' ? 'oldDefine' : 'include' });
      else skipped.push({ name: t.v, reason: 'unknown' });
      while (i < tk.length && peek().t !== '{' && !(word(peek()) && TYPES[peek().v.toLowerCase()])) next();
      if (peek() && peek().t === '{') skipBlock();
      continue;
    }
    let optional = false;
    if (word(peek()) && peek().v.toLowerCase() === 'optional') {
      next();
      optional = true;
    }
    const nameTok = next();
    comma();
    const width = num();
    comma();
    const height = num();
    const def = { kind: type, name: nameTok ? String(nameTok.v).toUpperCase() : '', width, height, xscale: 1, yscale: 1, offset: null, patches: [], optional, source: 'TEXTURES', unsupported: '' };
    if (!def.name || !(width > 0) || !(height > 0)) def.unsupported = 'header';
    if (peek() && peek().t === '{') {
      next();
      while (i < tk.length && peek().t !== '}') {
        const p = next();
        const key = String(p.v).toLowerCase();
        if (key === 'xscale') def.xscale = num();
        else if (key === 'yscale') def.yscale = num();
        else if (key === 'offset') {
          const x = num();
          comma();
          def.offset = { x, y: num() };
        } else if (key === 'worldpanning' || key === 'nodecals' || key === 'notrim') def[key] = true;
        else if (key === 'patch' || key === 'graphic' || key === 'sprite') {
          const n = next();
          comma();
          const x = num();
          comma();
          const y = num();
          def.patches.push({ name: n ? String(n.v).toUpperCase() : '', x, y });
          if (peek() && peek().t === '{') {
            // patch options (FlipX, Rotate, Translation, Blend, Alpha, Style ...)
            const start = i;
            skipBlock();
            const inner = tk.slice(start + 1, i - 1).filter(x => x.t === 'word').map(x => x.v);
            if (inner.length) def.unsupported = def.unsupported || 'patchOptions: ' + inner.join(' ');
          }
        } else if (p.t === '{') {
          i--;
          skipBlock();
        } else def.unsupported = def.unsupported || 'property: ' + p.v;
      }
      next();
    }
    if (!def.unsupported && def.patches.some(p => !p.name || isNaN(p.x) || isNaN(p.y))) def.unsupported = 'patchLine';
    if (!def.unsupported && (!(def.xscale > 0) || !(def.yscale > 0))) def.unsupported = 'scale';
    if (type === 'patch') def.unsupported = def.unsupported || 'wallPatch';
    defs.push(def);
  }
  return { defs, skipped };
};

// ---- putting a texture together -------------------------------------------------------------
// getPatch(name) -> RGBA picture { width, height, data } or null
export const compose = (def, getPatch) => {
  const W = def.width;
  const H = def.height;
  const data = Buffer.alloc(W * H * 4);
  const missing = [];
  def.patches.forEach(p => {
    const pic = p.name ? getPatch(p.name) : null;
    if (!pic) {
      missing.push(p.name || '?');
      return;
    }
    for (let y = 0; y < pic.height; y++) {
      const ty = p.y + y;
      if (ty < 0 || ty >= H) continue;
      for (let x = 0; x < pic.width; x++) {
        const tx = p.x + x;
        if (tx < 0 || tx >= W) continue;
        const s = (y * pic.width + x) * 4;
        if (!pic.data[s + 3]) continue;
        pic.data.copy(data, (ty * W + tx) * 4, s, s + 4);
      }
    }
  });
  return { width: W, height: H, data, missing };
};
