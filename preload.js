const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('taffyDesktop', {
  isDesktop: true,
  hover: (over) => ipcRenderer.send('pet-hover', !!over),
  bounds: (r) => ipcRenderer.send('pet-bounds', r),
  quit: () => ipcRenderer.send('pet-quit'),
  setTop: (on) => ipcRenderer.send('pet-top', !!on),
  openAssets: () => ipcRenderer.send('pet-open-assets'),
  log: (m) => ipcRenderer.send('pet-log', String(m))
});
