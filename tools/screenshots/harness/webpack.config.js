const path = require('path');
const merge = require('webpack-merge');
const base = require('../configs/wp.renderer.base');

// this file is copied to app/.harness by build.js; the result goes to tools/screenshots/out
module.exports = merge.smart(base, {
  mode: 'development',
  entry: path.join(__dirname, 'entry.jsx'),
  target: 'electron-renderer',
  output: {
    path: path.resolve(__dirname, '..', '..', 'tools', 'screenshots', 'out', 'build'),
    publicPath: 'build/',
    filename: 'harness-bundle.js'
  },
  devtool: false
});
