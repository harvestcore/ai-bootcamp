#!/usr/bin/env node
'use strict';

/**
 * Assembles `dist/` — the static half of the game, ready for GitHub Pages.
 *
 * There is no bundler and nothing to transpile; "building" means gathering the
 * three sources of static files into one directory:
 *   - client/          the page itself
 *   - shared/          constants the browser and server both use
 *   - socket.io.min.js the browser client, taken from the socket.io dependency
 *
 * Note what is NOT here: the server. Pages cannot run Node, so a deployed page
 * has to point at a server hosted elsewhere (see DEPLOY.md).
 */

const fs = require('node:fs');
const path = require('node:path');

const { VENDORED } = require('../server/static');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function copyDirectory(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyDirectory(source, target);
    else fs.copyFileSync(source, target);
  }
}

fs.rmSync(DIST, { recursive: true, force: true });

copyDirectory(path.join(ROOT, 'client'), DIST);
copyDirectory(path.join(ROOT, 'shared'), path.join(DIST, 'shared'));

for (const [urlPath, file] of Object.entries(VENDORED)) {
  if (!fs.existsSync(file)) {
    console.error(`missing ${file} — run npm install first`);
    process.exit(1);
  }
  fs.copyFileSync(file, path.join(DIST, urlPath.replace(/^\//, '')));
}

// Stops GitHub Pages from running the files through Jekyll.
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

const files = [];
(function walk(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
    else files.push(`${prefix}${entry.name}`);
  }
})(DIST);

console.log(`built dist/ (${files.length} files):`);
for (const file of files) console.log(`  ${file}`);
