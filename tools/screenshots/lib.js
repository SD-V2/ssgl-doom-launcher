// shared by the scripts: where things are
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, 'out');
const APP = path.resolve(__dirname, '..', '..', 'app');
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

module.exports = {
  OUT,
  APP,
  SHOTS: path.join(OUT, 'shots'),
  page: scene => 'file://' + OUT + '/harness.html#' + encodeURIComponent(scene)
};
