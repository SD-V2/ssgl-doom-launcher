import { ipcMain } from 'electron';

import { checkFile } from '../utils/health';

const pause = () => new Promise(resolve => setImmediate(resolve));

// items = [{ id, name, path, kind }]
ipcMain.handle('mods/health', async (e, data) => {
  try {
    const problems = [];
    let checked = 0;
    let unchecked = 0;

    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const result = checkFile(item.path, item.kind);

      if (result.status === 'unchecked') {
        unchecked += 1;
      } else {
        checked += 1;
        if (result.status === 'problem') {
          problems.push({
            id: item.id,
            name: item.name,
            path: item.path,
            kind: item.kind,
            code: result.code,
            detail: result.detail || ''
          });
        }
      }

      // keep the program responsive while hundreds of files are looked at
      if (i % 25 === 24) await pause();
    }

    return { error: null, data: { checked, unchecked, problems } };
  } catch (err) {
    return { data: null, error: err.message };
  }
});
