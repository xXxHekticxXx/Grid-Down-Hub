// Static server for the built app (dist/) plus the data packs, used by the Playwright tests and for
// trying the PWA on a laptop. Data packs are served from DATA_DIR (default dist/data).
// usage: node scripts/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const dataDir = path.resolve(process.env.DATA_DIR || path.join(dist, 'data'));
const port = Number(process.argv[2] || process.env.PORT || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.pbf': 'application/x-protobuf', '.pdf': 'application/pdf', '.geojson': 'application/geo+json', '.txt': 'text/plain', '.wasm': 'application/wasm',
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let rel = decodeURIComponent(url.pathname);
  let file;
  if (rel.startsWith('/data/')) file = path.join(dataDir, rel.slice(6));
  else file = path.join(dist, rel === '/' ? 'index.html' : rel);
  const base = rel.startsWith('/data/') ? dataDir : dist;
  if (!path.resolve(file).startsWith(base)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = { 'content-type': type, 'cache-control': rel === '/sw.js' || rel === '/index.html' || rel === '/' ? 'no-cache' : 'public, max-age=3600', 'accept-ranges': 'bytes' };
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      const start = range[1] ? Number(range[1]) : st.size - Number(range[2]);
      const end = range[1] && range[2] ? Number(range[2]) : st.size - 1;
      res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { ...headers, 'content-length': st.size });
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(file).pipe(res);
    }
  });
}).listen(port, () => console.log(`Grid-Down Hub on http://localhost:${port} (data from ${dataDir})`));
