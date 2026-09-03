import assert from 'node:assert/strict';
import test from 'node:test';

import type { ModelGalleryCard } from '../frontend/components/marketing/ModelsGallery.tsx';
import { buildModelsCatalogDecisionData } from '../frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data.ts';

const HERO_PICK_IDS = [
  'ltx-2-5-pro',
  'wan-3-prime',
  'grok-imagine-video-1-5',
  'flux-3',
  'seedance-2-5',
  'seedance-2-0',
  'kling-3-pro',
  'veo-3-1',
  'happy-horse-1-1',
] as const;

const cards = HERO_PICK_IDS.map((id, index) => ({
  id,
  label: id,
  href: { pathname: '/models/[slug]', params: { slug: id } },
  overallScore: 9 - index / 10,
})) as unknown as ModelGalleryCard[];

test('models hero stops recommendations at Seedance 2.5 while the full section keeps later models', () => {
  const decision = buildModelsCatalogDecisionData({ activeLocale: 'en', cards });

  assert.deepEqual(decision.topPicks.map(({ id }) => id), [
    'ltx-2-5-pro',
    'wan-3-prime',
    'grok-imagine-video-1-5',
    'flux-3',
    'seedance-2-5',
  ]);
  assert.deepEqual(
    decision.recommendedCards
      .map(({ id }) => id)
      .filter((id) => ['seedance-2-0', 'kling-3-pro', 'veo-3-1', 'happy-horse-1-1'].includes(id)),
    ['seedance-2-0', 'kling-3-pro', 'veo-3-1', 'happy-horse-1-1'],
  );
});
