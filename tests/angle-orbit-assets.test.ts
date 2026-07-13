import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ANGLE_ORBIT_ASSETS } from '../frontend/src/components/tools/angle/landing/angle-landing-assets';

const root = process.cwd();
const flatten = (value: unknown): string[] =>
  typeof value === 'string' ? [value] : Object.values(value as Record<string, unknown>).flatMap(flatten);

test('Angle Orbit owns exactly fifteen unique WebP assets', () => {
  const paths = flatten(ANGLE_ORBIT_ASSETS);
  assert.equal(paths.length, 15);
  assert.equal(new Set(paths).size, 15);
  for (const assetPath of paths) {
    assert.match(assetPath, /^\/assets\/tools\/angle-orbit-.+\.webp$/);
    const filePath = join(root, 'frontend/public', assetPath);
    assert.ok(existsSync(filePath), `${assetPath} should exist`);
    assert.ok(readFileSync(filePath).byteLength <= 500_000, `${assetPath} must stay below 500 KB`);
  }
});
