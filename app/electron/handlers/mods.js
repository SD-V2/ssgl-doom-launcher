import { ipcMain } from 'electron';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync
} from 'fs';
import path from 'path';

import { AVAILABLE_IWADS } from '../constants';
import { getExt } from '../utils/common';
import { getJSON } from '../utils/json';
import { isModFile, modItem } from '../utils/mods';

// Mods dropped from outside the WAD Directory get copied into this subfolder
const IMPORT_DIR = 'Added via Explorer';

const natural = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const freePath = (dir, name, isDir = false) => {
  const parsed = path.parse(name);
  const base = isDir ? name : parsed.name;
  const ext = isDir ? '' : parsed.ext;
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

// IWADs are not mods for SSGL (same rule as walkWadDir)
const isIwadName = file =>
  AVAILABLE_IWADS.indexOf(
    path
      .parse(file)
      .name.replace(/_/g, ' ')
      .toLowerCase()
  ) > -1;

// All mod files inside a folder (recursive), in natural name order,
// so "01_base.pk3, 02_addon.pk3, 10_extra.pk3" load in the order you'd expect
const listModFiles = root => {
  const found = [];
  const walk = dir => {
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      return;
    }
    entries.forEach(entry => {
      if (entry.name[0] === '.') return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && isModFile(full) && !isIwadName(full)) {
        found.push(path.relative(root, full));
      }
    });
  };
  walk(root);
  return found.sort(natural);
};

// Takes file / folder paths (dropped from the OS file manager) and returns mod
// items ready to be put into a package. Files outside the WAD Directory are
// copied in; mods that are already known are simply selected.
ipcMain.handle('mods/add', async (e, data) => {
  try {
    const { paths, known } = data;
    const settings = await getJSON('settings');
    const modpath = settings.modpath;

    if (!modpath || modpath.trim() === '') {
      throw new Error('WAD Directory is not set');
    }

    const importDir = path.join(modpath, IMPORT_DIR);
    const knownIds = new Set(known);
    const newIds = new Set();
    const mods = [];
    const ids = [];
    const skipped = [];

    // getDestDir is only called if the file really has to be copied
    const addFile = (src, getDestDir) => {
      const stats = statSync(src);
      const id = `${path.parse(src).name.replace(/_/g, ' ')}${
        stats.size
      }${getExt(src)}`;

      if (knownIds.has(id) || newIds.has(id)) {
        ids.push(id);
        return;
      }

      let target = src;
      if (!isInside(modpath, src)) {
        const dir = getDestDir();
        mkdirSync(dir, { recursive: true });
        target = freePath(dir, path.basename(src));
        copyFileSync(src, target);
      }

      const item = modItem({ path: target, stats: statSync(target) }, modpath);
      mods.push(item);
      ids.push(item.id);
      newIds.add(item.id);
    };

    for (const src of paths) {
      try {
        const stats = statSync(src);

        if (stats.isDirectory()) {
          const files = listModFiles(src);
          if (!files.length) {
            skipped.push(path.basename(src));
            continue;
          }
          // keep the folder (and its subfolders) as a tag in SSGL
          let folder = null;
          files.forEach(rel => {
            addFile(path.join(src, rel), () => {
              folder = folder || freePath(importDir, path.basename(src), true);
              return path.join(folder, path.dirname(rel));
            });
          });
        } else if (isModFile(src) && !isIwadName(src)) {
          addFile(src, () => importDir);
        } else {
          skipped.push(path.basename(src));
        }
      } catch (err) {
        skipped.push(path.basename(src));
      }
    }

    return { error: null, data: { mods, ids, skipped } };
  } catch (e) {
    return { data: null, error: e.message };
  }
});
