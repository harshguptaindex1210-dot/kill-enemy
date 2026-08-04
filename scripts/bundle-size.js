#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const dist = 'dist/assets';
const files = readdirSync(dist).filter((f) => f.endsWith('.js'));
let totalRaw = 0;
let totalGz = 0;

for (const file of files) {
  const buf = readFileSync(`${dist}/${file}`);
  totalRaw += buf.length;
  totalGz += gzipSync(buf).length;
}

const rawLimit = 620000;
const gzLimit = 200000;
console.log(`Bundle JS raw: ${totalRaw} (limit ${rawLimit})`);
console.log(`Bundle JS gzip: ${totalGz} (limit ${gzLimit})`);

if (totalRaw > rawLimit) {
  console.error('FAIL: raw bundle exceeds limit');
  process.exit(1);
}
if (totalGz > gzLimit) {
  console.error('FAIL: gzip bundle exceeds limit');
  process.exit(1);
}
console.log('OK');
