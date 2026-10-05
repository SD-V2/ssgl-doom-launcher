import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

import { AppError, toPayload } from '../utils/errors';
import { getJSON } from '../utils/json';
import {
  cleanFolderName,
  isInside,
  splitFolderKey
} from '../utils/safepath';

const getModPath = async () => {
  const settings = await getJSON('settings');
  if (!settings.modpath || settings.modpath.trim() === '') {
    throw new AppError('E_NO_WADDIR');
  }
  return settings.modpath;
};

const humanError = err => {
  if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') {
    return toPayload(new AppError('E_FS_DENIED'));
  }
  return toPayload(err);
};

// new folder inside `parent` ('' = top level of the WAD directory)
ipcMain.handle('folders/create', async (e, data) => {
  try {
    const modpath = await getModPath();
    const parent = splitFolderKey(data.parent);
    const name = cleanFolderName(data.name);
    const parentPath = path.join(modpath, ...parent);
    const target = path.join(parentPath, name);

    if (!isInside(modpath, target)) throw new AppError('E_OUTSIDE');
    if (!fs.existsSync(parentPath)) throw new AppError('E_PARENT_MISSING');
    if (fs.existsSync(target)) throw new AppError('E_FOLDER_EXISTS');

    fs.mkdirSync(target);
    return { data: { key: [...parent, name].join('/') }, error: null };
  } catch (err) {
    return { data: null, error: humanError(err) };
  }
});

// rename the last part of a folder key ("1_BP/old" -> "1_BP/new")
ipcMain.handle('folders/rename', async (e, data) => {
  try {
    const modpath = await getModPath();
    const parts = splitFolderKey(data.key);
    if (!parts.length) throw new AppError('E_PICK_FOLDER');

    const name = cleanFolderName(data.name);
    const from = path.join(modpath, ...parts);
    const to = path.join(modpath, ...parts.slice(0, -1), name);

    if (!isInside(modpath, from) || !isInside(modpath, to)) {
      throw new AppError('E_OUTSIDE');
    }
    if (!fs.existsSync(from)) throw new AppError('E_FOLDER_MISSING');

    const onlyCaseChanged = from.toLowerCase() === to.toLowerCase();
    if (!onlyCaseChanged && fs.existsSync(to)) {
      throw new AppError('E_FOLDER_EXISTS');
    }
    if (from === to) throw new AppError('E_SAME_NAME');

    fs.renameSync(from, to);
    return {
      data: { oldKey: parts.join('/'), key: [...parts.slice(0, -1), name].join('/') },
      error: null
    };
  } catch (err) {
    return { data: null, error: humanError(err) };
  }
});

// only works for an empty folder - rmdir refuses anything else
ipcMain.handle('folders/delete', async (e, data) => {
  try {
    const modpath = await getModPath();
    const parts = splitFolderKey(data.key);
    if (!parts.length) throw new AppError('E_PICK_FOLDER');

    const target = path.join(modpath, ...parts);
    if (!isInside(modpath, target)) throw new AppError('E_OUTSIDE');

    try {
      fs.rmdirSync(target);
    } catch (err) {
      if (err.code === 'ENOTEMPTY' || err.code === 'EEXIST') {
        throw new AppError('E_NOT_EMPTY');
      }
      throw err;
    }
    return { data: { key: parts.join('/') }, error: null };
  } catch (err) {
    return { data: null, error: humanError(err) };
  }
});
