import assert from 'node:assert/strict';
import test from 'node:test';

import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import { buildCompareShowdownSlots } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-showdowns.ts';

type EngineCatalogEntry = (typeof engineCatalog)[number];

function getCatalogEntry(slug: string): EngineCatalogEntry {
  const entry = engineCatalog.find((candidate) => candidate.modelSlug === slug);
  assert.ok(entry, `Expected catalog entry for ${slug}`);
  return entry;
}

test('Happy Horse 1.1 compare pages hide showdowns until curated videos exist', async () => {
  const left = getCatalogEntry('happy-horse-1-1');
  const right = getCatalogEntry('kling-3-pro');

  const slots = await buildCompareShowdownSlots({
    activeLocale: 'en',
    canonicalSlug: 'happy-horse-1-1-vs-kling-3-pro',
    left,
    pairHasKling3Native4k: false,
    pairHasNativeAudio: true,
    right,
    shouldSwapDisplayOrder: false,
  });

  assert.deepEqual(slots, []);
});
