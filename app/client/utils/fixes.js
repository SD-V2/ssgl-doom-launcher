// Finds mods that packages use but that are gone from the mod list, and mods
// in the list that look like their updated versions.
//
// A package stores mod ids (name + size + type). Updating a mod changes its
// size - so the old id is "missing" while the new file sits in the list.
// Package.modNames ({ id: { name, kind } }) keeps the readable names.

// "brutal pack v21" -> "brutal pack"  (the part before a version number)
export const baseName = name => {
  const lower = name.toLowerCase().trim();
  const stripped = lower
    .replace(/[\s._-]*(?:v|ver|version)?[\s._-]*\d+(?:[._]\d+)*[a-z]?$/, '')
    .trim();
  return stripped.length >= 3 ? stripped : lower;
};

// Readable names for ids that are still in the mod list, for packages that do
// not know them yet -> [{ id: packageId, modNames: { modId: { name, kind } } }]
export const rememberUpdates = (packages, mods) => {
  const byId = new Map(mods.map(m => [m.id, m]));
  const updates = [];

  packages.forEach(pack => {
    const known = pack.modNames || {};
    const modNames = {};
    (pack.selected || []).forEach(id => {
      const mod = byId.get(id);
      if (mod && !known[id]) modNames[id] = { name: mod.name, kind: mod.kind };
    });
    if (Object.keys(modNames).length) updates.push({ id: pack.id, modNames });
  });

  return updates;
};

const newest = list =>
  list.reduce((best, m) => (!best || (m.created || 0) > (best.created || 0) ? m : best), null);

// tier 1 = same file name (new size), tier 2 = same name apart from the version
const candidateFor = (entry, mods) => {
  if (entry.info) {
    const name = entry.info.name.toLowerCase();
    const kind = entry.info.kind;
    const same = mods.filter(m => m.kind === kind && m.name.toLowerCase() === name);
    if (same.length) return { mod: newest(same), tier: 1 };

    const base = baseName(entry.info.name);
    const similar = mods.filter(m => m.kind === kind && baseName(m.name) === base);
    if (similar.length) return { mod: newest(similar), tier: 2 };
    return null;
  }

  // no stored name: the id is "name" + digits + type, so look for a mod whose
  // name is the beginning of the id
  const hits = mods.filter(m => {
    if (!entry.id.endsWith(m.kind) || !entry.id.startsWith(m.name)) return false;
    const middle = entry.id.slice(m.name.length, entry.id.length - m.kind.length);
    return /^\d+$/.test(middle);
  });
  if (!hits.length) return null;
  const longest = hits.reduce((a, b) => (b.name.length > a.name.length ? b : a));
  return { mod: longest, tier: 1 };
};

// -> [{ id, name, kind, packages: [names], candidate: { mod, tier } | null }]
export const findFixes = (packages, mods) => {
  const have = new Set(mods.map(m => m.id));
  const missing = new Map();

  packages.forEach(pack => {
    (pack.selected || []).forEach(id => {
      if (have.has(id)) return;
      if (!missing.has(id)) missing.set(id, { id, info: null, packages: [] });
      const entry = missing.get(id);
      if (!entry.info && pack.modNames && pack.modNames[id]) {
        entry.info = pack.modNames[id];
      }
      if (entry.packages.indexOf(pack.name) < 0) entry.packages.push(pack.name);
    });
  });

  return Array.from(missing.values())
    .map(entry => ({
      id: entry.id,
      name: entry.info ? entry.info.name : null,
      kind: entry.info ? entry.info.kind : null,
      packages: entry.packages,
      candidate: candidateFor(entry, mods)
    }))
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
};
