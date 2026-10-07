/* eslint-disable no-case-declarations */
import { act } from './middlewares';

import {
  isSectionSorted,
  resolveSection,
  sortBySections
} from '../utils/sections';

export const move = (data, from, to) => {
  const array = data.slice();
  array.splice(to < 0 ? array.length + to : to, 0, array.splice(from, 1)[0]);
  return array;
};

export const initState = {
  iwads: [],
  mods: [],
  duplicates: [],
  versions: [],
  folders: [],
  mapFolders: [],
  recovered: [],
  sectionMode: false,
  sectionRules: { folders: {}, mods: {} },
  update: {
    available: false,
    download: null,
    version: null,
    date: null,
    prerelease: null,
    changelog: null
  },
  package: {
    datapath: '',
    id: null,
    sourceport: '',
    iwad: '',
    cover: '',
    name: '',
    selected: []
  },
  packages: [],
  sourceports: [],
  settings: {
    soundActive: false,
    soundDrawer: '',
    soundStart: '',
    soundModSelect: '',
    soundToastSuccess: '',
    soundToastError: '',
    notifyRelease: 'beta',
    obligeActive: false,
    obligeBinary: '',
    obligeConfigPath: '',
    theme: 'hell',
    startView: '/',
    language: 'en',
    defaultsourceport: '',
    modpath: '',
    savepath: '',
    background: '',
    autoRefresh: true,
    compactList: false,
    importFolder: '',
    mappath: '',
    updateRepo: 'SD-V2/ssgl-doom-launcher',
    wallpaperDim: 0,
    wallpaperBlur: 0,
    hideWhilePlaying: false,
    volume: 0.5
  }
};

function baseReducer(state, action) {
  switch (action.type) {
    case 'main/init': {
      // a load order you are working on stays when the data is loaded again
      // (for example after saving the settings)
      const working = new Set(state.package.selected);
      return act({
        ...state,
        ...action.data,
        settings: {
          ...initState.settings,
          ...action.data.settings
        },
        mods: (action.data.mods || state.mods).map(m =>
          working.has(m.id) ? { ...m, active: true } : m
        ),
        package: state.package
      });
    }

    case 'settings/preview':
      // shown at once while a slider is moved, not saved
      return act({ ...state, settings: { ...state.settings, ...action.data } });

    case 'recovered/clear':
      return act({ ...state, recovered: [] });

    case 'update/done':
      return act({
        ...state,
        update: {
          ...state.update,
          available: false
        }
      });

    case 'update/set':
      return act({
        ...state,
        update: action.data
      });

    case 'sourceports/save':
      return act({
        ...state,
        sourceports: action.data
      });

    case 'settings/save':
      return act({
        ...state,
        settings: action.data
      });

    case 'packages/delete':
      return act({
        ...state,
        package: initState.package,
        packages: action.packages,
        mods: state.mods.map(mod => ({ ...mod, active: false }))
      });

    case 'packages/reset':
      return act({
        ...state,
        package: initState.package,
        mods: state.mods.map(mod => ({ ...mod, active: false }))
      });

    case 'packages/select':
      const pack = state.packages.find(pack => pack.id === action.id);

      const mods = state.mods.map(mod => {
        if (pack.selected.findIndex(item => mod.id === item) > -1) {
          return {
            ...mod,
            active: true
          };
        } else {
          return {
            ...mod,
            active: false
          };
        }
      });

      return act({
        ...state,
        mods: mods,
        package: {
          ...pack,
          selected: pack.selected
        }
      });

    case 'packages/set':
      return act({ ...state, packages: action.packages });

    case 'packages/save':
      return act({
        ...state,
        packages: action.packages,
        package: action.package || initState.package,
        mods: action.package
          ? state.mods
          : state.mods.map(mod => ({ ...mod, active: false }))
      });

    case 'mod/move':
      const to =
        action.direction === 'up' ? action.index - 1 : action.index + 1;

      return act({
        ...state,
        package: {
          ...state.package,
          selected: move(state.package.selected, action.index, to)
        }
      });

    case 'mod/reorder':
      return act({
        ...state,
        package: {
          ...state.package,
          selected: move(state.package.selected, action.from, action.to)
        }
      });

    case 'mod/select':
      const newItem = state.mods.find(item => action.id === item.id);

      if (!newItem) {
        return act({
          ...state,
          package: {
            ...state.package,
            selected: state.package.selected.filter(i => i !== action.id)
          }
        });
      }

      const selected = newItem.active
        ? state.package.selected.filter(i => i !== action.id)
        : [...state.package.selected, action.id];

      newItem.active = !newItem.active;

      return act({
        ...state,
        package: {
          ...state.package,
          selected: selected
        },
        mods: state.mods.map(item => (item.id === action.id ? newItem : item))
      });

    case 'mods/drop': {
      // mods dropped from the file manager: add unknown ones to the list and
      // append everything to the load order of the current package
      const knownIds = new Set(state.mods.map(m => m.id));
      const fresh = action.mods.filter(m => !knownIds.has(m.id));
      const already = new Set(state.package.selected);
      const append = action.ids.filter(
        (id, i, arr) => !already.has(id) && arr.indexOf(id) === i
      );
      const appendSet = new Set(append);

      return act({
        ...state,
        mods: [...state.mods, ...fresh].map(m =>
          appendSet.has(m.id) ? { ...m, active: true } : m
        ),
        package: {
          ...state.package,
          selected: [...state.package.selected, ...append]
        }
      });
    }

    case 'mods/refresh': {
      // re-scan result that keeps the current package / load order
      const inOrder = new Set(state.package.selected);
      return act({
        ...state,
        iwads: action.data.iwads,
        duplicates: action.data.duplicates || [],
        versions: action.data.versions || [],
        folders: action.data.folders || state.folders,
        mapFolders: action.data.mapFolders || state.mapFolders,
        mods: action.data.mods.map(m =>
          inOrder.has(m.id) ? { ...m, active: true } : m
        )
      });
    }

    case 'mod/insert': {
      // put a mod (dragged from the mod list) at a position of the load order;
      // index null = at the end. Already in the load order = moved there.
      const current = state.package.selected;
      const exists = current.indexOf(action.id) > -1;
      if (!exists && !state.mods.some(m => m.id === action.id)) return state;

      const without = current.filter(i => i !== action.id);
      let at = without.length;
      if (action.index !== null && action.index !== undefined) {
        const old = current.indexOf(action.id);
        at = old > -1 && old < action.index ? action.index - 1 : action.index;
      }
      at = Math.max(0, Math.min(at, without.length));
      const selected = [...without.slice(0, at), action.id, ...without.slice(at)];

      return act({
        ...state,
        mods: state.mods.map(m =>
          m.id === action.id ? { ...m, active: true } : m
        ),
        package: { ...state.package, selected }
      });
    }

    case 'mods/replaceIds': {
      // a mod was updated: its new id takes the place of the old one
      const swap = new Map(action.replacements.map(r => [r.from, r.to]));
      const selected = [];
      state.package.selected.forEach(id => {
        const next = swap.has(id) ? swap.get(id) : id;
        if (selected.indexOf(next) < 0) selected.push(next);
      });
      const inOrder = new Set(selected);
      return act({
        ...state,
        mods: state.mods.map(m => (inOrder.has(m.id) ? { ...m, active: true } : m)),
        package: { ...state.package, selected }
      });
    }

    case 'sections/load': {
      const rules = action.rules || {};
      return act({
        ...state,
        sectionMode: !!action.mode,
        sectionRules: { folders: rules.folders || {}, mods: rules.mods || {} }
      });
    }

    case 'sections/mode':
      return act({ ...state, sectionMode: !!action.on });

    case 'sections/normalize':
      return act({ ...state });

    case 'sections/assignFolder': {
      const folders = { ...state.sectionRules.folders };
      if (action.section && action.section !== 'auto') folders[action.key] = action.section;
      else delete folders[action.key];
      return act({ ...state, sectionRules: { ...state.sectionRules, folders } });
    }

    case 'sections/assignMod': {
      const mods = { ...state.sectionRules.mods };
      if (action.section && action.section !== 'auto') mods[action.id] = action.section;
      else delete mods[action.id];
      return act({ ...state, sectionRules: { ...state.sectionRules, mods } });
    }

    // drag a mod into a section (from another section, or from the mod list)
    case 'mod/toSection': {
      const mod = state.mods.find(m => m.id === action.id);
      if (!mod) return state;
      // maps only live in "maps", and nothing else goes into "maps"
      if (!!mod.isMap !== (action.section === 'maps')) return state;

      const mods = { ...state.sectionRules.mods };
      const automatic = resolveSection(mod, {
        folders: state.sectionRules.folders,
        mods: {}
      });
      if (action.section === automatic) delete mods[mod.id];
      else mods[mod.id] = action.section;

      const without = state.package.selected.filter(id => id !== action.id);
      const at = action.beforeId ? without.indexOf(action.beforeId) : -1;
      const selected =
        at > -1
          ? [...without.slice(0, at), action.id, ...without.slice(at)]
          : [...without, action.id];

      return act({
        ...state,
        sectionRules: { ...state.sectionRules, mods },
        mods: state.mods.map(m => (m.id === action.id ? { ...m, active: true } : m)),
        package: { ...state.package, selected }
      });
    }

    case 'mods/setOrder':
      return act({
        ...state,
        package: { ...state.package, selected: action.ids }
      });

    case 'mods/remove': {
      const gone = new Set(action.ids);
      return act({
        ...state,
        mods: state.mods.map(m => (gone.has(m.id) ? { ...m, active: false } : m)),
        package: {
          ...state.package,
          selected: state.package.selected.filter(i => !gone.has(i))
        }
      });
    }

    default:
      return initState;
  }
}

// ids of maps start with "map:" (see electron/constants.js)
export const isMapId = id => String(id).indexOf('map:') === 0;

// maps always load after the mods
export const mapsLast = selected => [
  ...selected.filter(id => !isMapId(id)),
  ...selected.filter(id => isMapId(id))
];

// everything that changes the load order keeps the maps at the end -
// and in the "sections" view all sections stay in their fixed order
const KEEP_ORDER = [
  'mod/move',
  'mod/reorder',
  'mod/select',
  'mods/drop',
  'mod/insert',
  'mods/replaceIds',
  'mods/setOrder',
  'mod/toSection',
  'sections/load',
  'sections/mode',
  'sections/normalize',
  'sections/assignFolder',
  'sections/assignMod'
];

export function reducer(state, action) {
  const next = baseReducer(state, action);
  if (next === state || KEEP_ORDER.indexOf(action.type) < 0) return next;

  const fixed = next.sectionMode
    ? sortBySections(next.package.selected, next.mods, next.sectionRules)
    : mapsLast(next.package.selected);
  const same =
    fixed.length === next.package.selected.length &&
    fixed.every((id, i) => id === next.package.selected[i]);

  return same
    ? next
    : { ...next, package: { ...next.package, selected: fixed } };
}

export { isSectionSorted };
