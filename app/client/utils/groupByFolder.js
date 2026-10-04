const natural = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const newNode = name => ({ name, children: new Map(), items: [] });

const countMods = node =>
  node.items.length +
  Array.from(node.children.values()).reduce((n, c) => n + countMods(c), 0);

const countBytes = node =>
  node.items.reduce((n, i) => n + (i.bytes || 0), 0) +
  Array.from(node.children.values()).reduce((n, c) => n + countBytes(c), 0);

const countActive = node =>
  node.items.filter(i => i.active).length +
  Array.from(node.children.values()).reduce((n, c) => n + countActive(c), 0);

// Turns a flat mod list into rows for the virtual list:
//   { type: 'folder', key, folder, depth, count, active, open }
//   { type: 'mod', item, depth }
// Folders can be nested; key is the full path ("1_BP/sub"). Inside a folder the
// subfolders come first, then the mods. Mods without any folder come last.
// forceOpen = show everything expanded (used while searching).
const groupByFolder = (
  data,
  openFolders = [],
  forceOpen = false,
  allFolders = []
) => {
  const root = newNode('');

  // folders without any mod (new ones) - hidden while searching
  if (!forceOpen) {
    allFolders.forEach(parts => {
      let node = root;
      parts.forEach(name => {
        if (!node.children.has(name)) node.children.set(name, newNode(name));
        node = node.children.get(name);
      });
    });
  }

  data.forEach(item => {
    const parts = item.folders || (item.folder ? [item.folder] : []);
    let node = root;
    parts.forEach(name => {
      if (!node.children.has(name)) node.children.set(name, newNode(name));
      node = node.children.get(name);
    });
    node.items.push(item);
  });

  const rows = [];
  const folders = [];
  const isOpen = key => forceOpen || openFolders.indexOf(key) > -1;
  const sortedNames = node => Array.from(node.children.keys()).sort(natural);
  const sortedItems = node => node.items.sort((a, b) => natural(a.name, b.name));

  const collect = (node, parentKey) =>
    sortedNames(node).forEach(name => {
      const key = parentKey ? `${parentKey}/${name}` : name;
      folders.push(key);
      collect(node.children.get(name), key);
    });

  const walk = (node, parentKey, depth) =>
    sortedNames(node).forEach(name => {
      const child = node.children.get(name);
      const key = parentKey ? `${parentKey}/${name}` : name;
      const open = isOpen(key);

      rows.push({
        type: 'folder',
        key,
        folder: name,
        depth,
        count: countMods(child),
        bytes: countBytes(child),
        active: countActive(child),
        open
      });

      if (open) {
        walk(child, key, depth + 1);
        sortedItems(child).forEach(item =>
          rows.push({ type: 'mod', item, depth: depth + 1 })
        );
      }
    });

  collect(root, '');
  walk(root, '', 0);

  // loose mods that are not in any folder
  if (root.items.length) {
    const open = isOpen('');
    folders.push('');
    rows.push({
      type: 'folder',
      key: '',
      folder: '',
      depth: 0,
      count: root.items.length,
      bytes: root.items.reduce((n, i) => n + (i.bytes || 0), 0),
      active: root.items.filter(i => i.active).length,
      open
    });
    if (open) {
      sortedItems(root).forEach(item => rows.push({ type: 'mod', item, depth: 1 }));
    }
  }

  return { rows, folders };
};

// All mods inside a folder (subfolders included) in the order they are shown
export const modsInFolder = (data, folderKey) => {
  const { rows } = groupByFolder(data, [], true);
  const start = rows.findIndex(r => r.type === 'folder' && r.key === folderKey);
  if (start < 0) return [];

  const depth = rows[start].depth;
  const found = [];
  for (let i = start + 1; i < rows.length; i++) {
    if (rows[i].depth <= depth) break;
    if (rows[i].type === 'mod') found.push(rows[i].item);
  }
  return found;
};

// Arranges mod ids by folder (1_BP before 2_X, subfolders before the loose
// mods of their parent, mods without a folder last). Inside the same folder the
// existing order is kept, so manual fine tuning survives. Unknown ids go last.
export const sortByFolder = (ids, mods) => {
  const byId = new Map(mods.map(m => [m.id, m]));
  const pathOf = id => {
    const m = byId.get(id);
    return m ? m.folders || (m.folder ? [m.folder] : []) : null;
  };

  const known = ids
    .map((id, index) => ({ id, index, path: pathOf(id) }))
    .filter(i => i.path !== null);
  const unknown = ids.filter(id => pathOf(id) === null);

  known.sort((a, b) => {
    const n = Math.min(a.path.length, b.path.length);
    for (let i = 0; i < n; i++) {
      const c = natural(a.path[i], b.path[i]);
      if (c !== 0) return c;
    }
    return b.path.length - a.path.length || a.index - b.index;
  });

  return [...known.map(i => i.id), ...unknown];
};

export default groupByFolder;
