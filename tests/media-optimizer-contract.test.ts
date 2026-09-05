import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { ImageOptimizerCache } from '../frontend/node_modules/next/dist/server/image-optimizer.js';
import { imageConfigDefault } from '../frontend/node_modules/next/dist/shared/lib/image-config.js';
import {
  GALLERY_POSTER_OPTIONS,
  HERO_POSTER_OPTIONS,
  buildOptimizedPosterUrl,
} from '../frontend/lib/media-helpers.ts';

const require = createRequire(import.meta.url);
const nextConfig = require('../frontend/next.config.js');
const completeNextConfig = {
  ...nextConfig,
  images: { ...imageConfigDefault, ...nextConfig.images },
};
const request = { headers: { accept: 'image/webp' } };

function parseOptimizerUrl(value: string | null): URL {
  assert.ok(value);
  return new URL(value, 'https://maxvideoai.com');
}

function assertAcceptedByNext(value: string | null): void {
  const url = parseOptimizerUrl(value);
  const result = ImageOptimizerCache.validateParams(
    request as never,
    Object.fromEntries(url.searchParams),
    completeNextConfig,
    false
  );
  assert.ok(!('errorMessage' in result), 'errorMessage' in result ? result.errorMessage : undefined);
}

test('named poster profiles produce optimizer URLs accepted by the actual Next config', () => {
  const source = 'https://media.maxvideoai.com/example.jpg';
  const hero = buildOptimizedPosterUrl(source, HERO_POSTER_OPTIONS);
  const gallery = buildOptimizedPosterUrl(source, GALLERY_POSTER_OPTIONS);

  assert.equal(parseOptimizerUrl(hero).searchParams.get('w'), '1080');
  assert.equal(parseOptimizerUrl(hero).searchParams.get('q'), '75');
  assert.equal(parseOptimizerUrl(gallery).searchParams.get('w'), '640');
  assert.equal(parseOptimizerUrl(gallery).searchParams.get('q'), '75');
  assertAcceptedByNext(hero);
  assertAcceptedByNext(gallery);
});

test('custom optimizer options normalize upward to admitted widths and nearest admitted quality', () => {
  const value = buildOptimizedPosterUrl('/examples/poster.jpg', { width: 641, quality: 60 });
  const url = parseOptimizerUrl(value);

  assert.equal(url.searchParams.get('url'), '/examples/poster.jpg');
  assert.equal(url.searchParams.get('w'), '750');
  assert.equal(url.searchParams.get('q'), '52');
  assertAcceptedByNext(value);
});

test('quality-only and invalid options never emit invalid optimizer parameters', () => {
  const qualityOnly = buildOptimizedPosterUrl('/examples/poster.jpg', { quality: 70 });
  const invalid = buildOptimizedPosterUrl('/examples/poster.jpg', {
    width: Number.NaN,
    quality: -4,
  });

  assert.equal(parseOptimizerUrl(qualityOnly).searchParams.get('w'), '1080');
  assert.equal(parseOptimizerUrl(qualityOnly).searchParams.get('q'), '70');
  assert.equal(parseOptimizerUrl(invalid).searchParams.get('w'), '1080');
  assert.equal(parseOptimizerUrl(invalid).searchParams.get('q'), '75');
  assertAcceptedByNext(qualityOnly);
  assertAcceptedByNext(invalid);
});

test('sources pass through when optimization is absent, unsafe, or already applied', () => {
  assert.equal(buildOptimizedPosterUrl(null, { width: 640 }), null);
  assert.equal(buildOptimizedPosterUrl(undefined, { width: 640 }), null);
  assert.equal(buildOptimizedPosterUrl('/examples/poster.jpg'), '/examples/poster.jpg');
  assert.equal(buildOptimizedPosterUrl('data:image/png;base64,abc', { width: 640 }), 'data:image/png;base64,abc');
  assert.equal(buildOptimizedPosterUrl('blob:https://maxvideoai.com/id', { width: 640 }), 'blob:https://maxvideoai.com/id');
  assert.equal(
    buildOptimizedPosterUrl('/_next/image?url=%2Fexamples%2Fposter.jpg&w=640&q=75', { width: 1080 }),
    '/_next/image?url=%2Fexamples%2Fposter.jpg&w=640&q=75'
  );
});
