const natural = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const newNode = name => ({ name, children: new Map(), items: [] });

const countMods = node =>
  node.items.length +
  Array.from(node.children.values()).reduce((n, c) => n + countMods(c), 0);

const countActive = node =>
  node.items.filter(i => i.active).length +
  Array.from(node.children.values()).reduce((n, c) => n + countActive(c), 0);

// Turns a flat mod list into rows for the virtual list:
//   { type: 'folder', key, folder, depth, count, active, open }
//   { type: 'mod', item, depth }
// Folders can be nested; key is the full path ("1_BP/sub"). Inside a folder the
// subfolders come first, then the mods. Mods without any folder come last.
// forceOpen = show everything expanded (used while searching).
const groupByFolder = (data, openFolders = [], forceOpen = false) => {
  const root = newNode('');

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
      active: root.items.filter(i => i.active).length,
      open
    });
    if (open) {
      sortedItems(root).forEach(item => rows.push({ type: 'mod', item, depth: 1 }));
    }
  }

  return { rows, folders };
};

export default groupByFolder;
