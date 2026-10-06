import fs from 'fs';

import { readContents } from './archive';

const PATCH_KINDS = ['DEH', 'BEX', 'BEH', 'CLD'];
const ARCHIVE_KINDS = ['PK3', 'ZIP'];

// Looks at one mod file and says whether it is OK. No game is started, nothing
// is unpacked: only the table of contents is read (cheap, even for huge files).
//   -> { status: 'ok' }
//   -> { status: 'unchecked', code }               cannot be tested here
//   -> { status: 'problem', code, detail? }
//   code: empty | damaged | notArchive | wrongType | unreadable | noFiles
const checkFile = (file, kind) => {
  let size;
  try {
    size = fs.statSync(file).size;
  } catch (err) {
    return { status: 'problem', code: 'unreadable' };
  }

  if (size === 0) return { status: 'problem', code: 'empty' };

  // text patches: nothing more to test than "is there something in it"
  if (PATCH_KINDS.indexOf(kind) > -1) return { status: 'ok' };

  try {
    const { type, entries } = readContents(file);

    if (type === 'zip' && entries.length === 0) {
      return { status: 'problem', code: 'noFiles' };
    }
    // a zip with another name than .pk3 / .zip, or a wad that is a zip: loadable
    if (type === 'zip' && kind === 'WAD') return { status: 'ok' };
    return { status: 'ok' };
  } catch (err) {
    if (err.code === 'unsupported') {
      const type = err.message.split(':')[1];
      // .pk7 / .7z / .rar are what they say they are
      if (['PK7', '7Z', 'RAR'].indexOf(kind) > -1) {
        return { status: 'unchecked', code: 'archive' };
      }
      if (type === '7z' || type === 'rar') {
        return { status: 'problem', code: 'wrongType', detail: type };
      }
      return { status: 'problem', code: 'notArchive' };
    }
    if (err.code === 'ENOENT' || err.code === 'EACCES' || err.code === 'EPERM' || err.code === 'EBUSY') {
      return { status: 'problem', code: 'unreadable' };
    }
    return { status: 'problem', code: 'damaged' };
  }
};

export { ARCHIVE_KINDS, checkFile };
