import assert from 'node:assert/strict';
import test from 'node:test';

import { getEnginePictogram } from '../frontend/src/lib/engine-branding.ts';
import {
  getPartnerBrandMark,
  getPartnerByBrandId,
  getPartnerByEngineId,
} from '../frontend/src/lib/brand-partners.ts';

test('Happy Horse resolves to Alibaba logo assets', () => {
  const brand = getPartnerByBrandId('alibaba');

  assert.ok(brand);
  assert.equal(brand.label, 'Alibaba');
  assert.equal(brand.policy.logoAllowed, true);
  assert.equal(brand.wordmark?.light.src, '/brand/partners/alibaba/alibaba-wordmark.png');
  assert.equal(getPartnerByEngineId('happy-horse-1-0')?.id, 'alibaba');
  assert.equal(getPartnerByEngineId('alibaba/happy-horse/video-edit')?.id, 'alibaba');

  const mark = getPartnerBrandMark({ id: 'happy-horse-1-0', brandId: 'alibaba' });
  assert.equal(mark?.light.src, '/brand/partners/alibaba/alibaba-icon.png');
  assert.equal(mark?.dark.src, '/brand/partners/alibaba/alibaba-icon.png');
});

test('Alibaba fallback pictogram has theme-backed colors', () => {
  const pictogram = getEnginePictogram({ brandId: 'alibaba' }, 'Happy Horse 1.0');

  assert.equal(pictogram.code, 'Al');
  assert.equal(pictogram.backgroundColor, 'var(--engine-alibaba-bg)');
  assert.equal(pictogram.textColor, 'var(--engine-alibaba-ink)');
});
