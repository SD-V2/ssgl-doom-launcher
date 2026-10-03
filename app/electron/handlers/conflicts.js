import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

import { readContents } from '../utils/archive';
import { findConflicts, wadKeys, zipKeys } from '../utils/conflicts';

const PATCH_EXT = ['.deh', '.bex', '.beh', '.cld'];

// scanning results are kept until the file changes
const cache = new Map();

const scan = file => {
  const stats = fs.statSync(file);
  const hit = cache.get(file);
  if (hit && hit.size === stats.size && hit.mtime === stats.mtimeMs) {
    return hit.result;
  }

  let result;
  if (PATCH_EXT.indexOf(path.extname(file).toLowerCase()) > -1) {
    result = { code: 'patch' };
  } else {
    try {
      const { type, entries } = readContents(file);
      result = { keys: type === 'wad' ? wadKeys(entries) : zipKeys(entries) };
    } catch (err) {
      result = {
        code: err.code === 'unsupported' ? 'unsupported' : 'unreadable',
        detail: err.code === 'unsupported' ? err.message.split(':')[1] : ''
      };
    }
  }

  cache.set(file, { size: stats.size, mtime: stats.mtimeMs, result });
  return result;
};

// items = mods of the load order, in load order: [{ id, name, path }]
ipcMain.handle('mods/conflicts', async (e, data) => {
  try {
    const checked = [];
    const skipped = [];

    data.items.forEach(item => {
      let result;
      try {
        result = scan(item.path);
      } catch (err) {
        result = { code: 'unreadable', detail: '' };
      }
      if (result.keys) {
        checked.push({ id: item.id, name: item.name, keys: result.keys });
      } else {
        skipped.push({ id: item.id, name: item.name, code: result.code, detail: result.detail });
      }
    });

    const conflicts = findConflicts(checked).map(c => ({
      a: checked[c.a].id,
      aName: checked[c.a].name,
      b: checked[c.b].id,
      bName: checked[c.b].name,
      count: c.count,
      groups: c.groups,
      sample: c.sample
    }));

    return {
      error: null,
      data: { checked: checked.length, skipped, conflicts }
    };
  } catch (err) {
    return { data: null, error: err.message };
  }
});
