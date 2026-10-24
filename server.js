// 独立版的内置静态服务器：给渲染层喂素材与假数据（没有计费接口）
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MIME = {
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
  '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.vrm': 'model/gltf-binary', '.glb': 'model/gltf-binary', '.vrma': 'model/gltf+json',
  '.pmx': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8'
};

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}
function safeJoin(base, rel) {
  const p = path.resolve(base, rel);
  return p.startsWith(base) ? p : null;
}
function scanDir(dir, exts) {
  try { return fs.readdirSync(dir).filter((f) => exts.some((e) => f.toLowerCase().endsWith(e))).sort() } catch (e) { return [] }
}

function createApp(ROOT, ASSET_DIR, ui) {
  const readUi = ui.read;
  const writeUi = ui.write;
  return http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const p = u.pathname;

    if (p === '/' || p === '/index.html') return send(res, 200, MIME['.html'], fs.readFileSync(path.join(ROOT, 'app', 'index.html')));
    if (p === '/widget.js') return send(res, 200, MIME['.js'], fs.readFileSync(path.join(ROOT, 'app', 'widget.js')));
    if (p === '/desktop.js') return send(res, 200, MIME['.js'], fs.readFileSync(path.join(ROOT, 'app', 'desktop.js')));
    if (p === '/dsh-whale/vrm-runtime.js') return send(res, 200, MIME['.js'], fs.readFileSync(path.join(ROOT, 'app', 'vrm-runtime.js')));
    if (p === '/dsh-whale/balance.json') return send(res, 200, MIME['.json'], '{"ok":false,"reason":"no-billing"}');
    if (p === '/dsh-whale/last-turn.json') return send(res, 200, MIME['.json'], '{"turn":0,"amount":0,"tokens":0,"ts":0,"seq":0}');
    if (p === '/dsh-whale/usage-records.json') return send(res, 200, MIME['.json'], '{"ok":false,"today":{},"days7":[],"all":{"days":[],"events":[]},"settings":{}}');

    if (p === '/dsh-whale/pet-state.json') {
      if (req.method === 'GET') return send(res, 200, MIME['.json'], JSON.stringify({ ok: true, activity: { status: 'idle', detail: '' }, ui: readUi() }));
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 65536) req.destroy() });
      req.on('end', () => {
        try { const j = JSON.parse(body || '{}'); writeUi(j.ui || {}) } catch (e) {}
        send(res, 200, MIME['.json'], '{"ok":true}');
      });
      return;
    }
    if (p === '/dsh-whale/audio.json') {
      const f = path.join(ASSET_DIR, 'audio', 'audio.json');
      if (!fs.existsSync(f)) return send(res, 200, MIME['.json'], '{"version":1,"groups":[],"fragments":[]}');
      return send(res, 200, MIME['.json'], fs.readFileSync(f));
    }
    if (p === '/dsh-whale/audio-fragment.wav') {
      const id = (u.searchParams.get('id') || '').replace(/[^A-Za-z0-9_-]/g, '');
      const f = safeJoin(path.join(ASSET_DIR, 'audio'), id + '.wav');
      if (f && fs.existsSync(f)) return send(res, 200, MIME['.wav'], fs.readFileSync(f));
      return send(res, 404, 'text/plain', 'no audio');
    }
    if (p === '/dsh-whale/vrm-list.json') {
      const vrmDir = path.join(ASSET_DIR, 'vrm');
      return send(res, 200, MIME['.json'], JSON.stringify({
        ok: true, dir: vrmDir,
        files: scanDir(vrmDir, ['.vrm', '.glb']),
        models: [],
        anims: scanDir(path.join(vrmDir, 'anim'), ['.vrma'])
      }));
    }
    if (p === '/dsh-whale/taffy-file') {
      const rel = u.searchParams.get('p') || '';
      if (!rel || rel.indexOf('..') >= 0) return send(res, 403, 'text/plain', 'denied');
      const f = safeJoin(ASSET_DIR, rel);
      if (!f || !fs.existsSync(f) || !fs.statSync(f).isFile()) return send(res, 404, 'text/plain', 'not found');
      return send(res, 200, MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', fs.readFileSync(f));
    }
    send(res, 404, 'text/plain', 'not found');
  });
}

module.exports = { createApp, scanDir, safeJoin, MIME };
