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
