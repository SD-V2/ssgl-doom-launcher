import { EventEmitter } from 'events';

// Tells other parts of SSGL when a game starts and when the last one is closed
// (the Upscaler pauses while you play). 'start' / 'end'.
export const games = new EventEmitter();
let running = 0;

export const gameStarted = proc => {
  running++;
  games.emit('start');
  if (!proc || typeof proc.once !== 'function') return; // (macOS: not known when it ends)
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    running = Math.max(0, running - 1);
    if (!running) games.emit('end');
  };
  proc.once('exit', end);
  proc.once('error', end);
};

export const gamesRunning = () => running;
