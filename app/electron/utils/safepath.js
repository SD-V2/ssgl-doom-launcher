import path from 'path';

// A folder name that is safe to create on Windows / macOS / Linux
export const cleanFolderName = name => {
  const clean = String(name === undefined || name === null ? '' : name).trim();
  if (!clean || clean === '.' || clean === '..') {
    throw new Error('Please type a folder name');
  }
  if (clean.length > 120) throw new Error('The folder name is too long');
  // eslint-disable-next-line no-control-regex
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(clean)) {
    throw new Error('A folder name cannot contain  \\ / : * ? " < > |');
  }
  if (/[. ]$/.test(clean)) {
    throw new Error('A folder name cannot end with a dot or a space');
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
