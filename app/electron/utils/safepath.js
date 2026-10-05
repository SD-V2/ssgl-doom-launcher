import path from 'path';

import { AppError } from './errors';

// A folder name that is safe to create on Windows / macOS / Linux
export const cleanFolderName = name => {
  const clean = String(name === undefined || name === null ? '' : name).trim();
  if (!clean) throw new AppError('E_NAME_EMPTY');
  if (clean === '.' || clean === '..') throw new AppError('E_NAME_END');
  if (clean.length > 120) throw new AppError('E_NAME_LONG');
  // eslint-disable-next-line no-control-regex
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(clean)) {
    throw new AppError('E_NAME_CHARS');
  }
  if (/[. ]$/.test(clean)) {
    throw new AppError('E_NAME_END');
  }
  return clean;
};

// "a/b" -> ['a','b'] (every part checked); '' -> []
export const splitFolderKey = key =>
  String(key || '')
    .split('/')
    .filter(part => part !== '')
    .map(cleanFolderName);

export const isInside = (dir, file) => {
  const rel = path.relative(path.resolve(dir), path.resolve(file));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

// folder setting like "1_BP/new" -> parts, or null when empty / not usable
export const importFolderParts = value => {
  try {
    const parts = String(value || '')
      .split(/[\\/]+/)
      .filter(part => part.trim() !== '')
      .slice(0, 6)
      .map(cleanFolderName);
    return parts.length ? parts : null;
  } catch (e) {
    return null;
  }
};
