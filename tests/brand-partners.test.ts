import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { getEnginePictogram } from '../frontend/src/lib/engine-branding.ts';
import {
  getPartnerBrandMark,
  getPartnerByBrandId,
  getPartnerByEngineId,
} from '../frontend/src/lib/brand-partners.ts';

const root = process.cwd();
const engineIconSource = readFileSync(join(root, 'frontend/components/ui/EngineIcon.tsx'), 'utf8');

test('Happy Horse resolves to Alibaba logo assets', () => {
  const brand = getPartnerByBrandId('alibaba');

  assert.ok(brand);
  assert.equal(brand.label, 'Alibaba');
  assert.equal(brand.policy.logoAllowed, true);
  assert.equal(brand.wordmark?.light.src, '/brand/partners/alibaba/alibaba-wordmark.png');
  assert.equal(getPartnerByEngineId('happy-horse-1-1')?.id, 'alibaba');
  assert.equal(getPartnerByEngineId('happy-horse-1-0')?.id, 'alibaba');
  assert.equal(getPartnerByEngineId('alibaba/happy-horse/v1.1/text-to-video')?.id, 'alibaba');
  assert.equal(getPartnerByEngineId('alibaba/happy-horse/video-edit')?.id, 'alibaba');

  const mark = getPartnerBrandMark({ id: 'happy-horse-1-1', brandId: 'alibaba' });
  assert.equal(mark?.light.src, '/brand/partners/alibaba/alibaba-icon.png');
  assert.equal(mark?.dark.src, '/brand/partners/alibaba/alibaba-icon.png');
});

test('Alibaba fallback pictogram has theme-backed colors', () => {
  const pictogram = getEnginePictogram({ brandId: 'alibaba' }, 'Happy Horse 1.1');

  assert.equal(pictogram.code, 'Al');
  assert.equal(pictogram.backgroundColor, 'var(--engine-alibaba-bg)');
  assert.equal(pictogram.textColor, 'var(--engine-alibaba-ink)');
});

test('Lightricks compact mark is optically scaled for small engine icons', () => {
  const mark = getPartnerBrandMark({ id: 'ltx-2-3-fast', brandId: 'lightricks' });

  assert.equal(mark?.light.src, '/brand/partners/lightricks/lightricks-mark-light.png');
  assert.equal(mark?.dark.src, '/brand/partners/lightricks/lightricks-mark-dark.png');
  assert.ok((mark?.light.scale ?? 0) >= 1.4, `expected light scale to zoom the padded mark, got ${mark?.light.scale}`);
  assert.ok((mark?.dark.scale ?? 0) >= 1.4, `expected dark scale to zoom the padded mark, got ${mark?.dark.scale}`);
});

test('EngineIcon allows oversized brand marks without global image max-width distortion', () => {
  assert.match(engineIconSource, /maxWidth: 'none'/);
});
