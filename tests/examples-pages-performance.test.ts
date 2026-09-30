import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const examplesPageViewSource = readFileSync(
  "frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-page-view.tsx",
  'utf8'
);
const examplesHeroVideoSource = readFileSync('frontend/components/examples/ExamplesHeroVideo.client.tsx', 'utf8');
const marketingNavSource = readFileSync('frontend/components/marketing/MarketingNav.tsx', 'utf8');
const marketingMobileMenuSource = readFileSync('frontend/components/marketing/MarketingMobileMenu.tsx', 'utf8');

test('examples hero video keeps mobile rendering poster-first instead of autoplay loading media', () => {
  assert.match(examplesHeroVideoSource, /max-width:\s*767px/);
  assert.match(examplesHeroVideoSource, /mobile/i);
  assert.match(examplesHeroVideoSource, /preload="none"/);
});

test('examples hero video avoids fetching the raw poster in addition to the optimized overlay', () => {
  assert.doesNotMatch(examplesHeroVideoSource, /<video[\s\S]*poster=\{poster \?\? undefined\}/);
});

test('examples gallery links do not prefetch RSC routes during initial render', () => {
  assert.match(examplesPageViewSource, /<ExamplesGallerySection/);
  const card=readFileSync('frontend/components/examples/ExampleGalleryCard.tsx','utf8');
  assert.match(card, /<Link href=\{video.href\}[\s\S]{0,100}prefetch=\{false\}/);
});

test('marketing nav login links avoid prefetching app redirects on public pages', () => {
  for (const source of [marketingNavSource, marketingMobileMenuSource]) {
    assert.match(source, /buildLoginHref\(\{ mode: 'signin', nextPath: '\/app', locale \}\)/);
    assert.match(source, /<Link\s+href=\{loginHref\}[\s\S]{0,220}?prefetch=\{false\}/);
  }
});
