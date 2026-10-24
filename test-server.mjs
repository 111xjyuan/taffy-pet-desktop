// 无 GUI 环境下验证渲染层：起同一个服务器，用 Edge 打开截图
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { createApp } = require('./server.js');
const here = dirname(fileURLToPath(import.meta.url));
const assetDir = process.env.TAFFY_ASSETS || join(here, 'assets');
const uiFile = join(here, '.ui-state.json');

const read = () => { try { return JSON.parse(readFileSync(uiFile, 'utf8')) } catch { return {} } };
const write = (patch) => {
  const next = { ...read(), ...patch };
  writeFileSync(uiFile, JSON.stringify(next, null, 2));
};

const server = createApp(here, assetDir, { read, write });
server.listen(7801, '127.0.0.1', () => {
  console.log('READY http://127.0.0.1:7801/');
});
