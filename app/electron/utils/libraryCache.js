import fs from 'fs';

import { getDataFile } from './common';
import { setJSON } from './json';

// The list of mods from the last start (library-cache.json in the data folder). At the
// start SSGL shows it at once, then reads the folders again in the background and puts
// in what changed while it was closed (added, removed, renamed). Saved like every other
// file of SSGL (temp file + .bak). A broken file or one for other folders is ignored.

export const CACHE = 'library-cache';
export const VERSION = 1;

const keyOf = settings => ({
  modpath: String((settings && settings.modpath) || ''),
  mappath: String((settings && settings.mappath) || '')
});

const sameKey = (a, b) => !!a && !!b && a.modpath === b.modpath && a.mappath === b.mappath;

// -> the saved scan result, or null when there is none that fits
export const readCache = async settings => {
  try {
    // read directly: a broken cache is simply not used (no "file restored" notice)
    const c = JSON.parse(await fs.promises.readFile(getDataFile(CACHE) + '.json', 'utf8'));
    if (!c || Array.isArray(c) || c.version !== VERSION) return null;
    if (!sameKey(c.key, keyOf(settings))) return null;
    const r = c.result;
    if (!r || !Array.isArray(r.mods) || !Array.isArray(r.iwads) || !Array.isArray(r.folders)) return null;
    return r;
  } catch (e) {
    return null; // broken: the folders are read as usual
  }
};

export const writeCache = async (settings, result) => {
  try {
    await setJSON(CACHE, { version: VERSION, key: keyOf(settings), savedAt: Date.now(), result });
    return true;
  } catch (e) {
    return false;
  }
};

// did anything change between two scans (files, sizes, dates, folders)?
const fingerprint = r =>
  JSON.stringify([
    (r.mods || []).map(m => [m.id, m.path, m.created]),
    (r.iwads || []).map(m => [m.id, m.path]),
    r.folders || [],
    r.mapFolders || []
  ]);

export const sameLibrary = (a, b) => !!a && !!b && fingerprint(a) === fingerprint(b);
