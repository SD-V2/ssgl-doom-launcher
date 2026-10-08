require('@babel/register')({ presets: [[(require('./paths').APP + '/node_modules/@babel/preset-env'), { targets: { node: 'current' } }]], babelrc:false, configFile:false, extensions:['.js'], cache:false, only:[/app\/electron\/utils/] });
const Module = require('module'); const orig = Module.prototype.require;
Module.prototype.require = function (r) { if (r === 'electron') return { ipcMain: { on() {} } }; return orig.apply(this, arguments); };
const { installCloseGuard } = require((require('./paths').APP + '/electron/utils/closeGuard.js'));
const t = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);
const mk = () => {
  const h = {}, wh = {}, calls = [];
  const win = { minimized: false, destroyed: false, on: (n, f) => (wh[n] = f), isMinimized() { return this.minimized; }, isDestroyed() { return this.destroyed; },
    restore() { calls.push('restore'); this.minimized = false; }, focus() { calls.push('focus'); }, close() { calls.push('close'); const e = { prevented: false, preventDefault() { this.prevented = true; } }; wh.close(e); if (!e.prevented) calls.push('CLOSED'); },
    webContents: { send: (ch) => calls.push('send:' + ch), on: (n, f) => (wh['wc:' + n] = f) } };
  installCloseGuard(win, { on: (n, f) => (h[n] = f) });
  const tryClose = () => { const e = { prevented: false, preventDefault() { this.prevented = true; } }; wh.close(e); return e.prevented; };
  return { win, h, wh, calls, tryClose };
};
let g = mk();
t('nothing unsaved -> the window closes at once, no question', g.tryClose() === false && g.calls.length === 0);
g = mk(); g.h['app/dirty']({}, { dirty: true });
t('unsaved -> closing is stopped and the WINDOW is asked (no Windows box)', g.tryClose() === true && g.calls.join() === 'focus,send:app/close-request');
g.calls.length = 0; g.h['app/close-confirmed']({});
t('answer "close without saving" -> SSGL really closes', g.calls.join() === 'close,CLOSED');
g = mk(); g.h['app/dirty']({}, { dirty: true });
g.tryClose(); g.calls.length = 0; g.tryClose();
t('clicking X again asks again (the window ignores a second question while one is open)', g.calls.join() === 'focus,send:app/close-request');
g = mk(); g.h['app/dirty']({}, { dirty: true }); g.win.minimized = true; g.tryClose();
t('closed from the taskbar while minimized -> window is restored first so the question is seen', g.calls.join() === 'restore,focus,send:app/close-request');
g = mk(); g.h['app/dirty']({}, { dirty: true }); g.h['app/dirty']({}, { dirty: false });
t('changes saved again -> closes normally', g.tryClose() === false);
g = mk(); g.h['app/dirty']({}, { dirty: true }); g.wh['wc:crashed']();
t('window crashed -> SSGL can still be closed', g.tryClose() === false);
g = mk(); g.h['app/dirty']({}, { dirty: true }); g.wh.unresponsive();
t('window not responding -> SSGL can still be closed', g.tryClose() === false);
g = mk(); g.h['app/dirty']({}, undefined);
t('odd message -> treated as "nothing unsaved"', g.tryClose() === false);
g = mk(); g.win.destroyed = true; g.h['app/close-confirmed']({});
t('confirmed after the window is already gone -> nothing happens, no crash', g.calls.length === 0);
