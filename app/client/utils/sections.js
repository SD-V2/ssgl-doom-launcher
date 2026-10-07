// The "sections" view of the load order: mods are grouped by what they are
// (libraries, main mod, monsters, ...). The section is found from the NAME of the
// top-level folder of the mod ("3_MONSTERS" -> monsters), maps are their own section.
// Nothing is sorted or moved by this - it only changes how the load order is shown.

export const SECTION_NUMBER = {
  libraries: 0,
  main: 1,
  monsters: 2,
  glory: 3,
  weapons: 4,
  gameplay: 5,
  sounds: 6,
  music: 7,
  textures: 8,
  visual: 9,
  patches: 10,
  maps: 11
};

// the more specific ones first ("soundtrack" is music, not sounds)
const KEYWORDS = [
  ['patches', ['patch', 'compat', 'fixes', '\\bfix\\b']],
  ['libraries', ['\\blib', 'framework', 'requirement', 'dependenc']],
  ['music', ['music', 'soundtrack', '\\bost\\b', 'midi']],
  ['sounds', ['sound', 'sfx', 'audio', 'voice']],
  ['glory', ['glory', 'execution', 'finisher', 'fatalit']],
  ['monsters', ['monster', 'enem', 'bestiary']],
  ['weapons', ['weapon', '\\bguns?\\b', 'arsenal']],
  ['textures', ['textur', 'upscal', '\\bhd\\b', '\\bflats?\\b', 'hires', 'resolution']],
  ['visual', ['visual', '\\bhud\\b', '\\blight', 'shader', 'effect', '\\bvfx\\b', 'graphic']],
  ['main', ['\\bmain', '\\bbase\\b', '\\bcore\\b', '\\bbp\\b', 'brutal', 'overhaul']],
  ['gameplay', ['gameplay', 'tweak', '\\bmisc', 'pickup', '\\bammo\\b', '\\bhealth\\b', 'balance', '\\bqol\\b']]
];

const COMPILED = KEYWORDS.map(([id, words]) => [id, words.map(w => new RegExp(w))]);

const normalize = name =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const sectionOfFolder = folder => {
  const text = normalize(folder);
  if (!text) return 'other';
  const hit = COMPILED.find(([, regs]) => regs.some(re => re.test(text)));
  return hit ? hit[0] : 'other';
};

export const sectionOf = mod => {
  if (mod.isMap) return 'maps';
  const parts = mod.folders && mod.folders.length ? mod.folders : mod.folder ? [mod.folder] : [];
  // the top folder decides; a deeper folder name only helps when the top one says nothing
  const top = sectionOfFolder(parts[0]);
  if (top !== 'other') return top;
  for (let i = 1; i < parts.length; i++) {
    const deeper = sectionOfFolder(parts[i]);
    if (deeper !== 'other') return deeper;
  }
  return 'other';
};

// Neighbours in the load order that belong to one section form a group:
//   [{ section, entries: [{ id, index, mod }] }]
// A mod that is missing (not found) stays with the group before it.
export const groupBySection = (ids, mods) => {
  const byId = new Map(mods.map(m => [m.id, m]));
  const groups = [];

  ids.forEach((id, index) => {
    const mod = byId.get(id) || null;
    const last = groups[groups.length - 1];
    const section = mod ? sectionOf(mod) : last ? last.section : 'other';

    if (last && last.section === section) {
      last.entries.push({ id, index, mod });
    } else {
      groups.push({ section, entries: [{ id, index, mod }] });
    }
  });

  return groups;
};

// ---------------------------------------------------------------------------
// Fixed sections: the load order is always arranged section after section.
// "Other" sits in front of the patches, so patches really stay behind everything.
// ---------------------------------------------------------------------------

export const SECTION_ORDER = [
  'libraries',
  'main',
  'monsters',
  'glory',
  'weapons',
  'gameplay',
  'sounds',
  'music',
  'textures',
  'visual',
  'other',
  'patches',
  'maps'
];

// the sections a mod can be put into (maps only live in "maps")
export const MOD_SECTIONS = SECTION_ORDER.filter(id => id !== 'maps');

export const sectionIndex = id => {
  const at = SECTION_ORDER.indexOf(id);
  return at < 0 ? SECTION_ORDER.indexOf('other') : at;
};

const usable = id => !!id && id !== 'maps' && SECTION_ORDER.indexOf(id) > -1;

// The section of a mod, in this order of importance:
//   1. the mod itself was put into a section by hand (rules.mods)
//   2. its folder (or a folder above it) was given a section (rules.folders)
//   3. the words in the folder name
export const resolveSection = (mod, rules = {}) => {
  if (mod.isMap) return 'maps';

  const own = rules.mods && rules.mods[mod.id];
  if (usable(own)) return own;

  const parts =
    mod.folders && mod.folders.length ? mod.folders : mod.folder ? [mod.folder] : [];
  for (let i = parts.length; i >= 1; i--) {
    const given = rules.folders && rules.folders[parts.slice(0, i).join('/')];
    if (usable(given)) return given;
  }

  return sectionOf(mod);
};

// [{ id, index (place in the load order), section }] - a mod that is missing
// stays with the one before it
const keyed = (selected, mods, rules) => {
  const byId = new Map(mods.map(m => [m.id, m]));
  let last = 'other';
  return selected.map((id, index) => {
    const mod = byId.get(id);
    const section = mod ? resolveSection(mod, rules) : last;
    last = section;
    return { id, index, section, mod: mod || null };
  });
};

// stable: inside a section the order you made stays
export const sortBySections = (selected, mods, rules) =>
  keyed(selected, mods, rules)
    .sort(
      (a, b) =>
        sectionIndex(a.section) - sectionIndex(b.section) || a.index - b.index
    )
    .map(x => x.id);

export const isSectionSorted = (selected, mods, rules) => {
  const sorted = sortBySections(selected, mods, rules);
  return sorted.every((id, i) => id === selected[i]);
};

// every section, also the empty ones: { libraries: [{ id, index, mod }], ... }
export const groupFixed = (selected, mods, rules) => {
  const groups = {};
  SECTION_ORDER.forEach(id => {
    groups[id] = [];
  });
  keyed(selected, mods, rules).forEach(entry => {
    groups[entry.section].push({ id: entry.id, index: entry.index, mod: entry.mod });
  });
  return groups;
};
