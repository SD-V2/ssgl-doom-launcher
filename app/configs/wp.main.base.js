const path = require('path');
const webpack = require('webpack');

// when and from which commit this program was built
const BUILD = new webpack.DefinePlugin({
  __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  __BUILD_COMMIT__: JSON.stringify(process.env.GITHUB_SHA || '')
});

module.exports = {
  target: 'electron-main',
  plugins: [BUILD],
  devtool: 'source-map',
  entry: `${process.cwd()}/electron/main.js`,
  output: {
    path: path.join(process.cwd(), 'build'),
    publicPath: '/',
    filename: 'main-bundle.js'
  },
  resolve: {
    extensions: ['*', '.js', '.jsx']
  },
  node: {
    __dirname: false,
    __filename: false
  }
};