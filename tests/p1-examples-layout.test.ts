import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';


const masonry = readFileSync('frontend/components/examples/examples-masonry.module.css', 'utf8');
const card = readFileSync('frontend/components/examples/ExampleGalleryCard.tsx', 'utf8');
const filterNav = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-engine-filter-nav.tsx',
  'utf8',
);
const header = readFileSync('frontend/components/HeaderBar.tsx', 'utf8');
const navigation = readFileSync('frontend/config/navigation.ts', 'utf8');

test('responsive opening uses a fixed CSS layout and native ratios in the continuation', () => {
  assert.match(masonry,/grid-template-columns:1\.77778fr \.5625fr 1fr/);
  assert.match(masonry,/@media\(max-width:767px\)/);
  assert.match(masonry,/aspect-ratio:16\/9/);
  assert.match(masonry,/aspect-ratio:9\/16/);
  assert.match(masonry,/flex:var\(--video-ratio\)/);
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

test('example cards preserve actual media ratios with explicit cropping for side previews only',()=>{
 assert.match(card,/galleryVideoRatio\(video\)/);
 assert.match(card,/frame==='side'\?styles.crop:styles.native/);
 assert.match(masonry,/object-fit:contain/);
 assert.match(masonry,/\.crop\{object-fit:cover/);
});
