import byteSize from 'byte-size';
import klaw from 'klaw';
import path from 'path';

import { AVAILABLE_IWADS, MOD_EXTENSIONS } from '../constants';
import { getExt } from './common';

const walkWadDir = dir => {
  if (!dir || dir.trim() === '') {
    throw new Error('WAD Directory is not set');
  }

  const mods = [];
  const iwads = [];
  const filter = item => {
    const basename = path.basename(item);
    return basename === '.' || basename[0] !== '.';
  };

  return new Promise((resolve, reject) => {
    return klaw(dir, { depthLimit: -1, filter })
      .on('readable', function() {
        let item;
        while ((item = this.read())) {
          if (item.stats.isFile()) {
            const checkname = path
              .parse(item.path)
              .name.replace(/_/g, ' ')
              .toLowerCase();

            if (AVAILABLE_IWADS.indexOf(checkname) > -1) {
              iwads.push(IWADItem(item));
            } else if (isModFile(item.path)) {
              mods.push(modItem(item, dir));
            }
          }
        }
        iwads.sort((a, b) => {
          if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
          if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
          return 0;
        });
      })
      .on('end', () => {
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

        return resolve({ mods: unique, iwads, duplicates, versions });
      })
      .on('error', err => reject(err.message));
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

const modItem = (item, dir) => {
  const sz = byteSize(item.stats.size);
  const meta = getMetaData(item, dir);

  return {
    id: meta.id,
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

export { modItem, isModFile, walkWadDir };
