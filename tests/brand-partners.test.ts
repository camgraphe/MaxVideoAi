import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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

test('P0 engines resolve to their model owners while only unlicensed owners stay text-only', () => {
  const expectedOwners = {
    'wan-3': 'wan',
    'wan-3-prime': 'wan',
    'ltx-2-5-fast': 'lightricks',
    'ltx-2-5-pro': 'lightricks',
    'grok-imagine-video-1-5': 'xai',
    'flux-3': 'black-forest-labs',
    'flux-3-draft': 'black-forest-labs',
  } as const;

  for (const [engineId, brandId] of Object.entries(expectedOwners)) {
    assert.equal(getPartnerByEngineId(engineId)?.id, brandId, engineId);
  }

  const xai = getPartnerByBrandId('xai');
  assert.ok(xai);
  assert.equal(xai.policy.logoAllowed, true);
  assert.equal(xai.compactMark?.light.src, '/brand/partners/xai/grok-app-icon.png');
  assert.equal(xai.compactMark?.dark.src, '/brand/partners/xai/grok-app-icon.png');
  assert.equal(
    existsSync(join(root, 'frontend/public/brand/partners/xai/grok-app-icon.png')),
    true,
  );

  for (const brandId of ['black-forest-labs']) {
    const brand = getPartnerByBrandId(brandId);
    assert.ok(brand, brandId);
    assert.equal(brand.policy.logoAllowed, false, brandId);
    assert.equal(brand.policy.textOnly, true, brandId);
    assert.equal(brand.compactMark, undefined, brandId);
    assert.equal(brand.wordmark, undefined, brandId);
    assert.equal(getPartnerBrandMark({ brandId }), undefined, brandId);
  }
});
