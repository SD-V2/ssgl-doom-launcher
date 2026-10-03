// Sizes of the mod collection per folder.
// node = { name, bytes, count, ownBytes, ownCount, children: Map, items: [] }
// bytes / count include all subfolders, own* only the mods directly inside.

const newNode = name => ({
  name,
  bytes: 0,
  count: 0,
  ownBytes: 0,
  ownCount: 0,
  children: new Map(),
  items: []
});

export const buildUsageTree = mods => {
  const root = newNode('');

  mods.forEach(mod => {
    const size = mod.bytes || 0;
    const parts = mod.folders || (mod.folder ? [mod.folder] : []);
    let node = root;
    node.bytes += size;
    node.count += 1;

    parts.forEach(name => {
      if (!node.children.has(name)) node.children.set(name, newNode(name));
      node = node.children.get(name);
      node.bytes += size;
      node.count += 1;
    });

    node.ownBytes += size;
    node.ownCount += 1;
    node.items.push(mod);
  });

  return root;
};

export const nodeAt = (root, path) => {
  let node = root;
  for (let i = 0; i < path.length; i++) {
    node = node.children.get(path[i]);
    if (!node) return null;
  }
  return node;
};

// rows for the bars of one folder level, biggest first
export const usageRows = node => {
  const rows = Array.from(node.children.values()).map(child => ({
    name: child.name,
    bytes: child.bytes,
    count: child.count,
    own: false,
    open: child.children.size > 0 || child.items.length > 0
  }));

  // mods lying directly in this folder (not in a subfolder)
  if (node.ownCount > 0) {
    rows.push({
      name: '',
      bytes: node.ownBytes,
      count: node.ownCount,
      own: true,
      open: false
    });
  }

  return rows.sort((a, b) => b.bytes - a.bytes);
};

// biggest single mods in a folder, subfolders included
export const biggestMods = (node, limit = 10) => {
  const all = [];
  const walk = n => {
    n.items.forEach(m => all.push(m));
    n.children.forEach(walk);
  };
  walk(node);
  return all.sort((a, b) => (b.bytes || 0) - (a.bytes || 0)).slice(0, limit);
};

// space the extra copies of exact duplicates take
export const duplicateWaste = duplicates =>
  duplicates.reduce(
    (sum, d) => sum + Math.max(0, d.paths.length - 1) * (d.bytes || 0),
    0
  );
