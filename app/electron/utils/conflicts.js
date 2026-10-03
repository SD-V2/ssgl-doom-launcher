// Works out which resources of a mod can be overridden by another mod.
// Two mods "conflict" when they contain the same resource: the one loaded later
// (lower in the load order) wins.

const IGNORED_NAMES = new Set([
  // definition lumps the engine merges from every file
  'MAPINFO', 'ZMAPINFO', 'GAMEINFO', 'SNDINFO', 'SNDSEQ', 'LANGUAGE', 'KEYCONF',
  'DECALDEF', 'ANIMDEFS', 'GLDEFS', 'BRIGHTMAPS', 'MODELDEF', 'VOXELDEF',
  'TEXTURES', 'DECORATE', 'ZSCRIPT', 'CVARINFO', 'MENUDEF', 'SBARINFO',
  'LOADACS', 'REVERBS', 'TERRAIN', 'FONTDEFS', 'LOCKDEFS', 'DEHACKED',
  'TEXTURE1', 'TEXTURE2', 'PNAMES', 'COMPATIBILITY', 'X11R6RGB', 'SKYDEFS',
  // text files that only describe the mod
  'README', 'CREDITS', 'LICENSE', 'LICENCE', 'COPYING', 'CHANGELOG', 'CHANGES',
  'INSTALL', 'NOTES', 'AUTHORS', 'THANKS', 'TODO', 'HISTORY', 'THUMBS'
]);

const IGNORED_EXT = new Set(['url', 'nfo', 'diz', 'md', 'html', 'htm', 'exe', 'bat', 'db', 'ds_store']);

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tga', 'pcx', 'dds', 'webp', 'imgz', 'lmp']);
const AUDIO_EXT = new Set(['wav', 'ogg', 'mp3', 'flac', 'opus', 'mid', 'midi', 'mus', 'mod', 'it', 'xm', 's3m', 'lmp']);

// pk3 folders whose files are found by name, not by path
const NAME_FOLDERS = {
  sprites: 'sprites',
  flats: 'flats',
  patches: 'patches',
  graphics: 'graphics',
  textures: 'textures',
  hires: 'textures',
  sounds: 'sounds',
  music: 'music',
  colormaps: 'colormaps',
  voxels: 'voxels'
};

const MAP_NAME = /^(MAP\d\d|E\dM\d+)$/;
const MAP_LUMPS = new Set([
  'THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES',
  'SECTORS', 'REJECT', 'BLOCKMAP', 'BEHAVIOR', 'SCRIPTS', 'TEXTMAP', 'ENDMAP',
  'ZNODES', 'DIALOGUE', 'SCRIPTS'
]);

const WAD_START = {
  S_START: 'sprites', SS_START: 'sprites',
  F_START: 'flats', FF_START: 'flats',
  P_START: 'patches', PP_START: 'patches',
  TX_START: 'textures', HI_START: 'textures',
  C_START: 'colormaps', V_START: 'voxels', VX_START: 'voxels'
};
const WAD_END = new Set(['S_END', 'SS_END', 'F_END', 'FF_END', 'P_END', 'PP_END', 'TX_END', 'HI_END', 'C_END', 'V_END', 'VX_END']);

const splitName = file => {
  const dot = file.lastIndexOf('.');
  return dot > 0
    ? { base: file.slice(0, dot).toUpperCase(), ext: file.slice(dot + 1) }
    : { base: file.toUpperCase(), ext: '' };
};

const isIgnored = (base, ext) =>
  IGNORED_NAMES.has(base) || IGNORED_EXT.has(ext) || base[0] === '.';

const soundOrMusic = base => (/^D_/.test(base) ? 'music' : 'sounds');

// File names of a zip / pk3 -> set of resource keys
const zipKeys = names => {
  const keys = new Set();
  names.forEach(raw => {
    const path = raw.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
    if (path.indexOf('__macosx/') === 0) return;
    const parts = path.split('/');
    const { base, ext } = splitName(parts[parts.length - 1]);
    if (!base || isIgnored(base, ext)) return;

    if (parts.length === 1) {
      // root of the archive = global namespace
      if (IMAGE_EXT.has(ext)) keys.add(`graphics:${base}`);
      else if (AUDIO_EXT.has(ext)) keys.add(`${soundOrMusic(base)}:${base}`);
      else keys.add(`path:${path}`);
      return;
    }

    const folder = NAME_FOLDERS[parts[0]];
    if (folder) {
      keys.add(`${folder}:${base}`);
    } else if (parts[0] === 'maps' && ext === 'wad' && MAP_NAME.test(base)) {
      keys.add(`map:${base}`);
    } else {
      keys.add(`path:${path}`);
    }
  });
  return keys;
};

// Lump names of a WAD (in file order) -> set of resource keys
const wadKeys = lumps => {
  const keys = new Set();
  let namespace = null;

  lumps.forEach(name => {
    if (WAD_START[name]) {
      namespace = WAD_START[name];
      return;
    }
    if (WAD_END.has(name)) {
      namespace = null;
      return;
    }
    // sub markers like P1_START, F2_END
    if (/_(START|END)$/.test(name)) return;
    if (MAP_NAME.test(name)) {
      keys.add(`map:${name}`);
      return;
    }
    if (MAP_LUMPS.has(name) || /^GL_/.test(name)) return;
    if (isIgnored(name, '')) return;

    if (namespace) keys.add(`${namespace}:${name}`);
    else if (/^D[SP]/.test(name)) keys.add(`sounds:${name}`);
    else if (/^D_/.test(name)) keys.add(`music:${name}`);
    else keys.add(`graphics:${name}`);
  });
  return keys;
};

// ---- readable names for groups of resources -------------------------------

const SPRITES = {
  PUNG: 'Fist', PISG: 'Pistol', PISF: 'Pistol', PIST: 'Pistol',
  SHTG: 'Shotgun', SHTF: 'Shotgun', SHOT: 'Shotgun',
  SHT2: 'Super shotgun', SGN2: 'Super shotgun',
  CHGG: 'Chaingun', CHGF: 'Chaingun', MGUN: 'Chaingun',
  MISG: 'Rocket launcher', MISF: 'Rocket launcher', LAUN: 'Rocket launcher',
  PLSG: 'Plasma rifle', PLSF: 'Plasma rifle', PLAS: 'Plasma rifle',
  BFGG: 'BFG 9000', BFGF: 'BFG 9000', BFUG: 'BFG 9000',
  SAWG: 'Chainsaw', CSAW: 'Chainsaw',
  MISL: 'Rockets', PLSS: 'Plasma shots', PLSE: 'Plasma shots',
  BFS1: 'BFG shots', BFE1: 'BFG shots', BFE2: 'BFG shots',
  PUFF: 'Bullet puffs', BLUD: 'Blood', TFOG: 'Teleport fog', IFOG: 'Item fog',
  POSS: 'Zombieman', SPOS: 'Shotgun guy', CPOS: 'Chaingunner', TROO: 'Imp',
  SARG: 'Demon', HEAD: 'Cacodemon', SKUL: 'Lost soul', BOSS: 'Baron of Hell',
  BOS2: 'Hell knight', FATT: 'Mancubus', BSPI: 'Arachnotron',
  PAIN: 'Pain elemental', SKEL: 'Revenant', VILE: 'Arch-vile',
  CYBR: 'Cyberdemon', SPID: 'Spider mastermind', PLAY: 'Player',
  SSWV: 'Wolfenstein SS', KEEN: 'Commander Keen',
  BAL1: 'Imp fireball', BAL2: 'Cacodemon shot', BAL7: 'Baron shot',
  MANF: 'Mancubus shot', APLS: 'Arachnotron shot', APBX: 'Arachnotron shot',
  MEDI: 'Medikit', STIM: 'Stimpack', BON1: 'Health bonus', BON2: 'Armor bonus',
  ARM1: 'Green armor', ARM2: 'Blue armor', SOUL: 'Soulsphere', MEGA: 'Megasphere',
  PINV: 'Invulnerability', PSTR: 'Berserk', PINS: 'Invisibility',
  SUIT: 'Radiation suit', PMAP: 'Computer map', PVIS: 'Light amp visor',
  BPAK: 'Backpack', CLIP: 'Ammo', AMMO: 'Ammo', SHEL: 'Ammo', SBOX: 'Ammo',
  ROCK: 'Ammo', BROK: 'Ammo', CELL: 'Ammo', CELP: 'Ammo',
  BAR1: 'Barrel', BEXP: 'Barrel',
  BKEY: 'Keys', RKEY: 'Keys', YKEY: 'Keys', BSKU: 'Keys', RSKU: 'Keys', YSKU: 'Keys'
};

const SOUNDS = [
  [/^DS(SHOTGN|SGCOCK)$/, 'Shotgun'],
  [/^DS(DSHTGN|DBOPN|DBCLS|DBLOAD)$/, 'Super shotgun'],
  [/^DSPISTOL$/, 'Pistol'],
  [/^DSRLAUNC$/, 'Rocket launcher'],
  [/^DSRXPLOD$/, 'Explosions'],
  [/^DSPLASMA$/, 'Plasma rifle'],
  [/^DSBFG$/, 'BFG 9000'],
  [/^DSSAW/, 'Chainsaw'],
  [/^DS(PLPAIN|PLDETH|PDIEHI|OOF|NOWAY|SLOP)$/, 'Player voice'],
  [/^DS(POS|SPOS)/, 'Zombieman / shotgun guy'],
  [/^DS(BGSIT|BGACT|BGDTH)/, 'Imp'],
  [/^DS(SWTCHN|SWTCHX)$/, 'Switches'],
  [/^DS(ITEMUP|WPNUP)$/, 'Pickups']
];

const labelFor = key => {
  const at = key.indexOf(':');
  const ns = key.slice(0, at);
  const name = key.slice(at + 1);

  switch (ns) {
    case 'sprites':
      return SPRITES[name.slice(0, 4)] || 'Other sprites';
    case 'sounds': {
      const hit = SOUNDS.find(([re]) => re.test(name));
      return hit ? hit[1] : 'Other sounds';
    }
    case 'music':
      return 'Music';
    case 'flats':
    case 'textures':
    case 'patches':
      return 'Textures & flats';
    case 'map':
      return 'Maps';
    case 'graphics':
      if (/^(PLAYPAL|COLORMAP|GENMIDI|DMXGUS)/.test(name)) return 'Palette & instruments';
      if (/^ST/.test(name)) return 'Status bar & HUD';
      if (/^M_/.test(name)) return 'Menu graphics';
      if (/^(WI|INTER)/.test(name)) return 'Intermission screens';
      if (/^(TITLEPIC|CREDIT|HELP|VICTORY|ENDPIC|PFUB|BOSSBACK)/.test(name)) return 'Title & end screens';
      return 'Other graphics';
    case 'path':
      return 'Scripts & data files';
    default:
      return 'Other resources';
  }
};

const displayName = key => {
  const at = key.indexOf(':');
  const ns = key.slice(0, at);
  const name = key.slice(at + 1);
  return ns === 'path' ? name : `${ns}/${name}`;
};

// mods = [{ keys: Set }] in load order -> list of conflicting pairs, a before b,
// so b wins
const findConflicts = (mods, maxPairs = 200, maxSample = 60) => {
  const owners = new Map();
  mods.forEach((mod, index) => {
    mod.keys.forEach(key => {
      const list = owners.get(key);
      if (list) list.push(index);
      else owners.set(key, [index]);
    });
  });

  const pairs = new Map();
  owners.forEach((list, key) => {
    if (list.length < 2) return;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const id = `${list[i]}:${list[j]}`;
        let pair = pairs.get(id);
        if (!pair) {
          pair = { a: list[i], b: list[j], keys: [] };
          pairs.set(id, pair);
        }
        pair.keys.push(key);
      }
    }
  });

  return Array.from(pairs.values())
    .map(pair => {
      const counts = {};
      pair.keys.forEach(key => {
        const label = labelFor(key);
        counts[label] = (counts[label] || 0) + 1;
      });
      return {
        a: pair.a,
        b: pair.b,
        count: pair.keys.length,
        groups: Object.keys(counts)
          .map(label => ({ label, count: counts[label] }))
          .sort((x, y) => y.count - x.count),
        sample: pair.keys.slice(0, maxSample).map(displayName)
      };
    })
    .sort((x, y) => y.count - x.count)
    .slice(0, maxPairs);
};

export { findConflicts, labelFor, wadKeys, zipKeys };
