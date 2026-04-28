import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const nextConfig = require('../frontend/next.config.js');
const compareConfig = require('../frontend/config/compare-config.json');

const repoRoot = process.cwd();

test('removed vertical-shorts best-for URLs redirect to active UGC guide', async () => {
  const redirects = await nextConfig.redirects();

  const expectedRedirects = [
    ['/ai-video-engines/best-for/vertical-shorts', '/ai-video-engines/best-for/ugc-ads'],
    ['/fr/comparatif/best-for/vertical-shorts', '/fr/comparatif/best-for/ugc-ads'],
    ['/es/comparativa/best-for/vertical-shorts', '/es/comparativa/best-for/ugc-ads'],
  ];

  for (const [source, destination] of expectedRedirects) {
    assert.ok(
      redirects.some((redirect: { source: string; destination: string; permanent?: boolean }) => {
        return redirect.source === source && redirect.destination === destination && redirect.permanent === true;
      }),
      `${source} should permanently redirect to ${destination}`,
    );
  }
});

test('best-for config has localized content and keeps vertical-shorts removed', () => {
  const slugs = (compareConfig.bestForPages as Array<{ slug: string }>).map((entry) => entry.slug);
  assert.ok(slugs.length > 0, 'best-for config should expose public guide slugs');
  assert.equal(slugs.includes('vertical-shorts'), false, 'vertical-shorts should not be a public best-for guide');

  for (const locale of ['en', 'fr', 'es']) {
    for (const slug of slugs) {
      const file = path.join(repoRoot, 'content', locale, 'best-for', `${slug}.mdx`);
      assert.equal(existsSync(file), true, `${locale} best-for content should exist for ${slug}`);
    }
    const removed = path.join(repoRoot, 'content', locale, 'best-for', 'vertical-shorts.mdx');
    assert.equal(existsSync(removed), false, `${locale} vertical-shorts content should stay removed`);
  }
});

test('Happy Horse model pages link best-use-case chips to localized Best-For guides', () => {
  const expectations = [
    {
      locale: 'en',
      expectedPrefix: '/ai-video-engines/best-for/',
      file: 'content/models/en/happy-horse-1-0.json',
    },
    {
      locale: 'fr',
      expectedPrefix: '/fr/comparatif/best-for/',
      file: 'content/models/fr/happy-horse-1-0.json',
    },
    {
      locale: 'es',
      expectedPrefix: '/es/comparativa/best-for/',
      file: 'content/models/es/happy-horse-1-0.json',
    },
  ] as const;

  for (const { locale, expectedPrefix, file } of expectations) {
    const json = JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8')) as {
      bestUseCases?: { items?: Array<{ href?: string }> };
    };
    const hrefs = json.bestUseCases?.items?.map((item) => item.href).filter(Boolean) ?? [];
    assert.equal(hrefs.length, 4, `${locale} Happy Horse should link all best-use-case chips`);
    for (const href of hrefs) {
      assert.ok(href?.startsWith(expectedPrefix), `${locale} Happy Horse best-use-case href should be localized: ${href}`);
    }
  }
});

test('homepage marketing media stays on optimized WebP sources', () => {
  const source = readFileSync(path.join(repoRoot, 'frontend/components/marketing/home/HomeRedesignSections.tsx'), 'utf8');
  const requiredAssets = [
    'frontend/public/hero/showcase-seedance-2-0.webp',
    'frontend/public/hero/showcase-kling-3-pro.webp',
    'frontend/public/hero/showcase-ltx-2-3-fast.webp',
    'frontend/public/hero/showcase-sora-2.webp',
    'frontend/public/hero/showcase-veo-3-1.webp',
    'frontend/public/assets/marketing/comparison-scorecard-transparent.webp',
  ];

  for (const asset of requiredAssets) {
    assert.equal(existsSync(path.join(repoRoot, asset)), true, `${asset} should exist`);
  }

  assert.doesNotMatch(source, /showcase-[a-z0-9-]+\.jpg/);
  assert.doesNotMatch(source, /comparison-scorecard-transparent\.png/);
  assert.match(source, /comparison-scorecard-transparent\.webp/);
});
