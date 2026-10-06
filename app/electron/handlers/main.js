import { app, ipcMain } from 'electron';
import got from 'got';

import { getJSON, takeRecovered } from '../utils/json';
import { scanLibrary } from '../utils/mods';
import { DEFAULT_UPDATE_REPO } from '../constants';
import { cleanRepo, findNewerCommit, findUpdate } from '../utils/versions';
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

ipcMain.handle('main/init', async () => {
  try {
    const settings = await getJSON('settings');
    const sourceports = (await getJSON('sourceports')) || [];
    const packages = (await getJSON('packages')) || [];

    try {
      const walkedFiles = await scanLibrary(settings);
      watchModDir([settings.modpath, settings.mappath]);
      return {
        error: null,
        data: {
          ...walkedFiles,
          sourceports: sourceports,
          settings: settings,
          packages: packages,
          recovered: takeRecovered()
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
