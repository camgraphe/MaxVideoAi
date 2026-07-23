import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const homeHeadPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/(home)/head.tsx');
const homeHeroPath = join(root, 'frontend/components/marketing/home/HomeHeroSection.tsx');
const homeLcpImagePath = join(root, 'frontend/components/marketing/home/home-lcp-image.ts');

const readSource = (path: string) => readFileSync(path, 'utf8');

test('homepage emits a deterministic responsive LCP preload without waiting for database content', () => {
  const headSource = readSource(homeHeadPath);
  const heroSource = readSource(homeHeroPath);

  assert.doesNotMatch(headSource, /getHomepageSlotsCached|async function Head/);
  assert.match(headSource, /getImageProps/);
  assert.match(headSource, /imageSrcSet=\{lcpPosterSrcSet\}/);
  assert.match(headSource, /imageSizes=\{HOME_LCP_POSTER_SIZES\}/);
  assert.equal(existsSync(homeLcpImagePath), true, 'homepage LCP image config should be shared by head and hero');

  const imageConfigSource = readSource(homeLcpImagePath);
  assert.match(imageConfigSource, /showcase-seedance-2-0\.webp/);
  assert.match(heroSource, /HOME_LCP_POSTER_SRC/);
  assert.match(heroSource, /engineId === HERO_VIDEO_ORDER\[0\]/);
});
