import { app, ipcMain } from 'electron';
import got from 'got';

import { getJSON } from '../utils/json';
import { walkWadDir } from '../utils/mods';
import { DEFAULT_UPDATE_REPO } from '../constants';
import { cleanRepo, findUpdate } from '../utils/versions';
import { watchModDir } from '../utils/watcher';

ipcMain.handle('main/checkupdate', async () => {
  const none = {
    available: false,
    download: null,
    version: null,
    date: null,
    prerelease: null,
    changelog: null
  };

  try {
    const settings = await getJSON('settings');
    // only the GitHub page named in the settings is asked, nothing by default
    const repo = cleanRepo(
      settings.updateRepo === undefined
        ? DEFAULT_UPDATE_REPO
        : settings.updateRepo
    );
    if (!repo) return { error: null, data: none };

    const releases = await got(
      `https://api.github.com/repos/${repo}/releases`
    ).json();

    const release = findUpdate(releases, app.getVersion(), {
      time: typeof __BUILD_TIME__ === 'undefined' ? '' : __BUILD_TIME__,
      commit: typeof __BUILD_COMMIT__ === 'undefined' ? '' : __BUILD_COMMIT__
    });

    return {
      error: null,
      data: release
        ? {
            available: true,
            download: release.html_url,
            version: release.tag_name,
            date: release.published_at,
            prerelease: release.prerelease,
            changelog: release.body
          }
        : none
    };
  } catch (e) {
    return {
      data: null,
      error: e.message
    };
  }
});

ipcMain.handle('main/init', async () => {
  try {
    const settings = await getJSON('settings');
    const sourceports = (await getJSON('sourceports')) || [];
    const packages = (await getJSON('packages')) || [];

    try {
      const walkedFiles = await walkWadDir(settings.modpath);
      watchModDir(settings.modpath);
      return {
        error: null,
        data: {
          ...walkedFiles,
          sourceports: sourceports,
          settings: settings,
          packages: packages
        }
      };
    } catch (e) {
      console.log(e);
      return {
        data: null,
        error: e.message
      };
    }
  } catch (e) {
    console.log(e);
    return {
      data: null,
      error: e.message
    };
  }
});
