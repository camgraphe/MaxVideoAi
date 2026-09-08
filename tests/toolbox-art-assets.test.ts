import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const artModulePath = join(root, 'frontend/src/components/tools/toolbox-art.ts');
const expectedVisuals = [
  'upscale-image',
  'upscale-video',
  'background-removal',
  'restore-video',
  'denoise',
  'fix-blur',
  'smooth-motion',
] as const;

test('every quick tool has its own production-ready artwork', async () => {
  assert.equal(existsSync(artModulePath), true, 'quick-tool artwork registry should exist');

  const { QUICK_TOOL_ART } = await import('../frontend/src/components/tools/toolbox-art.ts');
  assert.deepEqual(Object.keys(QUICK_TOOL_ART).sort(), [...expectedVisuals].sort());

  const assetPaths = Object.values(QUICK_TOOL_ART) as string[];
  assert.equal(new Set(assetPaths).size, expectedVisuals.length, 'quick tools should not share generic artwork');

  for (const assetPath of assetPaths) {
    assert.match(assetPath, /^\/assets\/tools\/catalogue\/[a-z-]+\.webp$/);
    const diskPath = join(root, 'frontend/public', assetPath);
    assert.equal(existsSync(diskPath), true, `${assetPath} should be shipped with the app`);
    assert.ok(statSync(diskPath).size > 20_000, `${assetPath} should be a finished raster asset`);
  }
});
