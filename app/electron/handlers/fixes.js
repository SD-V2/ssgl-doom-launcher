import { ipcMain } from 'electron';

import { getJSON, setJSON } from '../utils/json';

// Packages only store mod ids (name + size + type). To still recognise a mod
// after an update, the readable names are stored with the package.
ipcMain.handle('packages/remember', async (e, data) => {
  try {
    const packages = await getJSON('packages');
    let changed = false;

    (data.updates || []).forEach(update => {
      const pack = packages.find(p => p.id === update.id);
      if (!pack) return;
      pack.modNames = { ...(pack.modNames || {}), ...update.modNames };
      changed = true;
    });

    if (changed) await setJSON('packages', packages);
    return { data: { packages }, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
});

// old mod id -> new mod id, in every package that uses it (same position)
ipcMain.handle('packages/replaceMods', async (e, data) => {
  try {
    const replacements = data.replacements || [];
    const map = new Map(replacements.map(r => [r.from, r]));
    const packages = await getJSON('packages');
    let changed = 0;

    packages.forEach(pack => {
      if (!Array.isArray(pack.selected)) return;
      if (!pack.selected.some(id => map.has(id))) return;

      const selected = [];
      pack.selected.forEach(id => {
        const next = map.has(id) ? map.get(id).to : id;
        if (selected.indexOf(next) < 0) selected.push(next);
      });
      pack.selected = selected;

      const names = { ...(pack.modNames || {}) };
      replacements.forEach(r => {
        delete names[r.from];
        if (r.name) names[r.to] = { name: r.name, kind: r.kind };
      });
      pack.modNames = names;
      changed += 1;
    });

    if (changed) await setJSON('packages', packages);
    return { data: { packages, changed }, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
});
