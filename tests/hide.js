require('@babel/register')({ presets: [[(require('./paths').APP + '/node_modules/@babel/preset-env'), { targets: { node: 'current' } }]], babelrc:false, configFile:false, extensions:['.js'], cache:false, only:[/app\/electron\/utils/] });
const Module = require('module'); const orig = Module.prototype.require;
Module.prototype.require = function (r) { if (r === 'electron') return { app: { getPath: () => '/tmp' }, ipcMain: { handle() {} } }; return orig.apply(this, arguments); };
const { EventEmitter } = require('events');
const { hideWhilePlaying } = require((require('./paths').APP + '/electron/utils/play.js'));
const mkWin = () => { const w = { calls: [], minimized: false, destroyed: false,
  minimize() { this.calls.push('minimize'); this.minimized = true; }, restore() { this.calls.push('restore'); this.minimized = false; },
  focus() { this.calls.push('focus'); }, isMinimized() { return this.minimized; }, isDestroyed() { return this.destroyed; } }; return w; };
const t = (label, ok) => console.log((ok ? 'OK  ' : 'MISS') + ' ' + label);

let w = mkWin(), p = new EventEmitter();
hideWhilePlaying(w, p);
t('game starts -> SSGL minimizes', w.calls.join() === 'minimize');
p.emit('exit', 0);
t('game closes -> SSGL comes back and gets focus', w.calls.join() === 'minimize,restore,focus');
p.emit('exit', 0);
t('a second exit event does nothing', w.calls.length === 3);

w = mkWin(); p = new EventEmitter();
hideWhilePlaying(w, p); w.minimized = false;   // user opened SSGL again while playing
p.emit('exit', 0);
t('user already restored SSGL -> nothing is forced on them', w.calls.join() === 'minimize');

w = mkWin(); p = new EventEmitter();
hideWhilePlaying(w, p);
p.emit('error', new Error('ENOENT'));
t('game could not be started (error) -> SSGL comes back', w.calls.join() === 'minimize,restore,focus');

w = mkWin(); p = new EventEmitter(); w.destroyed = true;
hideWhilePlaying(w, p); p.emit('exit');
t('window already closed -> no crash, no calls', w.calls.length === 0);
hideWhilePlaying(null, new EventEmitter());
t('no window given -> no crash', true);
