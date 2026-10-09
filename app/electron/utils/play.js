import { spawn } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { platform } from 'os';
import { join } from 'path';

import { gameStarted } from './games';
import { getJSON } from './json';

const getLastSaveGame = dir => {
  if (!existsSync(dir)) {
    return null;
  }

  const files = readdirSync(dir);
  const sorted = files
    .map(name => {
      const p = join(dir, name);
      return { path: p, ctime: statSync(p).ctime };
    })
    .sort((a, b) => b.ctime - a.ctime);

  return sorted.length ? sorted[0].path : null;
};

// Option "Minimize SSGL while a game is running": SSGL goes to the taskbar and
// comes back when the game closes (or could not be started). Not possible on
// macOS, where the game is started through "open".
const hideWhilePlaying = (win, proc) => {
  if (!win || win.isDestroyed()) return;

  let minimizedByUs = false;
  const comeBack = () => {
    // only when it is still minimized, if you opened SSGL yourself in the
    // meantime nothing changes
    if (minimizedByUs && !win.isDestroyed() && win.isMinimized()) {
      win.restore();
      win.focus();
    }
    minimizedByUs = false;
  };

  proc.once('exit', comeBack);
  proc.once('error', comeBack);
  win.minimize();
  minimizedByUs = true;
};

const play = async (
  pack,
  selected,
  loadLast = false,
  oblige = null,
  win = null
) => {
  let deh = [];
  let bex = [];
  let file = [];
  let params = [];
  const { iwad } = pack;

  try {
    const sourceports = await getJSON('sourceports');
    const settings = await getJSON('settings');
    const sourceport = sourceports.find(i => i.id === pack.sourceport);

    selected.forEach(i => {
      switch (i.kind) {
        case 'DEH':
          deh.push(i.path);
          break;
        case 'BEX':
          bex.push(i.path);
          break;
        default:
          file.push(i.path);
      }
    });

    if (typeof oblige === 'object' && oblige !== null && oblige.path) {
      file.push(oblige.path);
    } else if (typeof oblige === 'boolean' && oblige === true) {
      file.push(join(settings.savepath, pack.datapath, 'generated.wad'));
    }

    let COMMAND = ['-iwad', iwad, '-file', ...file];

    if (sourceport.hasConfig) {
      params = params.concat([
        sourceport.paramConfig,
        join(settings.savepath, pack.datapath, sourceport.configFilename)
      ]);
    }

    if (sourceport.hasSavedir) {
      params = params.concat([
        sourceport.paramSave,
        join(settings.savepath, pack.datapath, 'saves')
      ]);

      if (loadLast) {
        const save = getLastSaveGame(
          join(settings.savepath, pack.datapath, 'saves')
        );
        if (save) {
          COMMAND = COMMAND.concat([sourceport.paramLoad, save]);
        }
      }
    }

    if (params.length > 0) {
      COMMAND = COMMAND.concat(params);
    }

    if (deh.length > 0) {
      COMMAND = COMMAND.concat(['-deh', ...deh]);
    }

    if (bex.length > 0) {
      COMMAND = COMMAND.concat(['-bex', ...bex]);
    }

    if (pack.userparams && pack.userparams.trim() !== '') {
      const USERPARAMS = pack.userparams.match(/(?:[^\s"]+|"[^"]*")+/g).map(i =>
        i
          .replace('<data>', settings.savepath)
          .replace('<package>', join(settings.savepath, pack.datapath))
          .replace(/['"]+/g, '')
      );

      COMMAND = COMMAND.concat(USERPARAMS);
    }

    if (platform() === 'darwin') {
      let MAC = [sourceport.binary, '--args'];
      COMMAND = [...MAC, ...COMMAND];
      console.log(COMMAND.join(' '));
      const proc = spawn('open', COMMAND, {
        detached: true,
        stdio: 'ignore'
      });
      proc.unref();
      gameStarted(null);
    } else {
      const proc = spawn(sourceport.binary, COMMAND, {
        detached: true,
        stdio: 'ignore'
      });
      proc.unref();
      gameStarted(proc);

      if (settings.hideWhilePlaying) hideWhilePlaying(win, proc);
    }

    return {
      data: pack,
      error: null
    };
  } catch (e) {
    console.log(e);
    return {
      data: null,
      error: e.message
    };
  }
};

export { hideWhilePlaying };
export default play;
