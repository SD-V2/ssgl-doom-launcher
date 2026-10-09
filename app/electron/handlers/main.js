import { app, BrowserWindow, ipcMain } from 'electron';
import { mark } from '../utils/startup';
import got from 'got';

import { getJSON, takeRecovered } from '../utils/json';
import { readCache, sameLibrary, writeCache } from '../utils/libraryCache';
import { scanLibrary } from '../utils/mods';
import { DEFAULT_UPDATE_REPO } from '../constants';
import { findNewerCommit, findUpdate } from '../utils/versions';
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
    // the fork is the only place that is asked; "Update notifier: Off" asks nobody
    const repo = DEFAULT_UPDATE_REPO;
    if (settings.notifyRelease === 'off') return { error: null, data: none };

    const build = {
      time: typeof __BUILD_TIME__ === 'undefined' ? '' : __BUILD_TIME__,
      commit: typeof __BUILD_COMMIT__ === 'undefined' ? '' : __BUILD_COMMIT__
    };

    // 1) a published release that is newer than this program
    const releases = await got(
      `https://api.github.com/repos/${repo}/releases`
    ).json();

    const release = findUpdate(releases, app.getVersion(), build);
    if (release) {
      return {
        error: null,
        data: {
          available: true,
          kind: 'release',
          download: release.html_url,
          version: release.tag_name,
          date: release.published_at,
          prerelease: release.prerelease,
          changelog: release.body
        }
      };
    }

    // 2) files uploaded to the repository after this program was built
    if (build.commit) {
      const commits = await got(
        `https://api.github.com/repos/${repo}/commits?per_page=1`
      ).json();
      const newer = findNewerCommit(commits, build.commit);
      if (newer) {
        return {
          error: null,
          data: {
            available: true,
            kind: 'files',
            repo,
            sha: newer.sha,
            download: `https://github.com/${repo}/commit/${newer.sha}`,
            version: newer.sha.slice(0, 7),
            date: newer.commit && newer.commit.committer ? newer.commit.committer.date : null,
            prerelease: false,
            changelog: newer.commit ? newer.commit.message : ''
          }
        };
      }
    }

    return { error: null, data: none };
  } catch (e) {
    return {
      data: null,
      error: e.message
    };
  }
});

const sendAll = (channel, data) =>
  BrowserWindow.getAllWindows().forEach(w => {
    if (!w.isDestroyed()) w.webContents.send(channel, data);
  });

// the folder watcher starts a moment after the list is on the screen
let watchTimer = null;
const watchLater = settings => {
  clearTimeout(watchTimer);
  watchTimer = setTimeout(() => watchModDir([settings.modpath, settings.mappath]), 1500);
};

const timedScan = async settings => {
  const from = mark('scanStart');
  const result = await scanLibrary(settings);
  const to = mark('scanDone');
  mark('scanDone', 0, { scanMs: to - from, mods: result.mods.length });
  return result;
};

// options.quick (only at the start): the list of the last start is answered at once,
// the folders are read again in the background ("library/updated" when something
// changed while SSGL was closed, "library/checked" when not)
ipcMain.handle('main/init', async (e, options) => {
  try {
    const settings = await getJSON('settings');
    const sourceports = (await getJSON('sourceports')) || [];
    const packages = (await getJSON('packages')) || [];
    const rest = { sourceports, settings, packages, recovered: takeRecovered() };

    try {
      const cached = options && options.quick ? await readCache(settings) : null;
      if (cached) {
        mark('cacheUsed', 0, { cache: cached.mods.length });
        setTimeout(async () => {
          try {
            const fresh = await timedScan(settings);
            writeCache(settings, fresh);
            if (sameLibrary(cached, fresh)) sendAll('library/checked', { changed: false });
            else sendAll('library/updated', fresh);
          } catch (err) {
            sendAll('library/checked', { changed: false, error: String(err) });
          }
          watchLater(settings);
        }, 200);
        return { error: null, data: { ...cached, ...rest, fromCache: true } };
      }

      const walkedFiles = await timedScan(settings);
      writeCache(settings, walkedFiles);
      watchLater(settings);
      return { error: null, data: { ...walkedFiles, ...rest } };
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
