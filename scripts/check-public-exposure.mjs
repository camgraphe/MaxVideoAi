#!/usr/bin/env node
/**
 * Safeguard to ensure that sensitive backend/pricing/provider code does not
 * reappear in the public repository.
 *
 * Run with: `node scripts/check-public-exposure.mjs`
 */

import { existsSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const forbiddenPaths = [
  'frontend/app/api',
  'frontend/app/(workspace)',
  'frontend/src/lib/pricing.ts',
  'frontend/src/lib/fal.ts',
  'frontend/src/lib/fal-catalog.ts',
  'frontend/src/lib/env.ts',
  'frontend/src/lib/wallet.ts',
  'frontend/src/lib/schema.ts',
  'frontend/src/lib/fal.ts',
  'packages',
  'db',
  'scripts/process-video-gallery.mjs',
  'scripts/serve-video-gallery.mjs',
];

const forbiddenEnvFiles = ['.env', '.env.local', '.env.production', '.env.development'];

function hasPath(relativePath) {
  const abs = path.resolve(repoRoot, relativePath);
  return existsSync(abs);
}

async function collectForbiddenPaths() {
  const hits = [];
  for (const rel of new Set(forbiddenPaths)) {
    if (hasPath(rel)) {
      const abs = path.resolve(repoRoot, rel);
      try {
        const stat = statSync(abs);
        if (stat.isFile() || stat.isDirectory()) {
          hits.push(rel);
        }
      } catch {
        // ignore
      }
    }
  }
  return hits;
}

async function collectForbiddenEnvFiles(startDir = repoRoot) {
  const results = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (forbiddenEnvFiles.includes(entry.name)) {
        results.push(path.relative(repoRoot, abs));
      }
    }
  }
  await walk(startDir);
  return results;
}

const [pathHits, envHits] = await Promise.all([collectForbiddenPaths(), collectForbiddenEnvFiles()]);

if (!pathHits.length && !envHits.length) {
  console.log('✅  Public exposure check passed.');
  process.exit(0);
}

console.error('❌  Public exposure check failed.');
if (pathHits.length) {
  console.error('Forbidden paths present:\n  - ' + pathHits.join('\n  - '));
}
if (envHits.length) {
  console.error('Forbidden env files present:\n  - ' + envHits.join('\n  - '));
}
console.error('\nMove these items to the private repository before pushing to the public mirror.');
process.exit(1);
