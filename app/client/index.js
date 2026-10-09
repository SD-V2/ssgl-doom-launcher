import './global.css';

import { ipcRenderer } from 'electron';
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ThemeProvider } from 'styled-components';

import { Body, Head, Routes, ToastContainer } from './components';
import { CheckingLine, LoadingScreen, savedCount, savedLook, saveLook } from './components/Startup';
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
import { effectsOf } from './Theme/CursorTrail';
import useStartup from './utils/useStartup';
import { useWallpaper } from './utils/wallpaper';
import { useHashLocation } from './utils';
import { afterPaint, startupMark } from './utils/startup';

startupMark('scriptRun');

const App = () => {
  const [gstate, dispatch] = useReducer(reducer, initState);
  useEffect(() => {
    startupMark('firstRender');
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => startupMark('fontsLoaded'));
  }, []);

  // colors (color theme) + shapes, fonts and effects (interface style). Before the
  // settings are read, the look of the last start is used (no flash of other colours).
  // eslint-disable-next-line no-unused-vars
  const [location, navigate] = useHashLocation();
  const notifier = useRef('beta');
  // the start: the list of the last start at once, then checked in the background
  const { ready, checking } = useStartup({
    dispatch,
    onLoaded: data => {
      i18n.changeLanguage(data.settings.language || 'en');
      navigate(data.settings.startView || '/');
      notifier.current = data.settings.notifyRelease;
    },
    onFailed: () => navigate('/settings')
  });

  const look = ready ? gstate.settings : { ...gstate.settings, ...savedLook() };
  const activeTheme = useMemo(
    () =>
      applyStyle(
        look.theme === 'custom' ? customTheme(look.accent) : themes[look.theme] || themes.hell,
        look.style
      ),
    [look.theme, look.accent, look.style]
  );
  useEffect(() => {
    if (ready) saveLook({ theme: gstate.settings.theme, accent: gstate.settings.accent, style: gstate.settings.style, active: activeTheme.color.active });
  }, [ready, activeTheme]);
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
  // not during the start: a few seconds after the list is on the screen
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!settled || !gstate.mods.length || !gstate.packages.length) return;

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
  }, [settled, gstate.mods, gstate.packages]);

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


  const openNotifier = state =>
    isVisible(state.settings.notifyRelease, state.update);

  // The update notice: at the start, and again when you come back to SSGL (after you
  // uploaded something to GitHub), but not more than once in 10 minutes.
  const lastCheck = useRef(0);
  const announced = useRef('');
  const settledRef = useRef(false);
  settledRef.current = settled;
  const checkForUpdate = async () => {
    // not during the start (the window gets the focus while it opens)
    if (!settledRef.current) return;
    if (!canCheck(notifier.current, lastCheck.current, Date.now())) return;
    lastCheck.current = Date.now();
    startupMark('updateCheck');
    try {
      const res = await ipcRenderer.invoke('main/checkupdate');
      if (res.error) throw new Error(res.error);
      const update = res.data;
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

  // after the start: the update check and the quieter jobs
  useEffect(() => {
    if (!ready) return undefined;
    const timer = setTimeout(() => {
      setSettled(true);
      checkForUpdate();
    }, 2500);
    return () => clearTimeout(timer);
  }, [ready]);

  const wall = useWallpaper(ready ? gstate.settings.background : null, settled);

  // the real screen (mod list or Settings) is on the screen: SSGL can be used
  const initDone = useRef(false);
  useEffect(() => {
    if (!ready || !initDone.current && !gstate.settings.savepath) return;
    if (!initDone.current && gstate.settings.savepath) {
      initDone.current = true;
      afterPaint(() => startupMark('usable', { mods: gstate.mods.length }));
    }
  }, [ready, gstate.settings.savepath]);

  return (
    <StoreContext.Provider value={{ gstate, dispatch }}>
      <AudioProvider>
        <ThemeProvider theme={activeTheme}>
          <>
          <StyleLayer style={gstate.settings.style} {...effectsOf(gstate.settings)} />
          <DialogProvider>
          <ToastContainer>
            <PackageTransfer />
            <UnsavedGuard />
            {!ready ? (
              <LoadingScreen count={savedCount()} />
            ) : (
              <Body
                background={wall.src}
                ready={wall.ready}
                dim={gstate.settings.wallpaperDim}
                blur={gstate.settings.wallpaperBlur}
                fit={gstate.settings.wallpaperFit}
              >
                {checking ? <CheckingLine /> : null}
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
