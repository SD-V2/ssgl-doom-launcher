// Finds mods in the load order that look like the same mod twice:
//   tier 1: same name and type, different size  (old and new file of one mod)
//   tier 2: same name apart from a version number ("brutal v21" / "brutal v22")
// Numbers without "v" (part 1 / part 2, episode 2) are NOT treated as versions.

const VERSION_TAIL = /[\s._-]*(?:v|ver|version|r|rev)[\s._-]*\d+(?:[._]\d+)*[a-z]?$|[\s_-]+\d+(?:\.\d+)+[a-z]?$/;

export const versionBase = name => {
  const lower = String(name || '').toLowerCase().trim();
  const stripped = lower.replace(VERSION_TAIL, '').trim();
  return stripped.length >= 3 ? stripped : lower;
};

// groups of 2+ different mods that look alike -> [{ key, tier, mods: [...] }]
export const findTwins = mods => {
  const groups = new Map();

  mods.forEach(mod => {
    const key = `${versionBase(mod.name)}|${mod.kind}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mod);
  });

  return Array.from(groups.entries())
    .filter(([, list]) => new Set(list.map(m => m.id)).size > 1)
    .map(([key, list]) => {
      const names = new Set(list.map(m => m.name.toLowerCase()));
      return { key, tier: names.size === 1 ? 1 : 2, mods: list };
    });
};

// the key that remembers "these are different mods"
export const twinKey = group =>
  `twin:${group.mods
    .map(m => m.id)
    .sort()
    .join('|')}`;
