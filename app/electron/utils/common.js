import { app } from 'electron';
import { mkdirSync, promises } from 'fs';
import { join, parse } from 'path';

const getDataFile = file => join(app.getPath('userData'), file);

// copies a file; true when it worked (a missing or locked file must not crash the app)
const copyfile = async (src, dest) => {
  try {
    await promises.copyFile(src, dest);
    return true;
  } catch (e) {
    console.log('copy failed: ' + src + ' -> ' + dest + ' (' + e.message + ')');
    return false;
  }
};

const createPath = targetDir => mkdirSync(targetDir, { recursive: true });

const getExt = str =>
  parse(str)
    .ext.toUpperCase()
    .substr(1);

export { getExt, getDataFile, copyfile, createPath };
