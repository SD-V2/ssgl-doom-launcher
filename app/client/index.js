import './global.css';

import { ipcRenderer } from 'electron';
import React, { useEffect, useMemo, useReducer, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ThemeProvider } from 'styled-components';

import { Body, Head, MainLoader, Routes, ToastContainer } from './components';
import AudioProvider from './components/Audio';
import { DialogProvider } from './components/Dialog';
import PackageTransfer from './components/PackageTransfer';
import UnsavedGuard from './components/UnsavedGuard';
import { isDismissed } from './utils/dismissed';
import { canCheck, isVisible, noticeKey, shouldAnnounce } from './utils/updateNotice';
import { rememberUpdates } from './utils/fixes';
import Update from './components/Update';
import i18n from './i18n';
import { initState, reducer, StoreContext } from './state';
import themes, { customTheme } from './Theme';
import { applyStyle, StyleLayer } from './Theme/styles';
import { useIpc } from './utils';
import { useHashLocation } from './utils';

const App = () => {
  const [gstate, dispatch] = useReducer(reducer, initState);

  // colors (color theme) + shapes, fonts and effects (interface style)
  const activeTheme = useMemo(
    () =>
      applyStyle(
        gstate.settings.theme === 'custom'
          ? customTheme(gstate.settings.accent)
          : themes[gstate.settings.theme] || themes.hell,
        gstate.settings.style
      ),
    [gstate.settings.theme, gstate.settings.accent, gstate.settings.style]
  );
  // sections: which folder / mod was put into which section, and the view mode.
  // Loaded once at the start, saved whenever they change.
  useEffect(() => {
    let rules = {};
    let mode = false;
    try {
      rules = JSON.parse(localStorage.getItem('ssgl.sectionRules')) || {};
      mode = localStorage.getItem('ssgl.loadView') === 'sections';
    } catch (e) {
      // start without rules
    }
    dispatch({ type: 'sections/load', rules, mode });
  }, []);
  // not on the first run: that would save the empty start values over the saved ones
  const sectionsFirstRun = useRef(true);
  useEffect(() => {
    if (sectionsFirstRun.current) {
      sectionsFirstRun.current = false;
      return;
    }
    try {
      localStorage.setItem('ssgl.sectionRules', JSON.stringify(gstate.sectionRules));
      localStorage.setItem('ssgl.loadView', gstate.sectionMode ? 'sections' : 'list');
    } catch (e) {
      // not saved this time
    }
  }, [gstate.sectionRules, gstate.sectionMode]);

  // packages learn the readable names of their mods, so an updated mod
  // (new file size = new id) can be recognised later
  const rememberTried = useRef(new Set());
  useEffect(() => {
    if (!gstate.mods.length || !gstate.packages.length) return;

    const updates = rememberUpdates(gstate.packages, gstate.mods)
      .map(u => {
        const modNames = {};
        Object.keys(u.modNames).forEach(id => {
          if (!rememberTried.current.has(`${u.id}:${id}`)) modNames[id] = u.modNames[id];
        });
        return { id: u.id, modNames };
      })
      .filter(u => Object.keys(u.modNames).length);

    if (!updates.length) return;
    updates.forEach(u =>
      Object.keys(u.modNames).forEach(id => rememberTried.current.add(`${u.id}:${id}`))
    );

    ipcRenderer
      .invoke('packages/remember', { updates })
      .then(res => {
        if (!res.error) dispatch({ type: 'packages/set', packages: res.data.packages });
      })
      .catch(() => {});
  }, [gstate.mods, gstate.packages]);

  const settingsRef = useRef(gstate.settings);
  settingsRef.current = gstate.settings;

  // The WAD directory changed on disk: re-scan quietly, the load order stays
  useEffect(() => {
    const onChanged = async () => {
      const auto = settingsRef.current.autoRefresh;
      if (auto === false || auto === '') return;
      try {
        const res = await ipcRenderer.invoke('main/init');
        if (!res.error) dispatch({ type: 'mods/refresh', data: res.data });
      } catch (e) {}
    };
    ipcRenderer.on('mods/changed', onChanged);
    return () => ipcRenderer.removeListener('mods/changed', onChanged);
  }, []);

  const [fetch, loading] = useIpc({ delayLoad: 1000 });
  // eslint-disable-next-line no-unused-vars
  const [location, navigate] = useHashLocation();

  const openNotifier = state =>
    isVisible(state.settings.notifyRelease, state.update);

  // The update notice: at the start, and again when you come back to SSGL (after you
  // uploaded something to GitHub), but not more than once in 10 minutes.
  const notifier = useRef('beta');
  const lastCheck = useRef(0);
  const announced = useRef('');
  const checkForUpdate = async () => {
    if (!canCheck(notifier.current, lastCheck.current, Date.now())) return;
    lastCheck.current = Date.now();
    try {
      const update = await fetch('main/checkupdate');
      if (!shouldAnnounce(update, announced.current, isDismissed)) return;
      announced.current = noticeKey(update);
      dispatch({ type: 'update/set', data: update, done: false });
    } catch (e) {
      console.log(e);
    }
  };
  useEffect(() => {
    notifier.current = gstate.settings.notifyRelease;
  }, [gstate.settings.notifyRelease]);
  useEffect(() => {
    window.addEventListener('focus', checkForUpdate);
    return () => window.removeEventListener('focus', checkForUpdate);
  }, []);

  useEffect(() => {
    async function resolve() {
      try {
        const data = await fetch('main/init');
        dispatch({ type: 'main/init', data: data });
        i18n.changeLanguage(data.settings.language || 'en');
        navigate(data.settings.startView || '/');
        //navigate('/settings');
        notifier.current = data.settings.notifyRelease;
        checkForUpdate();
      } catch (e) {
        navigate('/settings');
      }
    }
    resolve();
  }, []);

  return (
    <StoreContext.Provider value={{ gstate, dispatch }}>
      <AudioProvider>
        <ThemeProvider theme={activeTheme}>
          <>
          <StyleLayer style={gstate.settings.style} />
          <DialogProvider>
          <ToastContainer>
            <PackageTransfer />
            <UnsavedGuard />
            {loading ? (
              <MainLoader />
            ) : (
              <Body
                background={gstate.settings.background}
                dim={gstate.settings.wallpaperDim}
                blur={gstate.settings.wallpaperBlur}
                fit={gstate.settings.wallpaperFit}
              >
                {openNotifier(gstate) ? <Update /> : null}
                <Head />
                <Routes />
              </Body>
            )}
          </ToastContainer>
          </DialogProvider>
          </>
        </ThemeProvider>
      </AudioProvider>
    </StoreContext.Provider>
  );
};

ReactDOM.render(<App />, document.getElementById('app'));

if (module && module.hot) {
  module.hot.accept();
}
