import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import shortid from 'shortid';

import { copyfile, createPath } from '../utils/common';
import { AppError, toPayload } from '../utils/errors';
import { getJSON, setJSON } from '../utils/json';
import { walkWadDir } from '../utils/mods';
import { remember, startIn } from '../utils/lastFolder';

const FORMAT = 'ssgl-packages';
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const filters = labels => [
  {
    name: (labels && labels.filter) || 'SSGL packages (*.json)',
    extensions: ['json']
  }
];

const safeName = name =>
  String(name || 'package')
    .replace(/[\\/:*?"<>|]+/g, '')
    .trim() || 'package';

const coverFile = cover =>
  cover && cover.isFile && typeof cover.use === 'string'
    ? cover.use.replace(/^file:\/\//, '')
    : null;

// The package definition without anything that only makes sense on this PC
const exportPackage = (pack, sourceports, names) => {
  const port = sourceports.find(s => s.id === pack.sourceport);
  const selected = Array.isArray(pack.selected) ? pack.selected : [];

  const out = {
    name: pack.name,
    iwad: pack.iwad || '',
    iwadName: pack.iwad ? path.basename(pack.iwad) : '',
    sourceportName: port ? port.name : '',
    userparams: pack.userparams || '',
    notes: pack.notes || '',
    selected,
    // readable names, so a missing mod can be found again on another PC
    modNames: selected.reduce((acc, id) => {
      acc[id] = names[id] || id;
      return acc;
    }, {})
  };

  const file = coverFile(pack.cover);
  if (file) {
    try {
      if (fs.existsSync(file) && fs.statSync(file).size <= MAX_COVER_BYTES) {
        out.coverFile = {
          ext: path.extname(file),
          data: fs.readFileSync(file).toString('base64')
        };
      }
    } catch (e) {}
  } else if (pack.cover) {
    out.cover = pack.cover;
  }

  return out;
};

ipcMain.handle('packages/export', async (e, data) => {
  try {
    const { ids = null, names = {} } = data || {};
    const win = BrowserWindow.fromWebContents(e.sender);
    const packages = await getJSON('packages');
    const sourceports = await getJSON('sourceports');
    const chosen = ids ? packages.filter(p => ids.indexOf(p.id) > -1) : packages;

    if (!chosen.length) throw new AppError('E_NO_PACKAGES');

    const res = await dialog.showSaveDialog(win, {
      title: (data.labels && data.labels.title) || 'Export packages',
      defaultPath: startIn(
        `${chosen.length === 1 ? safeName(chosen[0].name) : 'ssgl-packages'}.json`
      ),
      filters: filters(data.labels)
    });

    if (res.canceled || !res.filePath) {
      return { data: { canceled: true }, error: null };
    }
    remember(res.filePath);

    const out = {
      format: FORMAT,
      version: 1,
      exported: new Date().toISOString(),
      packages: chosen.map(p => exportPackage(p, sourceports, names))
    };
    fs.writeFileSync(res.filePath, JSON.stringify(out, null, 2));

    return {
      data: { canceled: false, count: chosen.length, file: res.filePath },
      error: null
    };
  } catch (err) {
    return { data: null, error: toPayload(err) };
  }
});

ipcMain.handle('packages/import', async (e, data) => {
  try {
    const win = BrowserWindow.fromWebContents(e.sender);
    const res = await dialog.showOpenDialog(win, {
      title: (data && data.labels && data.labels.title) || 'Import packages',
      properties: ['openFile'],
      defaultPath: startIn(),
      filters: filters(data && data.labels)
    });

    if (res.canceled || !res.filePaths || !res.filePaths.length) {
      return { data: { canceled: true }, error: null };
    }
    remember(res.filePaths[0]);

    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf8'));
    } catch (err) {
      throw new AppError('E_FILE_UNREADABLE');
    }
    if (!raw || raw.format !== FORMAT || !Array.isArray(raw.packages)) {
      throw new AppError('E_NOT_PACKAGES_FILE');
    }

    const settings = await getJSON('settings');
    const sourceports = await getJSON('sourceports');
    const packages = await getJSON('packages');

    if (!sourceports.length) {
      throw new AppError('E_ADD_SOURCEPORT');
    }
    if (!settings.savepath || settings.savepath.trim() === '') {
      throw new AppError('E_NO_SAVEPATH');
    }

    const { iwads } = settings.modpath
      ? await walkWadDir(settings.modpath)
      : { iwads: [] };

    const taken = new Set(packages.map(p => p.name.toLowerCase()));
    const created = [];
    const imported = [];
    const notes = [];

    raw.packages.forEach(item => {
      if (!item || typeof item.name !== 'string' || !Array.isArray(item.selected)) {
        return;
      }

      // sourceport: same name if we have it, else the first one
      const wanted = String(item.sourceportName || '').toLowerCase();
      let port = sourceports.find(s => s.name.toLowerCase() === wanted);
      if (!port) {
        port = sourceports[0];
        notes.push({
          code: 'sourceport',
          pack: item.name,
          wanted: item.sourceportName || '?',
          used: port.name
        });
      }

      // iwad: same file name as on the other PC
      const iwad = iwads.find(
        i => path.basename(i.path).toLowerCase() === String(item.iwadName).toLowerCase()
      );
      if (!iwad) {
        notes.push({
          code: 'iwad',
          pack: item.name,
          wanted: item.iwadName || '?'
        });
      }
      const iwadPath = iwad ? iwad.path : item.iwad || '';

      // unique name
      let name = item.name;
      for (let n = 2; taken.has(name.toLowerCase()); n++) {
        name = `${item.name} (imported${n > 2 ? ` ${n - 1}` : ''})`;
      }
      taken.add(name.toLowerCase());

      // own data folder like every new package gets
      const id = shortid.generate();
      const datapath = path.join(port.id, id);
      const DATAPATH = path.join(settings.savepath, datapath);
      if (!fs.existsSync(DATAPATH)) createPath(DATAPATH);

      if (
        port.hasConfig &&
        port.configDefault &&
        fs.existsSync(port.configDefault) &&
        !fs.existsSync(path.join(DATAPATH, port.configFilename))
      ) {
        copyfile(port.configDefault, path.join(DATAPATH, port.configFilename));
      }

      // cover
      let cover = item.cover || {
        isFile: false,
        use: iwadPath ? path.parse(iwadPath).name.toLowerCase() : 'doom2'
      };
      if (item.coverFile && item.coverFile.data) {
        try {
          const ext = /^\.[a-z0-9]{1,5}$/i.test(item.coverFile.ext)
            ? item.coverFile.ext
            : '.png';
          const target = path.join(DATAPATH, `cover${ext}`);
          fs.writeFileSync(target, Buffer.from(item.coverFile.data, 'base64'));
          cover = { isFile: true, use: `file://${target}` };
        } catch (err) {}
      }

      created.push({
        id,
        datapath,
        name,
        iwad: iwadPath,
        sourceport: port.id,
        selected: item.selected.filter(i => typeof i === 'string'),
        created: Date.now(),
        lastplayed: 0,
        userparams: item.userparams || '',
        notes: item.notes || '',
        cover
      });
      imported.push({
        name,
        selected: item.selected,
        modNames: item.modNames || {}
      });
    });

    if (!created.length) throw new AppError('E_EMPTY_PACKAGES_FILE');

    const newPackages = [...created, ...packages];
    await setJSON('packages', newPackages);

    return {
      data: { canceled: false, packages: newPackages, imported, notes },
      error: null
    };
  } catch (err) {
    return { data: null, error: toPayload(err) };
  }
});
