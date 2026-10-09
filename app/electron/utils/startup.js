import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

// How long SSGL takes to start: milliseconds since the program was started, for a few
// moments (main part started, window shown, library read, list drawn ...). The last 10
// starts are kept in "startup-log.txt" in the data folder; About shows the latest one.

const t0 = (() => {
  try {
    // the moment the process started (performance.timeOrigin), on the Date.now() clock
    return typeof performance !== 'undefined' && performance.timeOrigin ? performance.timeOrigin : Date.now() - process.uptime() * 1000;
  } catch (e) {
    return Date.now();
  }
})();

const marks = {};
const watchers = [];
// call fn(name) for every moment that comes in (main.js shows the window on "htmlLoaded")
export const onMark = fn => watchers.push(fn);
const extra = {};
let written = false;
let timer = null;

export const now = () => Math.round(Date.now() - t0);

// name -> ms since start (the first time only); at = a Date.now() from the screens
export const mark = (name, at, more) => {
  if (marks[name] === undefined) marks[name] = at ? Math.round(at - t0) : now();
  if (more) Object.assign(extra, more);
  return marks[name];
};

export const LOG = 'startup-log.txt';
export const KEEP = 10;
const logFile = () => path.join(app.getPath('userData'), LOG);

export const sec = ms => (ms === undefined || ms === null ? '?' : (ms / 1000).toFixed(1));

// one line per start: "<date>  window 0.8 s  usable 3.1 s  {all marks}"
export const lineOf = (record) =>
  `${record.date}  window ${sec(record.window)} s  usable ${sec(record.usable)} s  ${JSON.stringify({ marks: record.marks, extra: record.extra })}`;

export const parseLine = line => {
  const m = String(line).match(/^(\S+)\s+window (\S+) s\s+usable (\S+) s\s+(\{.*\})\s*$/);
  if (!m) return null;
  try {
    const rest = JSON.parse(m[4]);
    return { date: m[1], window: Math.round(Number(m[2]) * 1000), usable: Math.round(Number(m[3]) * 1000), marks: rest.marks || {}, extra: rest.extra || {} };
  } catch (e) {
    return null;
  }
};

export const readLog = file => {
  try {
    return fs
      .readFileSync(file || logFile(), 'utf8')
      .split(/\r?\n/)
      .map(parseLine)
      .filter(Boolean);
  } catch (e) {
    return [];
  }
};

// keep the last KEEP starts; written to a temp file first, then renamed
export const appendLog = (record, file = logFile()) => {
  const lines = readLog(file).map(lineOf);
  lines.push(lineOf(record));
  const keep = lines.slice(-KEEP);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, keep.join('\n') + '\n');
  fs.renameSync(tmp, file);
  return keep.length;
};

export const record = () => ({
  date: new Date(Date.now()).toISOString().replace(/\.\d+Z$/, 'Z'),
  // the window with SSGL in it (its first paint), and the list ready to use
  window: marks.firstPaint !== undefined ? marks.firstPaint : marks.windowShown,
  usable: marks.usable,
  marks: { ...marks },
  extra: { ...extra }
});

const write = () => {
  if (written) return;
  written = true;
  try {
    appendLog(record());
  } catch (e) {
    // no log this time
  }
};

export const listen = () => {
  ipcMain.on('startup/mark', (e, data) => {
    if (!data || !data.name) return;
    mark(data.name, data.at, data.extra);
    watchers.forEach(fn => fn(data.name));
    // "usable" is in: wait a little for the late ones (fonts, wallpaper), then write
    if (data.name === 'usable' && !timer) timer = setTimeout(write, 4000);
  });
  ipcMain.handle('startup/last', async () => {
    const all = readLog();
    return { data: all.length ? { ...all[all.length - 1], file: logFile() } : null, error: null };
  });
};
