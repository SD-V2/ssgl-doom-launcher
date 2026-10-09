import { ipcRenderer } from 'electron';
import { useEffect, useRef, useState } from 'react';

import { saveCount } from '../components/Startup';
import { startupMark } from './startup';

// The start of SSGL: the list of the last start comes at once (the main part keeps a
// library cache), the folders are checked in the background and what changed comes a
// moment later ("library/updated"). ready = the real screens can be shown,
// checking = the background check is still running (a thin line at the top).
//   onLoaded(data)  the settings and lists are in the state (language, start screen...)
//   onFailed()      nothing could be read (then Settings is shown)
const useStartup = ({ dispatch, onLoaded = () => {}, onFailed = () => {} }) => {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const callbacks = useRef({ onLoaded, onFailed });
  callbacks.current = { onLoaded, onFailed };

  useEffect(() => {
    let alive = true;
    const onUpdated = (e, data) => {
      if (!data || !data.mods) return;
      dispatch({ type: 'mods/refresh', data });
      saveCount(data.mods.length);
      setChecking(false);
    };
    const onChecked = () => setChecking(false);
    ipcRenderer.on('library/updated', onUpdated);
    ipcRenderer.on('library/checked', onChecked);
    (async () => {
      startupMark('initSent');
      let res = null;
      try {
        res = await ipcRenderer.invoke('main/init', { quick: true });
      } catch (e) {
        res = null;
      }
      if (!alive) return;
      startupMark('initAnswered', { fromCache: !!(res && res.data && res.data.fromCache) });
      if (!res || res.error || !res.data) {
        setReady(true);
        callbacks.current.onFailed();
        return;
      }
      const data = res.data;
      dispatch({ type: 'main/init', data });
      saveCount((data.mods || []).length);
      setChecking(!!data.fromCache);
      setReady(true);
      callbacks.current.onLoaded(data);
    })();
    return () => {
      alive = false;
      ipcRenderer.removeListener('library/updated', onUpdated);
      ipcRenderer.removeListener('library/checked', onChecked);
    };
  }, []);

  return { ready, checking };
};

export default useStartup;
