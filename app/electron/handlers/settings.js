import { ipcMain } from 'electron';

import createMenu from '../menu';
import ERRORS from '../utils/errors';
import { setJSON } from '../utils/json';

ipcMain.handle('settings/save', async (e, data) => {
  try {
    const newSettings = await setJSON('settings', data);
    try {
      createMenu.refresh(newSettings.language);
    } catch (menuError) {
      // the menu stays as it was
    }
    return {
      data: newSettings,
      error: null
    };
  } catch (e) {
    return ERRORS.JSON_WRITE;
  }
});
