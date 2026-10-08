// The "sections" view of the load order: mods are grouped by what they are
// (libraries, main mod, monsters, ...). The section of a mod is found from the NAMES
// of its folders (the folder closest to the mod first), or by what you chose by hand.
// You can rename the sections, change their words and explanations, add sections of
// your own and take away the ones you never use - all of that is in the "rules".

// ---------------------------------------------------------------------------
// the built-in sections
// ---------------------------------------------------------------------------

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

// "other" catches everything else and "maps" is for the maps: they stay
const FIXED = ['other', 'maps'];

export const MOD_SECTIONS = SECTION_ORDER.filter(id => id !== 'maps');

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

// what the editor shows as the words of a built-in section
// (a word matches the START of a word in a folder name: "monster" also finds "monsters")
export const DEFAULT_WORDS = {
  libraries: 'lib, framework, requirement, dependenc',
  main: 'main, base, core, bp, brutal, overhaul',
  monsters: 'monster, enem, bestiary',
  glory: 'glory, execution, finisher, fatalit',
  weapons: 'weapon, gun, arsenal',
  gameplay: 'gameplay, tweak, misc, pickup, ammo, health, balance, qol',
  sounds: 'sound, sfx, audio, voice',
  music: 'music, soundtrack, ost, midi',
  textures: 'textur, upscal, hd, flat, hires, resolution',
  visual: 'visual, hud, light, shader, effect, vfx, graphic',
  patches: 'patch, compat, fix'
};

// ---------------------------------------------------------------------------
// the rules (saved)
// ---------------------------------------------------------------------------
//   folders: { 'Folder/Sub': sectionId }   given by hand (right click on a folder)
//   mods:    { modId: sectionId }          given by hand (dragged / tag)
//   order:   [sectionId, ...]              the order of the sections
//   custom:  [{ id, name, note, words }]   sections you made
//   names / notes / words: { sectionId: text }   changed texts of built-in sections
//   hidden:  [sectionId, ...]              built-in sections you removed

export const emptyRules = () => ({
  folders: {},
  mods: {},
  order: [],
  custom: [],
  names: {},
  notes: {},
  words: {},
  hidden: []
});

const isObject = x => !!x && typeof x === 'object' && !Array.isArray(x);
const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

export const newCustomId = () =>
  `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// can be removed / has words: the built-in sections except "other" and "maps"
const allowedBuiltin = id => SECTION_ORDER.indexOf(id) > -1 && FIXED.indexOf(id) < 0;
// can get another name and explanation: all built-in sections
const textBuiltin = id => SECTION_ORDER.indexOf(id) > -1;

const cleanCustom = list => {
  const seen = {};
  const out = [];
  (Array.isArray(list) ? list : []).forEach(c => {
    if (!isObject(c) || typeof c.id !== 'string' || !c.id) return;
    if (SECTION_ORDER.indexOf(c.id) > -1 || seen[c.id]) return;
    seen[c.id] = true;
    out.push({
      id: c.id,
      name: text(c.name, 60).trim() || 'Section',
      note: text(c.note, 300),
      words: text(c.words, 300)
    });
  });
  return out;
};

// ids that exist with these rules (built-in ones you did not remove, yours, other, maps)
export const availableIds = rules => {
  const r = rules || {};
  const hidden = Array.isArray(r.hidden) ? r.hidden : [];
  const ids = SECTION_ORDER.filter(id => FIXED.indexOf(id) > -1 || hidden.indexOf(id) < 0);
  cleanCustom(r.custom).forEach(c => ids.push(c.id));
  return ids;
};

// the usual order: the built-in sections, yours in front of "other"
const defaultOrder = rules => {
  const base = availableIds(rules).filter(id => SECTION_ORDER.indexOf(id) > -1);
  const custom = cleanCustom(rules && rules.custom).map(c => c.id);
  const out = [];
  base.forEach(id => {
    if (id === 'other') custom.forEach(c => out.push(c));
    out.push(id);
  });
  return out;
};

// The order of the sections is yours (rules.order). Always: every section once,
// the maps last. A section that is missing from a saved order keeps its usual place.
export const normalizeOrder = (order, rules) => {
  const usual = defaultOrder(rules);
  const there = {};
  usual.forEach(id => {
    there[id] = true;
  });

  const out = [];
  (Array.isArray(order) ? order : []).forEach(id => {
    if (id !== 'maps' && there[id] && out.indexOf(id) < 0) out.push(id);
  });

  usual.forEach((id, i) => {
    if (id === 'maps' || out.indexOf(id) > -1) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const found = out.indexOf(usual[j]);
      if (found > -1) {
        at = found + 1;
        break;
      }
    }
    out.splice(at, 0, id);
  });

  return [...out, 'maps'];
};

// make any saved / half-made rules safe to use
export const sanitizeRules = raw => {
  const r = isObject(raw) ? raw : {};
  const custom = cleanCustom(r.custom);
  const hidden = (Array.isArray(r.hidden) ? r.hidden : []).filter(
    (id, i, all) => allowedBuiltin(id) && all.indexOf(id) === i
  );
  const base = { custom, hidden };
  const valid = availableIds(base);

  // changed texts only count for built-in sections
  const pickTexts = (source, max, allowed) => {
    const out = {};
    if (isObject(source)) {
      Object.keys(source).forEach(id => {
        if (allowed(id) && typeof source[id] === 'string') {
          out[id] = source[id].slice(0, max);
        }
      });
    }
    return out;
  };

  const pickRules = source => {
    const out = {};
    if (isObject(source)) {
      Object.keys(source).forEach(key => {
        const id = source[key];
        // a rule that points to a section that does not exist (any more) is dropped
        if (typeof id === 'string' && id !== 'maps' && valid.indexOf(id) > -1) {
          out[key] = id;
        }
      });
    }
    return out;
  };

  const withTexts = {
    ...base,
    names: pickTexts(r.names, 60, textBuiltin),
    notes: pickTexts(r.notes, 300, textBuiltin),
    words: pickTexts(r.words, 300, allowedBuiltin)
  };

  return {
    ...withTexts,
    folders: pickRules(r.folders),
    mods: pickRules(r.mods),
    order: normalizeOrder(r.order, withTexts)
  };
};

export const sectionOrder = rules => normalizeOrder(rules && rules.order, rules);

export const sectionIndex = (id, order = SECTION_ORDER) => {
  const at = order.indexOf(id);
  return at < 0 ? order.indexOf('other') : at;
};

// The numbers follow the place: first section = 0, and so on. "Other" has none.
export const sectionNumbers = order => {
  const numbers = {};
  let n = 0;
  order.forEach(id => {
    if (id !== 'other') {
      numbers[id] = n;
      n += 1;
    }
  });
  return numbers;
};

// one place up / down; the last place belongs to the maps
export const moveSection = (order, id, direction) => {
  const from = order.indexOf(id);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (id === 'maps' || from < 0 || to < 0 || to >= order.length - 1) return order;
  const next = [...order];
  next[from] = order[to];
  next[to] = order[from];
  return next;
};

// name and explanation as shown (yours, or the built-in text in the language of the app)
export const sectionName = (id, rules, t) => {
  const custom = cleanCustom(rules && rules.custom).find(c => c.id === id);
  if (custom) return custom.name;
  const given = rules && rules.names && rules.names[id];
  return given && given.trim() ? given : t(`wads:sec_${id}`);
};

export const sectionNote = (id, rules, t) => {
  const custom = cleanCustom(rules && rules.custom).find(c => c.id === id);
  if (custom) return custom.note;
  const given = rules && rules.notes && rules.notes[id];
  return given && given.trim() ? given : t(`wads:secNote_${id}`);
};

// ---------------------------------------------------------------------------
// finding the section
// ---------------------------------------------------------------------------

const normalize = name =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "Cheat, god mode; qol" -> ['cheat', 'god mode', 'qol']
export const parseWords = value =>
  Array.from(
    new Set(
      String(value || '')
        .split(/[,;\n]+/)
        .map(w => normalize(w))
        .filter(w => w.length >= 2)
    )
  );

const wordsToRegs = words => parseWords(words).map(w => new RegExp(`\\b${escapeRegExp(w)}`));

export const sectionOfFolder = (folder, rules) => {
  const name = normalize(folder);
  if (!name) return 'other';
  const r = rules || {};
  const hidden = Array.isArray(r.hidden) ? r.hidden : [];

  // your own sections first: your words win
  const mine = cleanCustom(r.custom).find(c => wordsToRegs(c.words).some(re => re.test(name)));
  if (mine) return mine.id;

  const hit = COMPILED.find(([id, regs]) => {
    if (hidden.indexOf(id) > -1) return false;
    const changed = r.words && typeof r.words[id] === 'string';
    return (changed ? wordsToRegs(r.words[id]) : regs).some(re => re.test(name));
  });
  return hit ? hit[0] : 'other';
};

export const sectionOf = (mod, rules) => {
  if (mod.isMap) return 'maps';
  const parts = mod.folders && mod.folders.length ? mod.folders : mod.folder ? [mod.folder] : [];
  // The folder CLOSEST to the mod decides ("Brutal Doom / 10_VISUAL" -> visual): the
  // upper folders are often only the name of a project or pack. If the closest folder
  // says nothing, the next one up is tried, and so on.
  for (let i = parts.length - 1; i >= 0; i--) {
    const found = sectionOfFolder(parts[i], rules);
    if (found !== 'other') return found;
  }
  return 'other';
};

// The section of a mod, in this order of importance:
//   1. the mod itself was put into a section by hand (rules.mods)
//   2. its folder (or a folder above it) was given a section (rules.folders)
//   3. the words in the folder names
export const resolveSection = (mod, rules = {}) => {
  if (mod.isMap) return 'maps';
  const valid = availableIds(rules);
  const usable = id => !!id && id !== 'maps' && valid.indexOf(id) > -1;

  const own = rules.mods && rules.mods[mod.id];
  if (usable(own)) return own;

  const parts =
    mod.folders && mod.folders.length ? mod.folders : mod.folder ? [mod.folder] : [];
  for (let i = parts.length; i >= 1; i--) {
    const given = rules.folders && rules.folders[parts.slice(0, i).join('/')];
    if (usable(given)) return given;
  }

  return sectionOf(mod, rules);
};

// Neighbours in the load order that belong to one section form a group:
//   [{ section, entries: [{ id, index, mod }] }]
// A mod that is missing (not found) stays with the group before it.
export const groupBySection = (ids, mods, rules) => {
  const byId = new Map(mods.map(m => [m.id, m]));
  const groups = [];

  ids.forEach((id, index) => {
    const mod = byId.get(id) || null;
    const last = groups[groups.length - 1];
    const section = mod ? resolveSection(mod, rules) : last ? last.section : 'other';

    if (last && last.section === section) {
      last.entries.push({ id, index, mod });
    } else {
      groups.push({ section, entries: [{ id, index, mod }] });
    }
  });

  return groups;
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
export const sortBySections = (selected, mods, rules) => {
  const order = sectionOrder(rules);
  return keyed(selected, mods, rules)
    .sort(
      (a, b) =>
        sectionIndex(a.section, order) - sectionIndex(b.section, order) ||
        a.index - b.index
    )
    .map(x => x.id);
};

export const isSectionSorted = (selected, mods, rules) => {
  const sorted = sortBySections(selected, mods, rules);
  return sorted.every((id, i) => id === selected[i]);
};

// every section, also the empty ones: { libraries: [{ id, index, mod }], ... }
export const groupFixed = (selected, mods, rules) => {
  const groups = {};
  sectionOrder(rules).forEach(id => {
    groups[id] = [];
  });
  keyed(selected, mods, rules).forEach(entry => {
    if (!groups[entry.section]) groups[entry.section] = [];
    groups[entry.section].push({ id: entry.id, index: entry.index, mod: entry.mod });
  });
  return groups;
};
