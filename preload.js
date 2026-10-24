const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('taffyDesktop', {
  isDesktop: true,
  hover: (over) => ipcRenderer.send('pet-hover', !!over),
  quit: () => ipcRenderer.send('pet-quit'),
  setTop: (on) => ipcRenderer.send('pet-top', !!on),
  openAssets: () => ipcRenderer.send('pet-open-assets')
});
