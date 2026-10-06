const NAME_UNPURE_PACKAGE = 'unnamed';

// ids of map files start with this, so a map never gets the id of a mod
const MAP_ID_PREFIX = 'map:';

// where SSGL looks for updates while the setting "Look for updates at" was never
// touched (an empty setting means: never check)
const DEFAULT_UPDATE_REPO = 'SD-V2/ssgl-doom-launcher';

const MOD_EXTENSIONS = [
  'PK3',
  'PK7',
  'WAD',
  'DEH',
  'BEX',
  'BEH',
  'DEH',
  'CLD',
  'ZIP',
  'RAR',
  '7Z'
];

const AVAILABLE_IWADS = [
  'chex',
  'chex2',
  'doom',
  'doom2',
  'doom64',
  'freedm',
  'freedoom1',
  'freedoom2',
  'hacx',
  'heretic',
  'heretic1',
  'hexdd',
  'hexen',
  'plutonia',
  'strife0',
  'strife1',
  'tnt'
];

export {
  AVAILABLE_IWADS,
  DEFAULT_UPDATE_REPO,
  MAP_ID_PREFIX,
  MOD_EXTENSIONS,
  NAME_UNPURE_PACKAGE
};
