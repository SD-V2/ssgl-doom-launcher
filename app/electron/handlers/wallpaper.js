import { app, ipcMain } from 'electron';

import { choose, save } from '../utils/wallpaper';

// the wallpaper in the size of the screen (see utils/wallpaper.js)
ipcMain.handle('wallpaper/choose', async (e, { file, width, height }) => {
  try {
    return { data: await choose(app.getPath('userData'), file, width, height), error: null };
  } catch (err) {
    return { data: { show: file, make: false }, error: null };
  }
});

ipcMain.handle('wallpaper/save', async (e, { key, bytes }) => {
  try {
    return { data: await save(app.getPath('userData'), key, bytes), error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
});
