/* eslint-disable no-case-declarations */
import { act } from './middlewares';

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
    volume: 0.5
  }
};

export function reducer(state, action) {
  switch (action.type) {
    case 'main/init':
      return act({
        ...state,
        ...action.data,
        settings: {
          ...initState.settings,
          ...action.data.settings
        },
        package: initState.package
      });

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
