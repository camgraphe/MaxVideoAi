import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveFalVideoResolutionInput } from '../frontend/src/lib/fal';

test('Kling 3 native 4K endpoints omit the resolution field', () => {
  assert.equal(resolveFalVideoResolutionInput('kling-3-4k', '4k'), undefined);
});

test('non-native 4K routes keep legacy fal resolution normalization', () => {
  assert.equal(resolveFalVideoResolutionInput('ltx-2', '4k'), '2160p');
  assert.equal(resolveFalVideoResolutionInput('kling-3-pro', '1080p'), '1080p');
});
