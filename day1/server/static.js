'use strict';

/**
 * Minimal static file serving for the client, on Node's built-in http only.
 * Two roots are exposed: the client directory at `/`, and the shared event
 * names at `/shared/events.js` so the browser loads the same file the server
 * requires.
 */

const fs = require('node:fs');
const path = require('node:path');

const CLIENT_ROOT = path.join(__dirname, '..', 'client');
const SHARED_ROOT = path.join(__dirname, '..', 'shared');

/**
 * The browser Socket.IO client ships inside the `socket.io` dependency, so it
 * is served from there rather than a CDN. The build copies the same file into
 * dist/, which is why index.html can reference one relative path in both cases.
 */
const VENDORED = {
  // Not require.resolve(): socket.io's package `exports` does not expose
  // client-dist, so the path is joined directly.
  '/socket.io.min.js': path.join(
    __dirname, '..', 'node_modules', 'socket.io', 'client-dist', 'socket.io.min.js',
  ),
};

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/** Resolves a URL path inside a root, or null if it would escape it. */
function safeResolve(root, relativePath) {
  const resolved = path.resolve(root, '.' + relativePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

function resolveRequest(urlPath) {
  if (urlPath === '/' || urlPath === '') return path.join(CLIENT_ROOT, 'index.html');
  if (VENDORED[urlPath]) return VENDORED[urlPath];
  if (urlPath.startsWith('/shared/')) {
    return safeResolve(SHARED_ROOT, urlPath.slice('/shared'.length));
  }
  return safeResolve(CLIENT_ROOT, urlPath);
}

function serve(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const filePath = resolveRequest(urlPath);

  if (!filePath) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const type = CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' }).end(data);
  });
}

module.exports = { VENDORED, serve };
