import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const examplesPageViewSource = readFileSync(
  "frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-page-view.tsx",
  'utf8'
);
const examplesMainVideoFeatureSource = readFileSync(
  "frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-main-video-feature.tsx",
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

test('examples model landing hero links do not prefetch RSC routes during initial render', () => {
  assert.match(examplesPageViewSource, /<ExamplesMainVideoFeature/);
  assert.match(
    examplesMainVideoFeatureSource,
    /<Link\s+[\s\S]{0,180}?href=\{exampleHref\}[\s\S]{0,220}?prefetch=\{false\}/
  );
  assert.match(
    examplesMainVideoFeatureSource,
    /<Link\s+[\s\S]{0,180}?href=\{modelHref\}[\s\S]{0,220}?prefetch=\{false\}/
  );
});

test('marketing nav login links avoid prefetching app redirects on public pages', () => {
  const loginLinks = `${marketingNavSource}\n${marketingMobileMenuSource}`.match(/<Link\s+href="\/login\?next=\/app"[\s\S]*?<\/Link>/g) ?? [];

  assert.equal(loginLinks.length, 2);
  for (const link of loginLinks) {
    assert.match(link, /prefetch=\{false\}/);
  }
});
