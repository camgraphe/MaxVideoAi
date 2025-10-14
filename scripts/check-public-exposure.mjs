#!/usr/bin/env node
/**
 * Safeguard to ensure that accidental secrets (.env files, raw credentials)
 * do not land in the repository.
 *
 * Run with: `node scripts/check-public-exposure.mjs`
 */

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const forbiddenEnvFiles = ['.env', '.env.local', '.env.production', '.env.development'];

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

const envHits = await collectForbiddenEnvFiles();

if (!envHits.length) {
  console.log('✅  Public exposure check passed.');
  process.exit(0);
}

console.error('❌  Public exposure check failed.');
console.error('Forbidden env files present:\n  - ' + envHits.join('\n  - '));
console.error('\nRemove the files listed above or move their contents into your secret manager before committing.');
process.exit(1);
