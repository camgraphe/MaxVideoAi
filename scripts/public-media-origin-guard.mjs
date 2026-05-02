#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');

const scanDirectories = [
  'content',
  'frontend/app',
  'frontend/components',
  'frontend/messages',
  'frontend/src/components/tools',
];

const scanFiles = [
  'frontend/server/engine-demos.ts',
  'frontend/src/config/falEngines.ts',
];

const ignoreDirectories = new Set(['node_modules', '.next', '.git', 'lighthouse-reports', 'fixtures', '__fixtures__']);
const validExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.mdx']);

const forbiddenOrigins = [
  'https://v3.fal.media',
  'https://v3b.fal.media',
  'https://storage.googleapis.com/falserverless',
  'https://videohub-uploads-us.s3.amazonaws.com',
];

const mediaUrlPattern = new RegExp(
  forbiddenOrigins
    .map((origin) => origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g'
);

function relative(file) {
  return path.relative(root, file);
}

function shouldInspect(file) {
  const basename = path.basename(file);
  if (basename.includes('.test.') || basename.includes('.spec.')) return false;
  return validExtensions.has(path.extname(file));
}

function walk(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoreDirectories.has(entry.name)) {
        walk(absolute, output);
      }
      continue;
    }
    if (entry.isFile() && shouldInspect(absolute)) {
      output.push(absolute);
    }
  }
  return output;
}

async function main() {
  const files = Array.from(
    new Set([
      ...scanDirectories.flatMap((dir) => walk(path.join(root, dir))),
      ...scanFiles.map((file) => path.join(root, file)).filter((file) => fs.existsSync(file)),
    ])
  );

  const findings = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      mediaUrlPattern.lastIndex = 0;
      if (mediaUrlPattern.test(line)) {
        findings.push({
          file: relative(file),
          line: index + 1,
          host: forbiddenOrigins.find((origin) => line.includes(origin)),
        });
      }
    }
  }

  if (findings.length > 0) {
    console.error('[public-media-origin-guard] Provider media URLs found in public runtime surfaces.');
    console.error('[public-media-origin-guard] Copy media to https://media.maxvideoai.com before committing.');
    for (const finding of findings) {
      console.error(`- ${finding.file}:${finding.line} (${finding.host})`);
    }
    process.exit(1);
  }

  console.log(`[public-media-origin-guard] OK scanned=${files.length}`);
}

void main().catch((error) => {
  console.error('[public-media-origin-guard] failed', error);
  process.exit(1);
});
