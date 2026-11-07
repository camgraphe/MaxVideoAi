import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCompactResolutionLabel } from '../frontend/src/lib/resolution-labels';

test('compact resolution labels remove redundant quality descriptions', () => {
  assert.equal(formatCompactResolutionLabel('720p · HD'), '720p');
  assert.equal(formatCompactResolutionLabel('720p HD'), '720p');
  assert.equal(formatCompactResolutionLabel('1080p · Full HD'), '1080p');
  assert.equal(formatCompactResolutionLabel('1080P Full HD Pro'), '1080p');
  assert.equal(formatCompactResolutionLabel('4k · Ultra HD'), '4K');
  assert.equal(formatCompactResolutionLabel('4K'), '4K');
  assert.equal(formatCompactResolutionLabel('2K'), '2K');
  assert.equal(formatCompactResolutionLabel('Auto'), 'Auto');
  assert.equal(formatCompactResolutionLabel('4K · 3840 x 2160'), '4K · 3840 x 2160');
  assert.equal(formatCompactResolutionLabel('4K · 9:16 · 2160 x 3840'), '4K · 9:16 · 2160 x 3840');
  assert.equal(formatCompactResolutionLabel('4K · 2160×3840'), '4K · 2160×3840');
});
