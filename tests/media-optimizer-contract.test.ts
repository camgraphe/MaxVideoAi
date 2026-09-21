import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { getSharp, ImageOptimizerCache, optimizeImage } from '../frontend/node_modules/next/dist/server/image-optimizer.js';
import { imageConfigDefault } from '../frontend/node_modules/next/dist/shared/lib/image-config.js';
import {
  buildExamplePosterProjection,
  buildOptimizedPosterUrl,
} from '../frontend/lib/media-helpers.ts';

const require = createRequire(import.meta.url);
const nextConfig = require('../frontend/next.config.js');
const completeNextConfig = {
  ...nextConfig,
  images: { ...imageConfigDefault, ...nextConfig.images },
};
const request = { headers: { accept: 'image/webp' } };

test('the installed image decoder includes the libheif security fixes', () => {
  const sharp = getSharp(null);
  const [major, minor, patch] = sharp.versions.heif.split('.').map(Number);
  assert.ok(
    major > 1 || (major === 1 && (minor > 23 || (minor === 23 && patch >= 2))),
    `the installed libheif ${sharp.versions.heif} must include the 1.23.2 security fixes`
  );
});

for (const format of ['jpeg', 'png', 'webp', 'avif'] as const) {
  test(`Next still resizes ${format} input to a responsive WebP after decoder hardening`, async () => {
    const sharp = getSharp(null);
    const source = await sharp({
      create: { width: 256, height: 128, channels: 4, background: { r: 60, g: 120, b: 180, alpha: 0.5 } },
    }).toFormat(format).toBuffer();
    const output = await optimizeImage({ buffer: source, contentType: 'image/webp', quality: 75, width: 128 });
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 128);
    assert.equal(metadata.height, 64);
    assert.equal(metadata.hasAlpha, format !== 'jpeg');
  });
}

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

test('examples poster projection produces valid consumer fields for remote, local, and missing sources', () => {
  for (const source of ['https://media.maxvideoai.com/example.jpg', '/examples/poster.jpg']) {
    const projection = buildExamplePosterProjection(source, '/assets/frames/thumb-16x9.svg');

    assert.equal(parseOptimizerUrl(projection.heroPosterUrl).searchParams.get('w'), '1080');
    assert.equal(parseOptimizerUrl(projection.heroPosterUrl).searchParams.get('q'), '75');
    assert.equal(parseOptimizerUrl(projection.optimizedPosterUrl).searchParams.get('w'), '640');
    assert.equal(parseOptimizerUrl(projection.optimizedPosterUrl).searchParams.get('q'), '75');
    assert.equal(projection.rawPosterUrl, source);
    assertAcceptedByNext(projection.heroPosterUrl);
    assertAcceptedByNext(projection.optimizedPosterUrl);
  }

  assert.deepEqual(buildExamplePosterProjection(null, '/assets/frames/thumb-16x9.svg'), {
    heroPosterUrl: null,
    optimizedPosterUrl: null,
    rawPosterUrl: '/assets/frames/thumb-16x9.svg',
  });
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
