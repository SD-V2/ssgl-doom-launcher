import { ipcRenderer } from 'electron';
import { useContext, useEffect, useRef } from 'react';

import { StoreContext } from '../../state';
import { useHashLocation, useToast, useTranslation } from '../../utils';
import { formatBytes, modNameOf } from '../../utils/upscale';
import { useDialog } from '../Dialog';

// "Show in mod list": read the mod folder again, tick the new mod (so it is in the
// load order, in its section) and go to the mod list.
export const useShowNewMod = () => {
  const { gstate, dispatch } = useContext(StoreContext);
  // eslint-disable-next-line no-unused-vars
  const [loc, navigate] = useHashLocation();
  const latest = useRef(gstate);
  latest.current = gstate;
  return async file => {
    try {
      const res = await ipcRenderer.invoke('main/init');
      if (res && !res.error && res.data) dispatch({ type: 'mods/refresh', data: res.data });
      const mods = res && res.data && res.data.mods ? res.data.mods : latest.current.mods;
      const mod = mods.find(m => m.path === file);
      const inOrder = latest.current.package.selected.indexOf(mod ? mod.id : '') > -1;
      if (mod && !inOrder) dispatch({ type: 'mod/select', id: mod.id });
    } catch (e) {
      // the list is read again by itself later
    }
    navigate('/');
  };
};

// Watches the upscale that runs in the background (on every screen): a message when
// it is finished, a short note when it pauses for a game.
const Watcher = () => {
  const { t } = useTranslation(['tools', 'common']);
  const [toast] = useToast();
  const dialog = useDialog();
  const showNewMod = useShowNewMod();
  const told = useRef({});
  const show = useRef(showNewMod);
  show.current = showNewMod;

  useEffect(() => {
    const onProgress = async (e, state) => {
      if (!state) return;
      if (state.phase === 'paused' && state.pausedReason === 'game') {
        if (!told.current.paused) toast('ok', t('tools:toastPaused'), t('tools:paused'));
        told.current.paused = true;
        return;
      }
      told.current.paused = false;
      if (state.phase === 'done' && state.result && told.current.done !== state.result.file) {
        told.current.done = state.result.file;
        const name = modNameOf(state.result.file);
        toast('ok', t('tools:doneTitle'), t('tools:toastDone', { name }));
        const lines = [
          t('tools:donePictures', { n: state.result.images }),
          t('tools:doneSize', { size: formatBytes(state.result.bytes) }),
          t('tools:doneWhere', { file: state.result.file })
        ];
        if (state.result.skipped && state.result.skipped.length) {
          lines.push(t('tools:doneSkipped', { n: state.result.skipped.length }));
        }
        const go = await dialog.confirm({
          title: t('tools:doneTitle'),
          message: t('tools:doneMessage', { name }),
          lines,
          confirmText: t('tools:showInList'),
          cancelText: t('common:close'),
          wide: true
        });
        if (go) show.current(state.result.file);
      }
      if (state.phase === 'error' && state.error && told.current.error !== state.startedAt) {
        told.current.error = state.startedAt;
        toast('danger', t('tools:errorTitle'), t('tools:errors.' + state.error.code, { defaultValue: t('tools:errors.failed') }));
      }
    };
    ipcRenderer.on('upscaler/progress', onProgress);
    return () => ipcRenderer.removeListener('upscaler/progress', onProgress);
  }, []);

  return null;
};

export default Watcher;
