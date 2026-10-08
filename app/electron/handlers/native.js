import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';

import { remember, startIn } from '../utils/lastFolder';

// Things the screens ask the main part of the program to do (they used the old
// "remote" module for this, which Electron removed). See client/utils/native.js.

ipcMain.handle('native/openExternal', (e, url) => shell.openExternal(url));
ipcMain.handle('native/showItemInFolder', (e, file) => shell.showItemInFolder(file));
ipcMain.handle('native/openPath', (e, file) => shell.openPath(file));

// to the Recycle Bin: true when it worked
ipcMain.handle('native/trashItem', (e, file) =>
  shell.trashItem(file).then(
    () => true,
    () => false
  )
);

ipcMain.handle('native/showOpenDialog', async (e, options) => {
  const res = await dialog.showOpenDialog({ ...options, defaultPath: startIn(options && options.defaultPath) });
  if (!res.canceled && res.filePaths && res.filePaths[0]) {
    remember(res.filePaths[0], (options.properties || []).indexOf('openDirectory') > -1);
  }
  return res;
});

ipcMain.on('native/appVersion', e => {
  e.returnValue = app.getVersion();
});

// A right-click menu. The screen sends the menu without its click functions (they cannot
// be sent); every clickable item has a number "clickId". The answer is the number of the
// item that was clicked, or null when the menu was closed without a choice.
const toMenu = (items, choose) =>
  items.map(({ clickId, submenu, ...item }) => ({
    ...item,
    ...(submenu ? { submenu: toMenu(submenu, choose) } : {}),
    ...(clickId !== undefined ? { click: () => choose(clickId) } : {})
  }));

ipcMain.handle(
  'native/popupMenu',
  (e, template) =>
    new Promise(resolve => {
      let done = false;
      const choose = id => {
        if (done) return;
        done = true;
        resolve(id);
      };
      Menu.buildFromTemplate(toMenu(template, choose)).popup({
        window: BrowserWindow.fromWebContents(e.sender) || undefined,
        // the menu closes just before the click is reported: wait a moment
        callback: () => setTimeout(() => choose(null), 150)
      });
    })
);
