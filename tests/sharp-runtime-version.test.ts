import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { getSharp } from '../frontend/node_modules/next/dist/server/image-optimizer.js';

const requireFromFrontend = createRequire(new URL('../frontend/package.json', import.meta.url));
const sharp = requireFromFrontend('sharp');

const frontendPackage = JSON.parse(readFileSync('frontend/package.json', 'utf8')) as {
  dependencies?: Record<string, string>;
};
const lockfile = readFileSync('pnpm-lock.yaml', 'utf8');
const lockfilePackages = lockfile.split('\npackages:\n')[1]?.split('\nsnapshots:\n')[0] ?? '';

test('frontend and Next load the same declared Sharp release', () => {
  const declaredVersion = frontendPackage.dependencies?.sharp;
  assert.ok(declaredVersion);
  assert.equal(sharp.versions.sharp, declaredVersion);
  assert.equal(getSharp(null).versions.sharp, declaredVersion);
  const lockedVersions = [...lockfilePackages.matchAll(/^  sharp@([^:\s]+):/gm)].map((match) => match[1]);
  assert.deepEqual([...new Set(lockedVersions)], [declaredVersion]);
});
