import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import React from 'react';

const root = process.cwd();
const homeHeadPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/(home)/head.tsx');
const rootHomeHeadPath = join(root, 'frontend/app/(root)/head.tsx');
const homeHeroPath = join(root, 'frontend/components/marketing/home/HomeHeroSection.tsx');
const heroShowcasePath = join(root, 'frontend/components/marketing/home/HeroVideoShowcase.tsx');
const homeLcpImagePath = join(root, 'frontend/components/marketing/home/home-lcp-image.ts');
const homeLcpPosterComponentPath = join(root, 'frontend/components/marketing/home/HomeLcpPoster.tsx');
const desktopPosterPath = join(root, 'frontend/public/hero/showcase-minimax-h3-max-8s.webp');
const mobilePosterPath = join(root, 'frontend/public/hero/showcase-minimax-h3-max-8s-mobile.webp');
const require = createRequire(import.meta.url);
const nextConfig = require('../frontend/next.config.js') as {
  headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>;
};

const readSource = (path: string) => readFileSync(path, 'utf8');

test('homepage keeps responsive LCP discovery in the initial markup without duplicate route heads', () => {
  const heroSource = readSource(homeHeroPath);

  assert.equal(
    existsSync(homeHeadPath),
    false,
    'the homepage route head must not create a second responsive image request'
  );
  assert.equal(
    existsSync(rootHomeHeadPath),
    false,
    'the root route-group head must not leak the homepage preload onto non-home routes',
  );
  assert.equal(existsSync(homeLcpImagePath), true, 'homepage LCP image config should be shared by head and hero');

  const imageConfigSource = readSource(homeLcpImagePath);
  assert.match(imageConfigSource, /showcase-minimax-h3-max-8s\.webp/);
  assert.match(heroSource, /HOME_LCP_POSTER_SRC/);
  assert.match(heroSource, /engineId === HERO_VIDEO_ORDER\[0\]/);
  assert.ok(
    (heroSource.match(/prefetch=\{false\}/g) ?? []).length >= 3,
    'above-the-fold homepage CTAs must not compete with the LCP image through route prefetches',
  );
});

test('homepage renders a mobile source while preserving the exact desktop poster fallback', async () => {
  assert.equal(existsSync(homeLcpPosterComponentPath), true);
  const { HomeLcpPoster } = await import(
    '../frontend/components/marketing/home/HomeLcpPoster.tsx'
  );
  const picture = HomeLcpPoster({ alt: 'MiniMax H3 Max cinematic dancer scene' });
  const [source, image] = React.Children.toArray(picture.props.children) as Array<
    React.ReactElement<Record<string, unknown>>
  >;

  assert.equal(picture.type, 'picture');
  assert.equal(source.type, 'source');
  assert.equal(source.props.media, '(min-width: 768px)');
  assert.equal(source.props.srcSet, '/hero/showcase-minimax-h3-max-8s.webp');
  assert.equal(image.type, 'img');
  assert.equal(image.props.src, '/hero/showcase-minimax-h3-max-8s-mobile.webp');
  assert.equal(image.props.fetchPriority, 'high');
});

test('homepage mobile LCP asset is materially smaller than the unchanged desktop asset', () => {
  assert.equal(existsSync(mobilePosterPath), true);
  assert.equal(
    createHash('sha256').update(readFileSync(desktopPosterPath)).digest('hex'),
    '8677b969bbb7c9a8a458ddd1e7834e7b2c6b3947d46ea98ef1f5dd8d4eaacdf9',
    'the approved MiniMax H3 Max desktop poster must stay byte-for-byte unchanged'
  );
  assert.ok(statSync(mobilePosterPath).size <= 26_000, 'the mobile poster should stay within 26 KB');
  assert.ok(
    statSync(mobilePosterPath).size <= statSync(desktopPosterPath).size * 0.7,
    'the mobile poster should save at least 30% over the desktop poster'
  );
});

test('homepage avoids HTTP image preloads that make mobile fetch both responsive posters', async () => {
  const homeHeroSource = readSource(homeHeroPath);
  const heroShowcaseSource = readSource(heroShowcasePath);
  const headerRules = await nextConfig.headers();
  const homepageLinkHeaders = headerRules
    .filter((rule) => ['/', '/fr', '/es'].includes(rule.source))
    .flatMap((rule) => rule.headers)
    .filter((header) => header.key.toLowerCase() === 'link');

  assert.equal(
    homepageLinkHeaders.some((header) => header.value.includes('showcase-minimax-h3-max-8s')),
    false
  );
  assert.match(homeHeroSource, /unoptimizedPoster:\s*true/);
  assert.match(heroShowcaseSource, /<HomeLcpPoster alt=\{selected\.imageAlt\}/);
});
