// 塔菲桌面宠物 · 独立版
// 全屏透明窗口 + 命中区穿透；渲染层复用 app/widget.js（本地 http 服务喂数据）
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const LOG_PATH = path.join(require('node:os').tmpdir(), 'taffy-pet-desktop.log');
function log(msg) {
  try { fs.appendFileSync(LOG_PATH, new Date().toISOString() + ' ' + msg + '\n') } catch (e) {}
}
process.on('uncaughtException', (e) => log('UNCAUGHT ' + ((e && e.stack) || e)));
process.on('unhandledRejection', (e) => log('REJECT ' + e));

let ASSET_DIR = '';
let UI_FILE = '';
let win = null;
let tray = null;
let server = null;
let port = 0;
let uiState = {};

function readUi() {
  try { return JSON.parse(fs.readFileSync(UI_FILE, 'utf8')) } catch (e) { return {} }
}
function writeUi(patch) {
  uiState = Object.assign({}, readUi(), patch || {});
  try {
    fs.mkdirSync(path.dirname(UI_FILE), { recursive: true });
    fs.writeFileSync(UI_FILE, JSON.stringify(uiState, null, 2));
  } catch (e) {}
}

// 第一次运行：把仓库自带的 assets/ 复制到 userData（只补缺不覆盖）
function seedAssets() {
  const src = path.join(ROOT, 'assets');
  if (!fs.existsSync(src)) return;
  const walk = (rel) => {
    const s = path.join(src, rel), d = path.join(ASSET_DIR, rel);
    for (const name of fs.readdirSync(s)) {
      const sp = path.join(s, name), dp = path.join(d, name);
      const st = fs.statSync(sp);
      if (st.isDirectory()) { fs.mkdirSync(dp, { recursive: true }); walk(path.join(rel, name)); }
      else if (!fs.existsSync(dp)) { fs.mkdirSync(path.dirname(dp), { recursive: true }); fs.copyFileSync(sp, dp); }
    }
  };
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  walk('');
}

const { createApp } = require('./server.js');

function startServer() {
  const app0 = createApp(ROOT, ASSET_DIR, { read: readUi, write: writeUi });
  server = app0;
  return new Promise((resolve) => {
    app0.listen(0, '127.0.0.1', () => { port = app0.address().port; resolve(port) });
  });
}

function createWindow() {
  const area = screen.getPrimaryDisplay().bounds;
  win = new BrowserWindow({
    x: area.x, y: area.y, width: area.width, height: area.height,
    frame: false, transparent: true, resizable: false, movable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    focusable: true, fullscreenable: false, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(ROOT, 'preload.js'), contextIsolation: true }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadURL('http://127.0.0.1:' + port + '/');
  win.webContents.once('did-finish-load', () => {
    log('loaded, ignore mouse');
    win.setIgnoreMouseEvents(true, { forward: true });
  });
  win.webContents.on('console-message', (e, level, msg) => { if (level >= 2) log('console: ' + msg) });
}

ipcMain.on('pet-hover', (evt, over) => {
  if (!win) return;
  win.setIgnoreMouseEvents(!over, { forward: true });
});

// 命中区：渲染层上报矩形，主进程每 60ms 轮询光标自己判断，避免「先移动到身上再点」的时序抖动
let petRect = null;       // 屏幕坐标
let ignoring = true;
ipcMain.on('pet-bounds', (evt, r) => {
  if (!r) { petRect = null; return }
  const scale = screen.getPrimaryDisplay().scaleFactor || 1;
  petRect = { x: r.x / scale, y: r.y / scale, w: r.w / scale, h: r.h / scale, pad: r.pad || 6 };
});

function syncIgnore() {
  if (!win || win.isDestroyed()) return;
  let over = false;
  if (petRect) {
    const p = screen.getCursorScreenPoint();
    const d = screen.getPrimaryDisplay();
    const pad = petRect.pad || 6;
    const x = p.x - d.bounds.x, y = p.y - d.bounds.y;
    over = x >= petRect.x - pad && x <= petRect.x + petRect.w + pad &&
           y >= petRect.y - pad && y <= petRect.y + petRect.h + pad;
  }
  if (over !== !ignoring) {
    ignoring = !over;
    win.setIgnoreMouseEvents(ignoring, { forward: true });
  }
}
setInterval(syncIgnore, 60);
ipcMain.on('pet-quit', () => app.quit());
ipcMain.on('pet-top', (evt, on) => { if (win) win.setAlwaysOnTop(!!on, 'screen-saver') });
ipcMain.on('pet-open-assets', () => shell.openPath(ASSET_DIR));

app.whenReady().then(async () => {
  log('ready electron=' + process.versions.electron);
  ASSET_DIR = path.join(app.getPath('userData'), 'assets');
  UI_FILE = path.join(app.getPath('userData'), 'ui-state.json');
  seedAssets();
  log('seeded ' + ASSET_DIR);
  await startServer();
  log('server on ' + port);
  createWindow();

  var ICON_B64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAzUlEQVR4nO2XUQrDIBBE1yEXa0/UnqQ5UXu09KMRZInurnHdfHRASGScNxoICVGwknXB9npvzcDn3ZSZRoF7i6TRYGsReMI1GfCEa7LgDZcyMQPeysYseI0BChZMu3/cfuOkp2RB13MPPrq2epjAG4nBtTmNp1BmgoIFlWv9yHMaT3cBHlYL1niYFpXLEqoEZ4GChX8B6viMGqHMxGUeQZp4CiULFCyUNzNOgTMgGTzhhwW8StQyYV0wEt4sMKqElJEu/2tGxiIRb9VT+gL5Q2GcywJuMwAAAABJRU5ErkJggg==';
  tray = new Tray(nativeImage.createFromBuffer(Buffer.from(ICON_B64, 'base64')));
  try {
    tray.setToolTip('永雏塔菲 · 桌面宠物');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '置顶显示', type: 'checkbox', checked: true, click: (it) => win && win.setAlwaysOnTop(it.checked, 'screen-saver') },
    { label: '打开素材目录', click: () => shell.openPath(ASSET_DIR) },
    { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]));
  } catch (e) { log('tray error ' + e); }
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { try { server && server.close() } catch (e) {} });
