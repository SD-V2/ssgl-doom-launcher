import fs from 'fs';

import { getDataFile } from './common';

// Settings, packages and sourceports live in small JSON files. They are written
// so that a crash or a power cut can never leave a half-written file behind:
//   1. the new content goes to a temporary file first
//   2. the last good version is kept as <name>.json.bak
//   3. the temporary file replaces the real one in a single step
// If a file is damaged anyway, the last good copy is used (and the window tells you).

const queues = new Map(); // writes of one file run one after the other
const recovered = []; // names of the files that were restored from their copy
let counter = 0;

const fileOf = name => `${getDataFile(name)}.json`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// { ok: true, value } when the file exists and holds valid JSON
const readParsed = file => {
  try {
    const text = fs.readFileSync(file, 'utf8');
    if (!text.trim()) return { ok: false };
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false };
  }
};

const settled = file => (queues.get(file) || Promise.resolve()).catch(() => {});

const getJSON = async name => {
  const file = fileOf(name);
  // a read waits for writes that are still going on
  await settled(file);

  if (!fs.existsSync(file)) return [];

  const main = readParsed(file);
  if (main.ok) return main.value;

  const copy = readParsed(`${file}.bak`);
  if (copy.ok) {
    // keep the damaged file to look at, bring the good copy back
    try {
      fs.renameSync(file, `${file}.damaged-${Date.now()}`);
    } catch (e) {
      // nothing to do about it
    }
    try {
      fs.copyFileSync(`${file}.bak`, file);
    } catch (e) {
      // the value is still returned below
    }
    recovered.push(name);
    return copy.value;
  }

  throw new Error(`${name}.json is damaged and there is no good copy of it`);
};

const writeSafely = async (file, json) => {
  counter += 1;
  const temp = `${file}.${process.pid}.${counter}.tmp`;

  const fd = fs.openSync(temp, 'w');
  try {
    fs.writeSync(fd, json);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  // the copy only ever holds a version that could be read
  if (fs.existsSync(file) && readParsed(file).ok) {
    try {
      fs.copyFileSync(file, `${file}.bak`);
    } catch (e) {
      // a missing copy must not stop saving
    }
  }

  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(temp, file);
      return;
    } catch (err) {
      const busy = ['EPERM', 'EBUSY', 'EACCES'].indexOf(err.code) > -1;
      if (!busy || attempt >= 5) {
        try {
          fs.unlinkSync(temp);
        } catch (e) {
          // already gone
        }
        throw err;
      }
      // a virus scanner can hold a file for a moment
      await sleep(40 * (attempt + 1));
    }
  }
};

const setJSON = (name, data) => {
  const file = fileOf(name);

  let json;
  try {
    json = JSON.stringify(data, null, 2);
  } catch (jsonerror) {
    return Promise.reject(new Error(jsonerror));
  }

  const job = settled(file).then(() => writeSafely(file, json));
  queues.set(file, job);
  return job.then(() => data);
};

// files restored from their copy since the last call
const takeRecovered = () => recovered.splice(0, recovered.length);

export { getJSON, setJSON, takeRecovered };
