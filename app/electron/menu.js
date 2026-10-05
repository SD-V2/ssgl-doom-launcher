const { app, Menu } = require('electron');
const { shell } = require('electron');
const isMac = process.platform === 'darwin';
const { getDataFile } = require('./utils/common');
const fs = require('fs');
const { open } = require('./utils/oblige');

let hasSettings = false;
let settings = {};
const settingsPath = getDataFile('settings.json');

if (fs.existsSync(settingsPath)) {
  hasSettings = true;
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
}


// Menu texts for the languages that are not English (the window texts live in
// client/locales). Anything missing here stays English.
const MENU_TEXT = {
  tr: {
    'Open': 'Aç',
    'Mod Directory': 'Mod klasörü',
    'SSGL Data Directory': 'SSGL veri klasörü',
    'Oblige Config Directory': 'Oblige ayar klasörü',
    'Application Directory': 'Uygulama klasörü',
    'Packages': 'Paketler',
    'Export Current Package...': 'Geçerli paketi dışa aktar...',
    'Export All Packages...': 'Tüm paketleri dışa aktar...',
    'Import Packages...': 'Paketleri içe aktar...',
    'Edit': 'Düzen',
    'View': 'Görünüm',
    'Reload': 'Yeniden yükle',
    'Developer Tools': 'Geliştirici araçları',
    'Actual Size': 'Gerçek boyut',
    'Zoom In': 'Yakınlaştır',
    'Zoom Out': 'Uzaklaştır',
    'Toggle Full Screen': 'Tam ekran',
    'Window': 'Pencere',
    'Minimize': 'Küçült',
    'Close': 'Kapat',
    'Community': 'Topluluk',
    'Join Discord': 'Discord’a katıl',
    'Open Github': 'GitHub’ı aç',
    'Help': 'Yardım',
    'About': 'Hakkında',
    'Open First Setup Guide': 'İlk kurulum rehberini aç'
  },
  ar: {
    'Open': 'فتح',
    'Mod Directory': 'مجلد المودات',
    'SSGL Data Directory': 'مجلد بيانات SSGL',
    'Oblige Config Directory': 'مجلد إعدادات Oblige',
    'Application Directory': 'مجلد التطبيق',
    'Packages': 'الحزم',
    'Export Current Package...': 'تصدير الحزمة الحالية...',
    'Export All Packages...': 'تصدير كل الحزم...',
    'Import Packages...': 'استيراد الحزم...',
    'Edit': 'تحرير',
    'View': 'عرض',
    'Reload': 'إعادة تحميل',
    'Developer Tools': 'أدوات المطوّر',
    'Actual Size': 'الحجم الفعلي',
    'Zoom In': 'تكبير',
    'Zoom Out': 'تصغير',
    'Toggle Full Screen': 'ملء الشاشة',
    'Window': 'نافذة',
    'Minimize': 'تصغير النافذة',
    'Close': 'إغلاق',
    'Community': 'المجتمع',
    'Join Discord': 'انضم إلى Discord',
    'Open Github': 'افتح GitHub',
    'Help': 'مساعدة',
    'About': 'حول',
    'Open First Setup Guide': 'افتح دليل الإعداد الأول'
  }
};

const L = text => (MENU_TEXT[settings.language] || {})[text] || text;

let lastWin = null;
let lastUrl = null;

const openFromSettings = async property => {
  try {
    shell.openItem(settings[property]);
  } catch (e) {
    console.log(e);
  }
};

const openApplicationSettings = async () => {
  try {
    shell.openItem(getDataFile(''));
  } catch (e) {
    console.log(e);
  }
};

const createMenu = (win, url) => {
  lastWin = win;
  lastUrl = url;
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideothers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ]
      : []),
    {
      label: L('Open'),
      submenu: [
        ...(hasSettings
          ? [
              {
                label: L('Mod Directory'),
                click: () => openFromSettings('modpath')
              },
              {
                label: L('SSGL Data Directory'),
                click: () => openFromSettings('savepath')
              }
            ]
          : []),
        ...(hasSettings && settings.obligeActive
          ? [
              { type: 'separator' },
              {
                label: 'Oblige',
                click: () => open('binary')
              },
              {
                label: L('Oblige Config Directory'),
                click: () => open('configs')
              }
            ]
          : []),

        { type: 'separator' },

        {
          label: L('Application Directory'),
          click: openApplicationSettings
        }
      ]
    },
    {
      label: L('Packages'),
      submenu: [
        {
          label: L('Export Current Package...'),
          click: () => win.webContents.send('menu/export-current')
        },
        {
          label: L('Export All Packages...'),
          click: () => win.webContents.send('menu/export-all')
        },
        { type: 'separator' },
        {
          label: L('Import Packages...'),
          click: () => win.webContents.send('menu/import')
        }
      ]
    },
    // Edit menu only exists on macOS (needed there for copy & paste);
    // on Windows / Linux the shortcuts work without it
    ...(isMac
      ? [
          {
            label: L('Edit'),
            submenu: [
              { role: 'undo' },
              { role: 'redo' },
              { type: 'separator' },
              { role: 'cut' },
              { role: 'copy' },
              { role: 'paste' },
              { role: 'selectAll' }
            ]
          }
        ]
      : []),
    {
      label: L('View'),
      submenu: [
        { role: 'reload', label: L('Reload') },
        { role: 'toggledevtools', label: L('Developer Tools') },
        { type: 'separator' },
        { role: 'resetzoom', label: L('Actual Size') },
        { role: 'zoomin', label: L('Zoom In') },
        { role: 'zoomout', label: L('Zoom Out') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: L('Toggle Full Screen') }
      ]
    },
    {
      label: L('Window'),
      submenu: [
        { role: 'minimize', label: L('Minimize') },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }]
          : [{ role: 'close', label: L('Close') }])
      ]
    },
    {
      label: L('Community'),
      submenu: [
        {
          label: L('Join Discord'),
          click: async () => {
            await shell.openExternal('https://discord.gg/MsjZhHF');
          }
        },
        {
          label: L('Open Github'),
          click: async () => {
            await shell.openExternal(
              'https://github.com/FreaKzero/ssgl-doom-launcher'
            );
          }
        }
      ]
    },
    {
      label: L('Help'),
      submenu: [
        {
          label: L('About'),
          click: async () => {
            win.webContents.executeJavaScript(`
              location.assign('#/about');`);
          }
        },
        {
          label: L('Open First Setup Guide'),
          click: async () => {
            await shell.openExternal(
              'https://github.com/FreaKzero/ssgl-doom-launcher/wiki/SSGL---First-Setup'
            );
          }
        }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
};

// rebuilds the menu when the language is changed in the settings
createMenu.refresh = language => {
  settings.language = language;
  if (lastWin) Menu.setApplicationMenu(createMenu(lastWin, lastUrl));
};

module.exports = createMenu;
