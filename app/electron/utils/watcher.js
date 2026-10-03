import { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

let watcher = null;
let watched = '';
let timer = null;

const DELAY = 2000;

const defaultNotify = () =>
  BrowserWindow.getAllWindows().forEach(win =>
    win.webContents.send('mods/changed')
  );

export const stopWatching = () => {
  clearTimeout(timer);
  if (watcher) {
    try {
      watcher.close();
    } catch (e) {}
  }
  watcher = null;
  watched = '';
};

// Watches the WAD Directory and tells the window when something changed.
// Changes are collected for a moment, so copying a big mod only triggers once.
export const watchModDir = (dir, notify = defaultNotify, delay = DELAY) => {
  if (watcher && dir === watched) return true;

  stopWatching();

  if (!dir || dir.trim() === '' || !fs.existsSync(dir)) return false;

  try {
    watcher = fs.watch(dir, { recursive: true }, (event, filename) => {
      if (filename && path.basename(String(filename))[0] === '.') return;
      clearTimeout(timer);
      timer = setTimeout(notify, delay);
    });
    watcher.on('error', stopWatching);
    watched = dir;
    return true;
  } catch (e) {
    // recursive watching is not available on every platform
    watcher = null;
    return false;
  }
};
