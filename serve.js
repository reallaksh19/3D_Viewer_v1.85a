#!/usr/bin/env node
/**
 * serve.js — zero-dependency static file server for the 3D Viewer.
 *
 * Uses only Node built-ins (http, fs, path, url).
 * Never touches import statements — the browser handles everything via
 * the <script type="importmap"> in viewer/index.html.
 *
 * Usage:  node serve.js [port]   (default port: 3000)
 */

import http from 'http';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT      = parseInt(process.argv[2] ?? '3000', 10);
const ROOT      = __dirname;

const MIME = {
  '.html' : 'text/html; charset=utf-8',
  '.js'   : 'text/javascript; charset=utf-8',
  '.mjs'  : 'text/javascript; charset=utf-8',
  '.css'  : 'text/css; charset=utf-8',
  '.json' : 'application/json; charset=utf-8',
  '.svg'  : 'image/svg+xml',
  '.png'  : 'image/png',
  '.jpg'  : 'image/jpeg',
  '.jpeg' : 'image/jpeg',
  '.gif'  : 'image/gif',
  '.ico'  : 'image/x-icon',
  '.wasm' : 'application/wasm',
  '.glb'  : 'model/gltf-binary',
  '.gltf' : 'model/gltf+json',
  '.zip'  : 'application/zip',
  '.pdf'  : 'application/pdf',
  '.txt'  : 'text/plain; charset=utf-8',
  '.csv'  : 'text/csv; charset=utf-8',
  '.xml'  : 'application/xml; charset=utf-8',
  '.pcf'  : 'text/plain; charset=utf-8',
  '.rvm'  : 'application/octet-stream',
  '.mdb'  : 'application/octet-stream',
  '.accdb': 'application/octet-stream',
};

function mime(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  // Strip query string and decode URI
  const rawPath = req.url.split('?')[0];
  let decoded;
  try { decoded = decodeURIComponent(rawPath); }
  catch { decoded = rawPath; }

  // Resolve to an absolute path, preventing directory traversal
  let filePath = path.normalize(path.join(ROOT, decoded));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  // If pointing at a directory, serve index.html inside it
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`404 Not Found: ${decoded}`);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type'  : mime(filePath),
      'Cache-Control' : 'no-cache',
      // Allow SharedArrayBuffer / cross-origin isolation if needed later
      'Cross-Origin-Opener-Policy'   : 'same-origin',
      'Cross-Origin-Embedder-Policy' : 'require-corp',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  3D Viewer dev server`);
  console.log(`  ➜  http://localhost:${PORT}/`);
  console.log(`  ➜  http://localhost:${PORT}/viewer/index.html`);
  console.log(`\n  Serving: ${ROOT}`);
  console.log('  Press Ctrl+C to stop.\n');
});
