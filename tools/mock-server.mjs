// 개발·테스트용 서버: 저장소 파일을 그대로 제공하고, /api 요청은 apps-script/Code.gs(모의 시트)로 처리한다.
// 사용법: node tools/mock-server.mjs [포트=5173]
// 제어: POST /__mock/offline  {"on": true}  → /api 요청을 끊어 오프라인 흉내
//       GET  /__mock/sheet                  → 시트 내용(JSON)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGasEnv } from './gas-mock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
};

export function startMockServer(port = 5173, { latency = 120 } = {}) {
  const env = createGasEnv();
  const state = { offline: false, calls: [] };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const body = [];
    req.on('data', (c) => body.push(c));
    req.on('end', () => {
      const text = Buffer.concat(body).toString('utf8');
      if (url.pathname === '/api') {
        if (req.method === 'OPTIONS') { res.writeHead(405); res.end(); return; } // Apps Script처럼 사전 요청은 실패
        if (state.offline) { req.socket.destroy(); return; }
        setTimeout(() => {
          let out;
          try {
            out = req.method === 'GET' ? env.get() : env.post(text);
          } catch (e) {
            out = { ok: false, code: 'MOCK', msg: e.message };
          }
          state.calls.push({ a: safeA(text), out: out.code || 'ok' });
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify(out));
        }, latency);
        return;
      }
      if (url.pathname === '/__mock/offline') {
        state.offline = !!JSON.parse(text || '{}').on;
        res.end('ok');
        return;
      }
      if (url.pathname === '/__mock/sheet') {
        const sh = env.sheet();
        const rows = [];
        if (sh) for (let r = 1; r <= sh.getLastRow(); r++) rows.push(sh.row(r));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ rows, calls: state.calls }));
        return;
      }
      if (url.pathname === '/__mock/kick') {
        // 다른 기기 로그인 흉내: 세션 바꾸기
        const id = JSON.parse(text || '{}').id;
        const sh = env.sheet();
        for (let r = 2; r <= sh.getLastRow(); r++) if (sh.cell(r, 1).v === id) sh.cell(r, 13).v = 'other-device';
        res.end('ok');
        return;
      }
      let p = decodeURIComponent(url.pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, env, state, url: `http://localhost:${port}` })));
}

function safeA(text) {
  try { return JSON.parse(text).a; } catch { return '?'; }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || 5173);
  startMockServer(port).then(({ url }) => console.log(`모의 서버: ${url}`));
}
