#!/usr/bin/env node
/**
 * INV-3: measure the *initial* JS loaded by dist/index.html (entry + modulepreload).
 * Async chunks (e.g. online multiplayer) are fetched on demand and excluded.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const dist = 'dist';
const assets = join(dist, 'assets');
const htmlPath = join(dist, 'index.html');

if (!existsSync(htmlPath)) {
  console.error('FAIL: dist/index.html missing — run vite build first');
  process.exit(1);
}

const html = readFileSync(htmlPath, 'utf8');
const refs = new Set();
for (const m of html.matchAll(/(?:src|href)="([^"]+\/assets\/[^"]+\.js)"/g)) {
  refs.add(basename(m[1]));
}

if (refs.size === 0) {
  console.error('FAIL: no initial JS assets found in index.html');
  process.exit(1);
}

let totalRaw = 0;
let totalGz = 0;
for (const file of refs) {
  const buf = readFileSync(join(assets, file));
  totalRaw += buf.length;
  totalGz += gzipSync(buf).length;
  console.log(`  initial: ${file}  raw=${buf.length}  gzip=${gzipSync(buf).length}`);
}

const rawLimit = 662000;
const gzLimit = 200000;
console.log(`Bundle JS raw (initial): ${totalRaw} (limit ${rawLimit})`);
console.log(`Bundle JS gzip (initial): ${totalGz} (limit ${gzLimit})`);

if (totalRaw > rawLimit) {
  console.error('FAIL: raw bundle exceeds limit');
  process.exit(1);
}
if (totalGz > gzLimit) {
  console.error('FAIL: gzip bundle exceeds limit');
  process.exit(1);
}
console.log('OK');
