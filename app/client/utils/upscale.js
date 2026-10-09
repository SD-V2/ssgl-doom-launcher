// Small helpers for the Upscaler screen (Tools > Upscaler).

export const DEFAULT_FOLDER = '8_UPSCALE';

// the checkboxes of the screen -> the kinds of pictures (utils/upscaler.js)
export const GROUPS = {
  textures: ['texture', 'flat'],
  sprites: ['sprite'],
  graphics: ['graphic'],
  other: ['other']
};
// monsters, weapons and items stay off until they are proven in the game
export const DEFAULT_GROUPS = { textures: true, sprites: false, graphics: true, other: false };

export const groupsToKinds = groups =>
  Object.keys(GROUPS).reduce((all, g) => (groups[g] ? all.concat(GROUPS[g]) : all), []);

export const kindsToGroups = kinds => {
  const k = new Set(kinds || []);
  return Object.keys(GROUPS).reduce((o, g) => ({ ...o, [g]: GROUPS[g].some(x => k.has(x)) }), {});
};

// counts per group from the counts per kind
export const groupCounts = kinds => {
  const out = {};
  Object.keys(GROUPS).forEach(g => {
    out[g] = GROUPS[g].reduce(
      (s, k) => ({
        count: s.count + ((kinds && kinds[k] && kinds[k].count) || 0),
        pixels: s.pixels + ((kinds && kinds[k] && kinds[k].pixels) || 0)
      }),
      { count: 0, pixels: 0 }
    );
  });
  return out;
};

export const megapixels = px => {
  const mp = px / 1000000;
  return mp >= 10 ? Math.round(mp).toString() : mp >= 0.1 ? mp.toFixed(1) : mp > 0 ? '0.1' : '0';
};

export const formatBytes = bytes => {
  const b = Number(bytes) || 0;
  if (b >= 1024 * 1024 * 1024) return (b / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  if (b >= 1024 * 1024) return Math.max(1, Math.round(b / (1024 * 1024))) + ' MB';
  return Math.max(1, Math.round(b / 1024)) + ' kB';
};

// seconds -> "1:05:09" / "4:07" (the same in every language)
export const formatTime = seconds => {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
};

// folders below the wads folder that look like a place for upscales
export const upscaleFolders = folders =>
  (folders || [])
    .map(parts => (Array.isArray(parts) ? parts.join('/') : String(parts)))
    .filter(f => /upscal/i.test(f.split('/').pop()));

// the folder to offer: the saved one, else one you already have, else 8_UPSCALE
export const pickDestFolder = (saved, folders) => {
  if (saved) return saved;
  const have = upscaleFolders(folders);
  return have.length ? have[0] : DEFAULT_FOLDER;
};

export const destChoices = (folders, current) => {
  const list = upscaleFolders(folders);
  if (list.indexOf(DEFAULT_FOLDER) < 0) list.push(DEFAULT_FOLDER);
  if (current && list.indexOf(current) < 0) list.push(current);
  return list;
};

// how a model reaches a size: the engine's own size, or 4x and then half
export const scaleFor = (model, target) => {
  if (!model) return null;
  if (model.scales.indexOf(target) > -1) return { engineScale: target, shrink: false };
  if (model.scales.indexOf(target * 2) > -1) return { engineScale: target * 2, shrink: true };
  return null;
};

export const resultFileName = (modName, scale) =>
  `${String(modName || 'mod')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim()} upscale ${scale}x.pk3`;

// the name shown in the mod list for a file path (as utils/mods.js makes it)
export const modNameOf = file =>
  String(file || '')
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]+$/, '')
    .replace(/_/g, ' ');

export const isBusy = job => !!job && ['starting', 'running', 'paused'].indexOf(job.phase) > -1;

// ---- Look and the model of every kind (same rules as electron/utils/upscaler.js) ----
export const LOOKS = ['smooth', 'natural', 'sharp'];
export const MODEL_KINDS = ['texture', 'sprite', 'graphic'];
export const SMOOTH_MODEL = 'realesrgan-x4plus-anime';
export const modelKind = kind => (kind === 'sprite' || kind === 'graphic' ? kind : 'texture');
export const modelFor = (list, { model, models, look } = {}, kind) => {
  const has = id => id && (list || []).find(m => m.id === id);
  const mk = modelKind(kind);
  return (
    has((models || {})[mk]) ||
    ((look || 'smooth') === 'smooth' && mk !== 'texture' && has(SMOOTH_MODEL)) ||
    has(model) ||
    has('realesrgan-x4plus') ||
    (list || [])[0] ||
    null
  );
};
