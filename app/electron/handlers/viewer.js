import { spawn } from 'child_process';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

import { scan } from '../utils/doom/library';
import { getJSON, setJSON } from '../utils/json';
import { remember, startIn } from '../utils/lastFolder';
import { encode, fit } from '../utils/png';

// Tools > Graphics viewer: every picture of a mod (WAD or PK3), in Doom's own formats or PNG.
// The list comes at once; thumbnails are made when the screen asks for them.

const ok = data => ({ data, error: null });
const fail = e => ({ data: null, error: (e && (e.code || e.message)) || String(e) });

// ---- settings (viewer.json): the game for the palette, the SLADE program ------------------------
const readSettings = async () => {
  try {
    const s = await getJSON('viewer');
    return s && !Array.isArray(s) ? s : {};
  } catch (e) {
    return {};
  }
};

ipcMain.handle('viewer/settings', async (e, changes) => {
  try {
    const own = await readSettings();
    if (changes) {
      if (typeof changes.palette === 'string') own.palette = changes.palette;
      if (typeof changes.slade === 'string') own.slade = changes.slade;
      await setJSON('viewer', own);
    }
    return ok({ palette: own.palette || '', slade: own.slade && fs.existsSync(own.slade) ? own.slade : '' });
  } catch (err) {
    return fail(err);
  }
});

// ---- the scans: the last two are kept (a big WAD is not read again for every thumbnail) --------
const scans = new Map();
const scanOf = async source => {
  const st = fs.statSync(source);
  const own = await readSettings();
  const palette = own.palette && fs.existsSync(own.palette) ? own.palette : '';
  const key = source + '|' + st.size + '|' + st.mtimeMs + '|' + palette;
  if (scans.has(key)) return scans.get(key);
  const res = await scan(source, { palette });
  if (scans.size >= 2) scans.delete(scans.keys().next().value);
  scans.set(key, res);
  return res;
};

ipcMain.handle('viewer/open', async (e, source) => {
  try {
    const s = await scanOf(source);
    return ok({ type: s.type, palette: s.palette, entries: s.entries, unsupported: s.unsupported, bad: s.bad, problems: s.problems });
  } catch (err) {
    return fail(err);
  }
});

export { fit };

const dataUrl = buf => 'data:image/png;base64,' + buf.toString('base64');

// thumbnails for a few pictures at once -> [{ id, url } | { id, error }]
ipcMain.handle('viewer/thumbs', async (e, { source, ids, size = 96 }) => {
  try {
    const s = await scanOf(source);
    const out = [];
    for (const id of (ids || []).slice(0, 200)) {
      try {
        const img = await s.readRgba(id);
        out.push({ id, url: dataUrl(encode(fit(img, size), { rgb: false, level: 1 })) });
      } catch (err) {
        out.push({ id, error: err.code || 'broken' });
      }
    }
    return ok(out);
  } catch (err) {
    return fail(err);
  }
});

// the picture at its real size (the screen makes it bigger, pixel by pixel)
ipcMain.handle('viewer/picture', async (e, { source, id }) => {
  try {
    const s = await scanOf(source);
    return ok({ url: dataUrl(await s.readPng(id)) });
  } catch (err) {
    return fail(err);
  }
});

// "Save as PNG": with the offsets (grAb), as GZDoom and SLADE read them
ipcMain.handle('viewer/save', async (e, { source, id, title }) => {
  try {
    const s = await scanOf(source);
    const entry = s.entries[id];
    const bytes = await s.readPng(id);
    const res = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), {
      title: title || 'Save as PNG',
      defaultPath: startIn(entry.name + '.png'),
      filters: [{ name: 'PNG', extensions: ['png'] }]
    });
    if (res.canceled || !res.filePath) return ok({ canceled: true });
    fs.writeFileSync(res.filePath, bytes);
    remember(res.filePath);
    return ok({ file: res.filePath });
  } catch (err) {
    return fail(err);
  }
});

// "Open in SLADE": SLADE is started as its own program with the file
export const sladeCommand = (slade, source) => ({ file: slade, args: [source], cwd: path.dirname(slade) });
ipcMain.handle('viewer/slade', async (e, source) => {
  try {
    const own = await readSettings();
    if (!own.slade || !fs.existsSync(own.slade)) return fail({ code: 'noSlade' });
    const cmd = sladeCommand(own.slade, source);
    const child = spawn(cmd.file, cmd.args, { cwd: cmd.cwd, detached: true, stdio: 'ignore' });
    child.on('error', () => null);
    child.unref();
    return ok(true);
  } catch (err) {
    return fail(err);
  }
});
