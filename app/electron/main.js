// Modules to control application life and create native browser window
const startup = require('./utils/startup');
startup.mark('mainStart');
const path = require('path');
const { app, BrowserWindow, Menu, shell } = require('electron');
const createMenu = require('./menu');
const { installCloseGuard } = require('./utils/closeGuard');

const whenProd = (whenProd, notProd) =>
  app.name.toLowerCase() === 'electron' ? notProd : whenProd;

let mainWindow;

function createWindow() {
  startup.mark('appReady');
  mainWindow = new BrowserWindow({
    width: 1075,
    height: 610,
    // the colour of the loading screen: no white flash before the first picture
    backgroundColor: '#0d0f12',
    // shown when its first (dark) frame is ready: no white flash on any system
    show: false,

    webPreferences: {
      // the screens use Electron directly (require('electron')); the defaults changed
      // in Electron 12 (contextIsolation) - keep the old behaviour
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: whenProd(true, false)
    }
  });

  const url = whenProd(
    `file://${path.join(__dirname, '../production.html')}`,
    'http://localhost:1666'
  );

  startup.mark('windowCreated');
  mainWindow.once('show', () => startup.mark('windowShown'));
  const showNow = () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
  };
  mainWindow.once('ready-to-show', () => {
    startup.mark('firstPaint');
    showNow();
  });
  // never hidden for long, whatever happens in the window (a hidden window is not
  // always painted, so ready-to-show can come late)
  setTimeout(showNow, 800);
  mainWindow.loadURL(url);
  installCloseGuard(mainWindow);
  // a link (e.g. in the update notes) never replaces SSGL itself: web pages open in the browser
  const toBrowser = target => {
    if (/^https?:\/\//i.test(target)) shell.openExternal(target);
  };
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (target.split('#')[0] === url.split('#')[0]) return;
    event.preventDefault();
    toBrowser(target);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    toBrowser(target);
    return { action: 'deny' };
  });
  mainWindow.on('closed', function() {
    mainWindow = null;
  });

  const menu = createMenu(mainWindow, url);
  Menu.setApplicationMenu(menu);
}

app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function() {
  if (mainWindow === null) createWindow();
});

startup.listen();
require('./handlers/main');
require('./handlers/native');
require('./handlers/mods');
require('./handlers/transfer');
require('./handlers/conflicts');
require('./handlers/folders');
require('./handlers/fixes');
require('./handlers/health');
require('./handlers/sourceports');
require('./handlers/settings');
require('./handlers/packages');
require('./handlers/oblige');
require('./handlers/upscaler');
require('./handlers/viewer');
require('./handlers/wallpaper');
