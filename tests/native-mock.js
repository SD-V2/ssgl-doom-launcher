// Stand-in for the requests the screens send to the main part of the program
// (app/client/utils/native.js -> app/electron/handlers/native.js).
//   global.__menu    the last right-click menu; item.click() picks that item, as in the real menu
//   global.__trashed the files sent to the Recycle Bin
//   global.__opened  everything opened: [what, path or link]
// wrap(invoke) answers the "native/..." requests and passes everything else on.
const wrap = invoke => async (channel, data) => {
  switch (channel) {
    case 'native/popupMenu':
      return new Promise(resolve => {
        const clickable = items =>
          items.map(i => ({
            ...i,
            ...(i.submenu ? { submenu: clickable(i.submenu) } : {}),
            ...(i.clickId !== undefined ? { click: () => resolve(i.clickId) } : {})
          }));
        global.__menu = clickable(data);
      });
    case 'native/trashItem':
      (global.__trashed = global.__trashed || []).push(data);
      return true;
    case 'native/showOpenDialog':
      return { canceled: true, filePaths: [] };
    case 'native/openExternal':
    case 'native/showItemInFolder':
    case 'native/openPath':
      (global.__opened = global.__opened || []).push([channel.slice(7), data]);
      return channel === 'native/openPath' ? '' : undefined;
    default:
      return invoke(channel, data);
  }
};

const sendSync = channel => (channel === 'native/appVersion' ? '1.0.0' : undefined);

module.exports = { wrap, sendSync };
