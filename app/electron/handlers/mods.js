import { ipcMain } from 'electron';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'fs';
import path from 'path';

import { getExt } from '../utils/common';
import { getJSON } from '../utils/json';
import { isModFile, modItem } from '../utils/mods';

// Mods dropped from outside the WAD Directory get copied into this subfolder
const IMPORT_DIR = 'Added via Explorer';

const freePath = (dir, name) => {
  const { name: base, ext } = path.parse(name);
  let candidate = path.join(dir, name);
  for (let i = 2; existsSync(candidate); i++) {
    candidate = path.join(dir, `${base} (${i})${ext}`);
  }
  return candidate;
};

const isInside = (dir, file) => {
  const rel = path.relative(path.resolve(dir), path.resolve(file));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

// Takes file paths (dropped from the OS file manager) and returns mod items
// ready to be put into a package. Files outside the WAD Directory are copied in.
ipcMain.handle('mods/add', async (e, data) => {
  try {
    const { paths, known } = data;
    const settings = await getJSON('settings');

    if (!settings.modpath || settings.modpath.trim() === '') {
      throw new Error('WAD Directory is not set');
    }

    const knownIds = new Set(known);
    const mods = [];
    const ids = [];
    const skipped = [];

    for (const src of paths) {
      try {
        const stats = statSync(src);
        if (!stats.isFile() || !isModFile(src)) {
          skipped.push(path.basename(src));
          continue;
        }

        // same id scheme as walkWadDir: already in the mod list, just select it
        const srcId = `${path.parse(src).name.replace(/_/g, ' ')}${
          stats.size
        }${getExt(src)}`;
        if (knownIds.has(srcId)) {
          ids.push(srcId);
          continue;
        }

        let target = src;
        if (!isInside(settings.modpath, src)) {
          const dir = path.join(settings.modpath, IMPORT_DIR);
          mkdirSync(dir, { recursive: true });
          target = freePath(dir, path.basename(src));
          copyFileSync(src, target);
        }

        const item = modItem(
          { path: target, stats: statSync(target) },
          settings.modpath
        );
        mods.push(item);
        ids.push(item.id);
      } catch (err) {
        skipped.push(path.basename(src));
      }
    }

    return { error: null, data: { mods, ids, skipped } };
  } catch (e) {
    return { data: null, error: e.message };
  }
});
