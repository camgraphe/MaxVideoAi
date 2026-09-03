import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  LANDSCAPE_SIZES,
  PORTRAIT_SIZES,
} from '../frontend/components/examples/examples-gallery-helpers.ts';

const masonry = readFileSync('frontend/components/examples/examples-masonry.module.css', 'utf8');
const media = readFileSync('frontend/components/examples/examples-media.module.css', 'utf8');
const card = readFileSync('frontend/components/examples/ExampleGalleryCard.tsx', 'utf8');
const filterNav = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-engine-filter-nav.tsx',
  'utf8',
);
const header = readFileSync('frontend/components/HeaderBar.tsx', 'utf8');
const navigation = readFileSync('frontend/config/navigation.ts', 'utf8');

function expectedColumnCount(viewportWidth: number) {
  if (viewportWidth >= 1280) return 3;
  if (viewportWidth >= 768) return 2;
  return 1;
}

test('examples keep their responsive fold at the four review widths', () => {
  assert.match(masonry, /column-count:\s*1/);
  assert.match(masonry, /@media \(min-width:\s*768px\)[\s\S]*?column-count:\s*2/);
  assert.match(masonry, /@media \(min-width:\s*1280px\)[\s\S]*?column-count:\s*3/);
  assert.deepEqual(
    [1440, 1024, 768, 390].map((width) => [width, expectedColumnCount(width)]),
    [[1440, 3], [1024, 2], [768, 2], [390, 1]],
  );
});

test('extra model and family filters scroll instead of widening the examples page', () => {
  assert.match(filterNav, /min-w-0 flex-1 overflow-x-auto overscroll-x-contain/);
  assert.match(filterNav, /flex w-max min-w-full items-center/);
  assert.match(filterNav, /shrink-0[\s\S]*whitespace-nowrap/);
  assert.match(navigation, /examples:\s*\{[\s\S]*desktopColumns:\s*2/);
  assert.match(header, /usesTwoColumnItems \? 'min-w-\[420px\] w-max'/);
  assert.match(header, /hasSections \? 'min-w-\[520px\] w-max'/);
  assert.match(header, /xl:flex/);
});

test('example cards preserve media proportions on mobile and desktop', () => {
  assert.equal(LANDSCAPE_SIZES, '(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw');
  assert.equal(PORTRAIT_SIZES, LANDSCAPE_SIZES);
  assert.match(card, /parseAspectRatio\(video\.aspectRatio\)/);
  assert.match(card, /--examples-mobile-media-padding/);
  assert.match(card, /--examples-desktop-media-padding/);
  assert.match(media, /padding-bottom:\s*var\(--examples-mobile-media-padding\)/);
  assert.match(media, /@media \(min-width:\s*768px\)[\s\S]*padding-bottom:\s*var\(--examples-desktop-media-padding\)/);
});
