import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const frontendPackage = JSON.parse(readFileSync('frontend/package.json', 'utf8')) as {
  dependencies?: Record<string, string>;
};
const lockfile = readFileSync('pnpm-lock.yaml', 'utf8');

test('frontend uses the same Sharp release as Next 15.5.18', () => {
  assert.equal(frontendPackage.dependencies?.sharp, '0.34.5');
  assert.doesNotMatch(lockfile, /^  sharp@0\.33\./m);
});
