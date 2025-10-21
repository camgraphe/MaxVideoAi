#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const IGNORE_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build']);
const VALID_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.md', '.mdx', '.json']);
const BAD_PATTERNS = [/https?:\/\/www\.maxvideoai\.com/gi, /http:\/\/maxvideoai\.com/gi];

let hits = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const absolute = path.join(dir, entry);
    const stats = fs.statSync(absolute);
    if (stats.isDirectory()) {
      walk(absolute);
    } else if (VALID_EXTENSIONS.has(path.extname(entry))) {
      inspectFile(absolute);
    }
  }
}

function inspectFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let next = original;

  for (const pattern of BAD_PATTERNS) {
    if (pattern.test(next)) {
      console.log(`Non-canonical link -> ${filePath}`);
      hits += 1;
      pattern.lastIndex = 0;
    }
  }

  next = next
    .replace(/https?:\/\/www\.maxvideoai\.com/gi, 'https://maxvideoai.com')
    .replace(/http:\/\/maxvideoai\.com/gi, 'https://maxvideoai.com');

  if (next !== original) {
    fs.writeFileSync(filePath, next, 'utf8');
  }
}

walk(ROOT);

if (hits > 0) {
  console.log(`seo-guard: ${hits} occurrence(s) corrigée(s) ou signalée(s).`);
  process.exit(1);
}

console.log('seo-guard: OK (aucun lien non canonique trouvé).');
