import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./lusion.co/', import.meta.url));
const pending = new Map();
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.xml': 'application/xml',
};

async function metadata(file) {
  try { return await stat(file); } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

// HTTrack cannot discover assets whose URLs are assembled by the application.
// Recover only this site's static assets, never proxy arbitrary destinations.
async function recoverAsset(urlPath, file) {
  if (!pending.has(file)) {
    pending.set(file, (async () => {
      const response = await fetch(`https://lusion.dev${urlPath}`, {
        signal: AbortSignal.timeout(60000), redirect: 'error',
      });
      if (!response.ok) throw new Error(`Asset upstream returned ${response.status}: ${urlPath}`);
      const body = Buffer.from(await response.arrayBuffer());
      if (response.headers.get('content-type')?.includes('text/html')) {
        throw new Error(`Expected an asset but received HTML: ${urlPath}`);
      }
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(`${file}.part`, body);
      await rename(`${file}.part`, file);
      console.log(`Saved ${urlPath} (${body.length} bytes)`);
    })().finally(() => pending.delete(file)));
  }
  await pending.get(file);
}

export function createServer({ recover = true } = {}) {
  return http.createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
      }
      const url = new URL(req.url, 'http://localhost');
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch {
        res.writeHead(400).end('Invalid URL'); return;
      }
      if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').includes('..')) {
        res.writeHead(400).end('Invalid path'); return;
      }
      let canonical = pathname.replace(/^\/lusion\.co(?=\/|$)/, '').replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/';
      if (canonical !== pathname) {
        res.writeHead(308, { Location: canonical + url.search }).end(); return;
      }
      if (pathname === '/favicon.ico') pathname = '/assets/meta/favicon.ico';
      let file = path.resolve(root, `.${pathname}`);
      if (!file.startsWith(root) && file !== path.resolve(root)) {
        res.writeHead(403).end('Forbidden'); return;
      }
      let info = await metadata(file);
      if (info?.isDirectory()) { file = path.join(file, 'index.html'); info = await metadata(file); }
      if (!info && recover && pathname.startsWith('/assets/') && path.extname(pathname)) {
        try { await recoverAsset(url.pathname, file); info = await metadata(file); } catch (error) {
          console.error(error.message);
          res.writeHead(502, { 'Content-Type': 'text/plain' }).end('Asset unavailable. Check your internet connection and reload.');
          return;
        }
      }
      if (!info?.isFile()) { res.writeHead(404).end('Not found'); return; }
      const headers = {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
      };
      let start = 0, end = info.size - 1, status = 200;
      if (req.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (range && (range[1] || range[2])) {
          start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
          end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
        }
        if (!range || (!range[1] && !range[2]) || start > end || start >= info.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return;
        }
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
      }
      headers['Content-Length'] = info.size === 0 ? 0 : end - start + 1;
      res.writeHead(status, headers);
      if (req.method === 'HEAD' || info.size === 0) { res.end(); return; }
      const stream = createReadStream(file, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.writeHead(500);
      res.end('Server error');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const server = createServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Local site: http://localhost:${port}`));
}
