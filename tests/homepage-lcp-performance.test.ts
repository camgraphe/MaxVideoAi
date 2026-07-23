import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const homeHeadPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/(home)/head.tsx');
const homeHeroPath = join(root, 'frontend/components/marketing/home/HomeHeroSection.tsx');
const heroShowcasePath = join(root, 'frontend/components/marketing/home/HeroVideoShowcase.tsx');
const homeLcpImagePath = join(root, 'frontend/components/marketing/home/home-lcp-image.ts');
const nextConfigPath = join(root, 'frontend/next.config.js');

const readSource = (path: string) => readFileSync(path, 'utf8');

test('homepage emits a deterministic responsive LCP preload without waiting for database content', () => {
  const headSource = readSource(homeHeadPath);
  const heroSource = readSource(homeHeroPath);

  assert.doesNotMatch(headSource, /getHomepageSlotsCached|async function Head/);
  assert.match(headSource, /getImageProps/);
  assert.match(headSource, /unoptimized:\s*true/);
  assert.equal(existsSync(homeLcpImagePath), true, 'homepage LCP image config should be shared by head and hero');

  const imageConfigSource = readSource(homeLcpImagePath);
  assert.match(imageConfigSource, /showcase-seedance-2-0\.webp/);
  assert.match(heroSource, /HOME_LCP_POSTER_SRC/);
  assert.match(heroSource, /engineId === HERO_VIDEO_ORDER\[0\]/);
});

test('homepage starts its exact unoptimized LCP poster from the HTTP response headers', () => {
  const nextConfigSource = readSource(nextConfigPath);
  const homeHeroSource = readSource(homeHeroPath);
  const heroShowcaseSource = readSource(heroShowcasePath);

  assert.match(nextConfigSource, /HOME_LCP_POSTER_SRC\s*=\s*['"]\/hero\/showcase-seedance-2-0\.webp['"]/);
  assert.match(nextConfigSource, /rel=preload;\s*as=image;\s*fetchpriority=high/);
  assert.match(nextConfigSource, /HOME_LCP_PRELOAD_PATHS/);
  assert.match(homeHeroSource, /unoptimizedPoster:\s*true/);
  assert.match(heroShowcaseSource, /unoptimized=\{selected\.unoptimizedPoster\}/);
});
