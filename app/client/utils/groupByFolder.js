const natural = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

// Turns a flat mod list into rows for the virtual list:
//   { type: 'folder', folder, count, active, open }
//   { type: 'mod', item }
// Folders are in natural order (1_x, 2_x, 10_x), mods without a folder come last.
// forceOpen = show every folder expanded (used while searching).
const groupByFolder = (data, openFolders = [], forceOpen = false) => {
  const groups = new Map();

  data.forEach(item => {
    const key = item.folder || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  const folders = Array.from(groups.keys()).sort((a, b) => {
    if (a === '') return 1;
    if (b === '') return -1;
    return natural(a, b);
  });

  const rows = [];
  folders.forEach(folder => {
    const items = groups.get(folder).sort((a, b) => natural(a.name, b.name));
    const open = forceOpen || openFolders.indexOf(folder) > -1;

    rows.push({
      type: 'folder',
      folder,
      count: items.length,
      active: items.filter(i => i.active).length,
      open
    });

    if (open) {
      items.forEach(item => rows.push({ type: 'mod', item }));
    }
  });

  return { rows, folders };
};

export default groupByFolder;
