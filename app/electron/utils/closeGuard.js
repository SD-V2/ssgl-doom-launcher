import { dialog, ipcMain } from 'electron';

// The window tells us (message "app/dirty") whether the load order has unsaved
// changes. Closing SSGL then asks first. The texts come from the window, so they
// are in the language of the user.
export const installCloseGuard = (win, ipc = ipcMain, box = dialog) => {
  let unsaved = null;

  ipc.on('app/dirty', (e, data) => {
    unsaved = data && data.dirty ? data : null;
  });

  win.on('close', event => {
    if (!unsaved || !unsaved.labels) return;

    const choice = box.showMessageBoxSync(win, {
      type: 'warning',
      buttons: [unsaved.labels.discard, unsaved.labels.cancel],
      defaultId: 1,
      cancelId: 1,
      message: unsaved.labels.message,
      detail: unsaved.labels.detail
    });

    if (choice !== 0) event.preventDefault();
  });
};
