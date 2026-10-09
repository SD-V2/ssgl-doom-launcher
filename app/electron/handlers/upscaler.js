import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

import { findRelease, install, PROJECT } from '../utils/engineDownload';
import { games, gamesRunning } from '../utils/games';
import { getJSON, setJSON } from '../utils/json';
import {
  BIG_RESULT,
  cleanModels,
  compare,
  COMPARE_MAX,
  DEFAULT_LOOK,
  lookOf,
  modelsFor,
  cleanOldTemp,
  collect,
  createJob,
  DEFAULT_FOLDER,
  DEFAULT_MODEL,
  estimateBytes,
  findEngine,
  killTree,
  pickImages,
  preview,
  testEngine
} from '../utils/upscaler';

// Tools > Upscaler: the screen asks, the work happens here (and in the engine
// program, which runs as its own process at a lower priority).

const ok = data => ({ data, error: null });
const fail = e => ({ data: null, error: (e && (e.code || e.message)) || String(e) });

const send = (channel, data) =>
  BrowserWindow.getAllWindows().forEach(w => {
    if (!w.isDestroyed()) w.webContents.send(channel, data);
  });

// ---- settings (own file: upscaler.json) -----------------------------------
const readSettings = async () => {
  let s = {};
  try {
    const got = await getJSON('upscaler');
    if (got && !Array.isArray(got)) s = got;
  } catch (e) {
    s = {};
  }
  return s;
};

const defaultEngineFolder = settings => {
  const base = settings && settings.savepath ? settings.savepath : app.getPath('userData');
  return path.join(base, 'tools', 'realesrgan');
};

const status = async () => {
  const settings = await getJSON('settings');
  const own = await readSettings();
  const engineFolder = own.engineFolder || defaultEngineFolder(settings);
  const engine = findEngine(engineFolder);
  return {
    settings: {
      engineFolder,
      destFolder: own.destFolder || '',
      model: own.model || DEFAULT_MODEL,
      // Smooth / Natural / Sharp, and the model chosen per kind (Compare models)
      look: lookOf(own.look || DEFAULT_LOOK),
      models: cleanModels(own.models),
      chosen: Object.entries(modelsFor(engine.list, { ...own, look: lookOf(own.look) })).reduce(
        (o, [k, m]) => Object.assign(o, { [k]: m ? m.id : '' }),
        {}
      ),
      scale: own.scale || 2,
      // monsters, weapons and items are off until they are proven in the game
      kinds: own.kinds || ['texture', 'flat', 'graphic'],
      small: own.small !== false
    },
    defaults: { engineFolder: defaultEngineFolder(settings), destFolder: DEFAULT_FOLDER },
    modpath: settings.modpath || '',
    engine: { ...engine, tested: tested[engine.exe] || null },
    job: job ? job.state : null,
    project: PROJECT
  };
};

const tested = {};

ipcMain.handle('upscaler/status', async () => {
  try {
    return ok(await status());
  } catch (e) {
    return fail(e);
  }
});

ipcMain.handle('upscaler/saveSettings', async (e, changes) => {
  try {
    const own = await readSettings();
    const allowed = ['engineFolder', 'destFolder', 'model', 'scale', 'kinds', 'small', 'look', 'models'];
    const next = { ...own };
    allowed.forEach(k => {
      if (changes && changes[k] !== undefined) next[k] = changes[k];
    });
    next.look = lookOf(next.look);
    // a model chosen for one kind is kept with the ones of the other kinds
    if (changes && changes.models) next.models = cleanModels({ ...cleanModels(own.models), ...changes.models });
    await setJSON('upscaler', next);
    return ok(await status());
  } catch (err) {
    return fail(err);
  }
});

// ---- the source mod --------------------------------------------------------
const cache = new Map();
const collectCached = async source => {
  const st = fs.statSync(source);
  const key = source + '|' + st.mtimeMs + '|' + st.size;
  if (cache.has(key)) return cache.get(key);
  const res = await collect(source);
  cache.clear();
  cache.set(key, res);
  return res;
};

const outside = found => ({
  type: found.type,
  supported: found.supported,
  reason: found.reason,
  kinds: found.kinds,
  doomFormat: found.doomFormat.length,
  total: found.images.length
});

ipcMain.handle('upscaler/collect', async (e, source) => {
  try {
    return ok(outside(await collectCached(source)));
  } catch (err) {
    return fail(err);
  }
});

// size of the result and free space on the disk
ipcMain.handle('upscaler/estimate', async (e, { source, kinds, scale, destDir, small }) => {
  try {
    const found = await collectCached(source);
    const bytes = estimateBytes(pickImages(found.images, kinds), scale, small !== false);
    let free = null;
    try {
      const where = destDir && fs.existsSync(destDir) ? destDir : path.dirname(source);
      const st = fs.statfsSync(where);
      free = st.bavail * st.bsize;
    } catch (err) {
      free = null;
    }
    return ok({ bytes, big: bytes > BIG_RESULT, free });
  } catch (err) {
    return fail(err);
  }
});

// ---- the engine ------------------------------------------------------------
// the engine, the model and the model of every kind (what the screen sent, else the settings)
const engineAndModel = async (modelId, choice = {}) => {
  const st = await status();
  if (!st.engine.ok) {
    const err = new Error('noEngine');
    err.code = 'noEngine';
    throw err;
  }
  const model = st.engine.list.find(m => m.id === modelId) || st.engine.list[0];
  const look = lookOf(choice.look || st.settings.look);
  const models = modelsFor(st.engine.list, { model: model.id, look, models: cleanModels(choice.models || st.settings.models) });
  return { engine: st.engine, model, models, look };
};

const runTest = async engine => {
  const model = engine.list.find(m => m.id === DEFAULT_MODEL) || engine.list[0];
  const res = await testEngine(engine, model);
  tested[engine.exe] = res;
  return res;
};

ipcMain.handle('upscaler/test', async () => {
  try {
    const st = await status();
    if (!st.engine.ok) return ok({ ...st, test: null });
    const test = await runTest(st.engine);
    return ok({ ...(await status()), test });
  } catch (err) {
    return fail(err);
  }
});

ipcMain.handle('upscaler/setEngineFolder', async (e, folder) => {
  try {
    const own = await readSettings();
    await setJSON('upscaler', { ...own, engineFolder: folder || '' });
    const st = await status();
    const test = st.engine.ok ? await runTest(st.engine) : null;
    return ok({ ...(await status()), test });
  } catch (err) {
    return fail(err);
  }
});

let downloading = null;
ipcMain.handle('upscaler/release', async () => {
  try {
    const asset = await findRelease();
    if (!asset) return fail({ code: 'noRelease' });
    return ok(asset);
  } catch (err) {
    return fail({ code: 'offline', message: err.message });
  }
});

ipcMain.handle('upscaler/download', async (e, asset) => {
  if (downloading) return fail({ code: 'busy' });
  try {
    const st = await status();
    downloading = {};
    let last = 0;
    const engine = await install(
      asset,
      st.settings.engineFolder,
      (done, total) => {
        const now = Date.now();
        if (now - last < 200 && done < total) return;
        last = now;
        send('upscaler/download-progress', { done, total });
      },
      downloading
    );
    downloading = null;
    const test = engine.ok ? await runTest(engine) : null;
    return ok({ ...(await status()), test });
  } catch (err) {
    downloading = null;
    return fail(err);
  }
});

ipcMain.handle('upscaler/cancelDownload', async () => {
  if (downloading && downloading.stop) downloading.stop();
  downloading = null;
  return ok(true);
});

// ---- preview ---------------------------------------------------------------
let previewHold = null;
ipcMain.handle('upscaler/preview', async (e, { source, kinds, scale, model, models: chosen, look: wanted, small }) => {
  try {
    const found = await collectCached(source);
    const { engine, model: m, models, look } = await engineAndModel(model, { models: chosen, look: wanted });
    previewHold = {};
    const started = Date.now();
    const samples = await preview({ images: found.images, kinds, scale, model: m, models, look, engine, small: small !== false }, previewHold);
    previewHold = null;
    return ok({ samples, model: m.id, look, ms: Date.now() - started });
  } catch (err) {
    previewHold = null;
    return fail(err);
  }
});

// "Compare models": the samples through up to 4 models (the ones asked, else the first ones)
ipcMain.handle('upscaler/compare', async (e, { source, kinds, scale, look: wanted, models: ids, small }) => {
  try {
    const found = await collectCached(source);
    const { engine, look } = await engineAndModel('', { look: wanted });
    const asked = (ids || []).map(id => engine.list.find(m => m.id === id)).filter(Boolean);
    const list = (asked.length ? asked : engine.list).slice(0, COMPARE_MAX);
    previewHold = {};
    const res = await compare({ images: found.images, kinds, scale, look, models: list, engine, small: small !== false }, previewHold, p =>
      send('upscaler/compare-progress', p)
    );
    previewHold = null;
    return ok({ ...res, look });
  } catch (err) {
    previewHold = null;
    return fail(err);
  }
});

ipcMain.handle('upscaler/cancelPreview', async () => {
  if (previewHold && previewHold.job) {
    previewHold.job.stopped = true;
    killTree(previewHold.job.child);
  }
  return ok(true);
});

// ---- the job (one at a time; it goes on while you use other screens) -------
let job = null;
let lastSent = 0;
const report = state => {
  const now = Date.now();
  const important = state.phase !== 'running';
  if (!important && now - lastSent < 200) return;
  lastSent = now;
  send('upscaler/progress', state);
};

ipcMain.handle('upscaler/start', async (e, options) => {
  if (job && ['running', 'paused', 'starting'].indexOf(job.state.phase) > -1) return fail({ code: 'busy' });
  try {
    const { source, modName, kinds, scale, model, destFolder, small, look: wanted, models: chosen } = options;
    const settings = await getJSON('settings');
    if (!settings.modpath) return fail({ code: 'noModpath' });
    const destDir = path.join(settings.modpath, ...String(destFolder || DEFAULT_FOLDER).split(/[\\/]+/).filter(Boolean));
    const found = await collectCached(source);
    const { engine, model: m, models, look } = await engineAndModel(model, { models: chosen, look: wanted });
    job = createJob(
      { source, modName, images: found.images, kinds, scale, model: m, models, look, engine, destDir, small: small !== false },
      { onUpdate: report }
    );
    if (gamesRunning()) job.pause('game');
    job.run().then(state => send('upscaler/progress', state));
    return ok(job.state);
  } catch (err) {
    return fail(err);
  }
});

ipcMain.handle('upscaler/state', async () => ok(job ? job.state : null));

ipcMain.handle('upscaler/cancel', async () => {
  if (job) job.cancel();
  return ok(true);
});

ipcMain.handle('upscaler/resume', async () => {
  if (job) job.resume();
  return ok(job ? job.state : null);
});

ipcMain.handle('upscaler/forget', async () => {
  if (job && ['done', 'error', 'cancelled'].indexOf(job.state.phase) > -1) job = null;
  return ok(true);
});

// a game was started from SSGL: the engine needs the graphics card less than you
games.on('start', () => {
  if (job) job.pause('game');
});
games.on('end', () => {
  if (job && job.paused && job.state.pausedReason === 'game') job.resume();
});

app.on('will-quit', () => {
  if (job) job.cancel();
  if (downloading && downloading.stop) downloading.stop();
});

// what an earlier run left behind (a crash): away with it
cleanOldTemp();
