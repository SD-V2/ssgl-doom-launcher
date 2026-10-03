// Remembers when SSGL saw each mod for the first time, so new arrivals can be
// marked "new" for a week. The very first run only records what is already
// there (nothing is marked), so the whole collection does not light up.
const KEY = 'ssgl.firstSeen';
const DAY = 24 * 60 * 60 * 1000;

export const RECENT_DAYS = 7;

export const trackFirstSeen = (mods, storage = window.localStorage) => {
  // the list is not loaded yet - do not mistake that for "everything is new"
  if (!mods.length) return new Set();

  let store = null;
  try {
    store = JSON.parse(storage.getItem(KEY));
  } catch (e) {}

  const firstRun = !store || typeof store !== 'object';
  if (firstRun) store = {};

  const now = Date.now();
  let changed = firstRun;
  mods.forEach(m => {
    if (!(m.id in store)) {
      store[m.id] = firstRun ? 0 : now;
      changed = true;
    }
  });

  if (changed) {
    try {
      storage.setItem(KEY, JSON.stringify(store));
    } catch (e) {}
  }

  const recent = new Set();
  mods.forEach(m => {
    const seen = store[m.id];
    if (seen > 0 && now - seen < RECENT_DAYS * DAY) recent.add(m.id);
  });
  return recent;
};
