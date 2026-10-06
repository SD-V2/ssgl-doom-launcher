import { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

let watchers = [];
let watched = '';
let timer = null;

const DELAY = 2000;

const defaultNotify = () =>
  BrowserWindow.getAllWindows().forEach(win =>
    win.webContents.send('mods/changed')
  );

export const stopWatching = () => {
  clearTimeout(timer);
  watchers.forEach(w => {
    try {
      w.close();
    } catch (e) {}
  });
  watchers = [];
  watched = '';
};

// Watches the WAD directory (and the maps directory) and tells the window when
// something changed. Changes are collected for a moment, so copying a big mod only
// triggers once. dirs = one folder or a list of folders.
export const watchModDir = (dirs, notify = defaultNotify, delay = DELAY) => {
  const list = (Array.isArray(dirs) ? dirs : [dirs])
    .map(d => String(d || '').trim())
    .filter(d => d !== '' && fs.existsSync(d));
  const key = list.join('|');

  if (watchers.length && key === watched) return true;

  stopWatching();
  if (!list.length) return false;

  list.forEach(dir => {
    try {
      const w = fs.watch(dir, { recursive: true }, (event, filename) => {
        if (filename && path.basename(String(filename))[0] === '.') return;
        clearTimeout(timer);
        timer = setTimeout(notify, delay);
      });
      w.on('error', stopWatching);
      watchers.push(w);
    } catch (e) {
      // recursive watching is not available on every platform
    }
  });

  watched = watchers.length ? key : '';
  return watchers.length > 0;
};
