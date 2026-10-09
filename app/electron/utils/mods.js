import byteSize from 'byte-size';
import path from 'path';

import fs from 'fs';

import { AVAILABLE_IWADS, MAP_ID_PREFIX, MOD_EXTENSIONS } from '../constants';
import { getExt } from './common';
import { isInside } from './safepath';

// folders that never hold mods (and can be huge): not looked into
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '__macosx', '$recycle.bin', 'system volume information']);

const statOrNull = file =>
  new Promise(resolve => fs.stat(file, (err, st) => resolve(err ? null : st)));

// The folders are walked like before (breadth first, in the order the disk lists them),
// but only the files that can be mods or IWADs are asked for their size and date: a
// folder with thousands of loose files (an unpacked mod) costs a directory listing,
// not one disk request per file. All disk requests are asynchronous, so the main part
// stays free for the window.
const BATCH = 64;

const walk = async (root, onDir, onFiles) => {
  const queue = [{ full: path.resolve(root), dirent: null }];
  // an index instead of shift(): shift() on a long list is slow (every item moves)
  for (let next = 0; next < queue.length; next++) {
    const { full, dirent } = queue[next];
    queue[next] = null;
    let isDir = dirent ? dirent.isDirectory() : true;
    if (dirent && dirent.isSymbolicLink()) {
      const st = await statOrNull(full);
      if (!st) continue;
      isDir = st.isDirectory();
    }
    if (!isDir) {
      // this file and the files right after it: asked together, kept in order
      const files = [full];
      while (files.length < BATCH && next + 1 < queue.length && queue[next + 1].dirent && queue[next + 1].dirent.isFile()) {
        next++;
        files.push(queue[next].full);
        queue[next] = null;
      }
      await onFiles(files);
      continue;
    }
    if (dirent) onDir(full);
    let entries;
    try {
      entries = await fs.promises.readdir(full, { withFileTypes: true });
    } catch (e) {
      if (!dirent) throw e; // the WAD folder itself cannot be read
      continue;
    }
    entries.forEach(d => {
      if (d.name[0] === '.' || SKIP_DIRS.has(d.name.toLowerCase())) return;
      queue.push({ full: path.join(full, d.name), dirent: d });
    });
  }
};

// options.isMap: the folder holds maps - they get their own ids and a flag
const walkWadDir = (dir, options = {}) => {
  if (!dir || dir.trim() === '') {
    throw new Error('WAD Directory is not set');
  }
  const isMap = !!options.isMap;

  const mods = [];
  const iwads = [];
  const folders = [];
  const root = path.resolve(dir);

  return new Promise((resolve, reject) => {
    const isIwad = file =>
      AVAILABLE_IWADS.indexOf(
        path
          .parse(file)
          .name.replace(/_/g, ' ')
          .toLowerCase()
      ) > -1;
    const onFiles = async files => {
      const wanted = files.filter(f => isIwad(f) || isModFile(f));
      const stats = await Promise.all(wanted.map(statOrNull));
      wanted.forEach((file, i) => {
        if (!stats[i] || !stats[i].isFile()) return;
        const item = { path: file, stats: stats[i] };
        if (isIwad(file)) iwads.push(IWADItem(item));
        else mods.push(modItem(item, dir, isMap));
      });
    };
    const onDir = full => {
      const rel = path.relative(root, full);
      if (rel) folders.push(rel.split(path.sep));
    };
    walk(root, onDir, onFiles)
      .then(() => {
        iwads.sort((a, b) => {
          if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
          if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
          return 0;
        });
        finish();
      })
      .catch(err => reject(err.message));

    const finish = () => {
        // same id (name + size + type) found more than once = exact duplicate
        const byId = new Map();
        mods.forEach(m => {
          if (!byId.has(m.id)) byId.set(m.id, []);
          byId.get(m.id).push(m);
        });
        const groups = Array.from(byId.values());

        // last one wins - same behaviour as before
        const unique = groups.map(list => list[list.length - 1]);

        const natural = (a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true });

        const duplicates = groups
          .filter(list => list.length > 1)
          .map(list => ({
            id: list[0].id,
            name: list[0].name,
            kind: list[0].kind,
            size: list[0].size,
            bytes: list[0].bytes,
            paths: list.map(m => m.path)
          }))
          .sort(natural);

        // same name + type but a different size = probably different versions
        const byName = new Map();
        unique.forEach(m => {
          const key = `${m.name.toLowerCase()}|${m.kind}`;
          if (!byName.has(key)) byName.set(key, []);
          byName.get(key).push(m);
        });
        const versions = Array.from(byName.values())
          .filter(list => list.length > 1)
          .map(list => ({
            name: list[0].name,
            kind: list[0].kind,
            items: list.map(m => ({ id: m.id, path: m.path, size: m.size }))
          }))
          .sort(natural);

        return resolve({ mods: unique, iwads, duplicates, versions, folders });
    };
  });
};

const getMetaData = (item, dir) => {
  const name = path.parse(item.path).name.replace(/_/g, ' ');
  const ext = getExt(item.path);

  const parts = item.path
    .substring(0, item.path.lastIndexOf(path.sep))
    .replace(`${dir}`, '')
    .split(path.sep)
    .filter(i => i.trim() !== '');

  let tags = parts.map(i => i.toLowerCase());

  if (tags.length > 3) {
    tags = tags.slice(0, 3);
  }

  return {
    id: `${name}${item.stats.size}${ext}`,
    name: name,
    ext: getExt(item.path),
    tags: tags,
    // first folder below the WAD directory, original spelling ('' = no folder)
    folder: parts[0] || '',
    // the whole folder path below the WAD directory, original spelling
    folders: parts
  };
};

const IWADItem = item => {
  const sz = byteSize(item.stats.size);
  const meta = getMetaData(item);
  return {
    id: meta.id,
    name: meta.name,
    kind: meta.ext,
    path: item.path,
    size: `${sz.value} ${sz.unit}`,
    created: item.stats.birthtimeMs,
    active: false
  };
};

const isModFile = item => {
  const EXT = path
    .parse(item)
    .ext.toUpperCase()
    .trim()
    .substr(1);

  return MOD_EXTENSIONS.indexOf(EXT) > -1;
};

const modItem = (item, dir, isMap = false) => {
  const sz = byteSize(item.stats.size);
  const meta = getMetaData(item, dir);

  return {
    id: isMap ? `${MAP_ID_PREFIX}${meta.id}` : meta.id,
    isMap,
    lastdir: path.basename(path.dirname(item.path)).toLowerCase(),
    tags: meta.tags,
    folder: meta.folder,
    folders: meta.folders,
    name: meta.name,
    kind: meta.ext,
    path: item.path,
    size: `${sz.value} ${sz.unit}`,
    created: item.stats.birthtimeMs,
    bytes: item.stats.size,
    active: false
  };
};

// Mods and (if a maps directory is set) maps, in one list. Maps are marked with
// isMap. A maps directory inside the mod directory (or the other way round) does
// not make files show up twice.
const scanLibrary = async settings => {
  const library = await walkWadDir(settings.modpath);
  const mapdir = String(settings.mappath || '').trim();

  if (!mapdir || !fs.existsSync(mapdir)) {
    return { ...library, mapFolders: [] };
  }

  const maps = await walkWadDir(mapdir, { isMap: true });

  const same = path.resolve(mapdir) === path.resolve(settings.modpath);
  const mapsInsideMods = isInside(settings.modpath, mapdir);
  const modsInsideMaps = isInside(mapdir, settings.modpath);

  // a folder inside the other one: files only count for the inner folder
  const modsOnly = mapsInsideMods
    ? library.mods.filter(m => !isInside(mapdir, m.path))
    : library.mods;
  const mapsOnly = same
    ? []
    : modsInsideMaps
    ? maps.mods.filter(m => !isInside(settings.modpath, m.path))
    : maps.mods;

  return {
    ...library,
    mods: [...modsOnly, ...mapsOnly],
    duplicates: [...library.duplicates, ...maps.duplicates],
    versions: [...library.versions, ...maps.versions],
    mapFolders: same ? [] : maps.folders
  };
};

export { modItem, isModFile, scanLibrary, walkWadDir };
