import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const blockedHosts = ['docs.maxvideoai.com', 'blog.maxvideoai.com'];
const searchableExtensions = new Set([
  '.cjs',
  '.js',
  '.json',
  '.md',
  '.mdx',
  '.mjs',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);
const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.tmp',
  '.vercel',
  'build',
  'dist',
  'node_modules',
]);
const ignoredFiles = new Set(['tests/ghost-subdomain-references.test.ts']);

function walk(directory: string, files: string[] = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        walk(path.join(directory, entry.name), files);
      }
      continue;
    }

    if (searchableExtensions.has(path.extname(entry.name))) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
}

test('source files do not reference unused MaxVideoAI subdomains', () => {
  const offenders: string[] = [];

  for (const file of walk(root)) {
    const relativeFile = path.relative(root, file).replaceAll(path.sep, '/');
    if (ignoredFiles.has(relativeFile)) continue;

    const source = readFileSync(file, 'utf8');
    for (const host of blockedHosts) {
      if (source.includes(host)) {
        offenders.push(`${relativeFile} contains ${host}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});
