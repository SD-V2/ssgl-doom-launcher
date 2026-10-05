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
import { AppError, toPayload } from '../utils/errors';
import { getJSON } from '../utils/json';
import { isModFile, modItem } from '../utils/mods';
import { importFolderParts, isInside, splitFolderKey } from '../utils/safepath';

// Mods dropped from outside the WAD Directory go here unless the setting
// "Folder for new mods" says something else
const DEFAULT_IMPORT_DIR = 'Added via Explorer';

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

const modId = (src, stats) =>
  `${path.parse(src).name.replace(/_/g, ' ')}${stats.size}${getExt(src)}`;

// Copies dropped files / folders into `targetDir` (when they are not already in
// the WAD directory) and returns mod items for them.
//   skipInside: files already inside the WAD directory are left alone
const importPaths = ({ paths, modpath, targetDir, known, skipInside }) => {
  const knownIds = new Set(known);
  const newIds = new Set();
  const mods = [];
  const ids = [];
  const skipped = [];
  const already = [];

  // getDestDir is only called if the file really has to be copied
  const addFile = (src, getDestDir) => {
    const stats = statSync(src);
    const id = modId(src, stats);

    if (knownIds.has(id) || newIds.has(id)) {
      ids.push(id);
      already.push(path.basename(src));
      return;
    }

    let target = src;
    if (!isInside(modpath, src)) {
      const dir = getDestDir();
      mkdirSync(dir, { recursive: true });
      target = freePath(dir, path.basename(src));
      copyFileSync(src, target);
    } else if (skipInside) {
      already.push(path.basename(src));
      return;
    }

    const item = modItem({ path: target, stats: statSync(target) }, modpath);
    mods.push(item);
    ids.push(item.id);
    newIds.add(item.id);
  };

  paths.forEach(src => {
    try {
      const stats = statSync(src);

      if (stats.isDirectory()) {
        const files = listModFiles(src);
        if (!files.length) {
          skipped.push(path.basename(src));
          return;
        }
        // keep the folder (and its subfolders) as a tag in SSGL
        let folder = null;
        files.forEach(rel => {
          addFile(path.join(src, rel), () => {
            folder = folder || freePath(targetDir, path.basename(src), true);
            return path.join(folder, path.dirname(rel));
          });
        });
      } else if (isModFile(src) && !isIwadName(src)) {
        addFile(src, () => targetDir);
      } else {
        skipped.push(path.basename(src));
      }
    } catch (err) {
      skipped.push(path.basename(src));
    }
  });

  return { mods, ids, skipped, already };
};

const getSettings = async () => {
  const settings = await getJSON('settings');
  if (!settings.modpath || settings.modpath.trim() === '') {
    throw new AppError('E_NO_WADDIR');
  }
  return settings;
};

// Takes file / folder paths (dropped from the OS file manager onto the load
// order) and returns mod items ready to be put into a package. Files outside the
// WAD Directory are copied into the folder for new mods; mods that are already
// known are simply selected.
ipcMain.handle('mods/add', async (e, data) => {
  try {
    const settings = await getSettings();
    const parts = importFolderParts(settings.importFolder) || [DEFAULT_IMPORT_DIR];

    const { mods, ids, skipped } = importPaths({
      paths: data.paths,
      modpath: settings.modpath,
      targetDir: path.join(settings.modpath, ...parts),
      known: data.known,
      skipInside: false
    });

    return { error: null, data: { mods, ids, skipped } };
  } catch (e) {
    return { data: null, error: toPayload(e) };
  }
});

// Files / folders dropped onto a folder of the mod list: copied into exactly
// that folder ('' = top level of the WAD directory). The mod list is refreshed
// by the window afterwards.
ipcMain.handle('mods/import', async (e, data) => {
  try {
    const settings = await getSettings();
    const parts = splitFolderKey(data.folder);
    const targetDir = path.join(settings.modpath, ...parts);

    if (parts.length && !isInside(settings.modpath, targetDir)) {
      throw new AppError('E_OUTSIDE');
    }

    const { mods, skipped, already } = importPaths({
      paths: data.paths,
      modpath: settings.modpath,
      targetDir,
      known: data.known,
      skipInside: true
    });

    return {
      error: null,
      data: { copied: mods.length, skipped, already }
    };
  } catch (e) {
    return { data: null, error: toPayload(e) };
  }
});
