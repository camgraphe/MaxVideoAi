import assert from 'node:assert/strict';
import test from 'node:test';

import { formatImageResolutions } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-spec-values';

test('image model specs prefer provider resolution tiers over internal pixel mappings', () => {
  assert.equal(
    formatImageResolutions({
      resolutions: ['2K', '3K', '4K', '2048x2048', '2304x1728', '1728x2304'],
    } as never),
    '2K / 3K / 4K'
  );
});

test('image model specs keep pixel-only resolution lists when no tier labels exist', () => {
  assert.equal(
    formatImageResolutions({
      resolutions: ['1024x1024', '1344x768'],
    } as never),
    '1024x1024 / 1344x768'
  );
});
