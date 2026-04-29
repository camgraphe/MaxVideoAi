import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const examplesPageSource = readFileSync("frontend/app/(localized)/[locale]/(marketing)/examples/page.tsx", 'utf8');
const examplesHeroVideoSource = readFileSync('frontend/components/examples/ExamplesHeroVideo.client.tsx', 'utf8');
const marketingNavSource = readFileSync('frontend/components/marketing/MarketingNav.tsx', 'utf8');

test('examples hero video keeps mobile rendering poster-first instead of autoplay loading media', () => {
  assert.match(examplesHeroVideoSource, /max-width:\s*767px/);
  assert.match(examplesHeroVideoSource, /mobile/i);
  assert.match(examplesHeroVideoSource, /preload="none"/);
});

test('examples model landing hero links do not prefetch RSC routes during initial render', () => {
  assert.match(
    examplesPageSource,
    /<Link\s+href=\{mainVideo\.card\.href\}[\s\S]{0,220}?prefetch=\{false\}/
  );
  assert.match(
    examplesPageSource,
    /<Link\s+href=\{mainVideo\.card\.modelHref\}[\s\S]{0,220}?prefetch=\{false\}/
  );
});

test('marketing nav login links avoid prefetching app redirects on public pages', () => {
  const loginLinks = marketingNavSource.match(/<Link\s+href="\/login\?next=\/app"[\s\S]*?<\/Link>/g) ?? [];

  assert.equal(loginLinks.length, 2);
  for (const link of loginLinks) {
    assert.match(link, /prefetch=\{false\}/);
  }
});
