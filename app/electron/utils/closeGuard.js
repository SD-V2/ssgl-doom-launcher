import { ipcMain } from 'electron';

// The window tells us (message "app/dirty") whether the load order has unsaved
// changes. Closing SSGL then does not close it at once: the window is asked to show
// its own question (in the look of SSGL). Only when you confirm there
// ("app/close-confirmed") SSGL really closes.
export const installCloseGuard = (win, ipc = ipcMain) => {
  let unsaved = false;
  let allowClose = false;

  ipc.on('app/dirty', (e, data) => {
    unsaved = !!(data && data.dirty);
  });

  ipc.on('app/close-confirmed', () => {
    allowClose = true;
    if (!win.isDestroyed()) win.close();
  });

  win.on('close', event => {
    if (allowClose || !unsaved) return;

    event.preventDefault();
    // closed from the taskbar while minimized: bring it back so the question is seen
    if (win.isMinimized()) win.restore();
    win.focus();
    win.webContents.send('app/close-request');
  });

  // a window that crashed or hangs cannot answer, it must not keep SSGL open
  // ('render-process-gone': the old 'crashed' event was removed in Electron 29)
  win.webContents.on('render-process-gone', () => {
    unsaved = false;
  });
  win.on('unresponsive', () => {
    unsaved = false;
  });
};
