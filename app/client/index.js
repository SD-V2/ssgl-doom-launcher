import './global.css';

import { ipcRenderer } from 'electron';
import React, { useEffect, useMemo, useReducer, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ThemeProvider } from 'styled-components';

import { Body, Head, MainLoader, Routes, ToastContainer } from './components';
import AudioProvider from './components/Audio';
import Update from './components/Update';
import i18n from './i18n';
import { initState, reducer, StoreContext } from './state';
import themes, { customTheme } from './Theme';
import { useIpc } from './utils';
import { useHashLocation } from './utils';

const App = () => {
  const [gstate, dispatch] = useReducer(reducer, initState);

  const activeTheme = useMemo(
    () =>
      gstate.settings.theme === 'custom'
        ? customTheme(gstate.settings.accent)
        : themes[gstate.settings.theme] || themes.hell,
    [gstate.settings.theme, gstate.settings.accent]
  );
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

  const openNotifier = state => {
    if (state.update.available) {
      if (
        state.settings.notifyRelease === 'stable' &&
        state.update.prerelease === true
      ) {
        return false;
      }
      return true;
    }

    return false;
  };

  useEffect(() => {
    async function resolve() {
      try {
        const data = await fetch('main/init');
        dispatch({ type: 'main/init', data: data });
        i18n.changeLanguage(data.settings.language || 'en');
        navigate(data.settings.startView || '/');
        //navigate('/settings');
        if (data.settings.notifyRelease !== 'off') {
          try {
            const update = await fetch('main/checkupdate');
            dispatch({ type: 'update/set', data: update, done: false });
          } catch (e) {
            console.log(e);
          }
        }
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
          <ToastContainer>
            {loading ? (
              <MainLoader />
            ) : (
              <Body background={gstate.settings.background}>
                {openNotifier(gstate) ? <Update /> : null}
                <Head />
                <Routes />
              </Body>
            )}
          </ToastContainer>
        </ThemeProvider>
      </AudioProvider>
    </StoreContext.Provider>
  );
};

ReactDOM.render(<App />, document.getElementById('app'));

if (module && module.hot) {
  module.hot.accept();
}
