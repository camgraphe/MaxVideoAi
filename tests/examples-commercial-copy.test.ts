import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { buildWatchAnchorText } from '../frontend/components/examples/examples-gallery-helpers';
import { getHubExamplesFaq } from '../frontend/lib/examples/modelLandingFaq';
import {
  getExamplesGalleryUiCopy,
  getExamplesLongDescription,
  getExamplesMainVideoCopy,
} from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy';

const root = process.cwd();
const cardSource = readFileSync(join(root, 'frontend/components/examples/ExampleGalleryCard.tsx'), 'utf8');
const pageSource = readFileSync(
  join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/page.tsx'),
  'utf8'
);
const modelPageSource = readFileSync(
  join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/[model]/page.tsx'),
  'utf8'
);
const modelLandingSources = [
  'frontend/lib/examples/modelLanding.ts',
  'frontend/lib/examples/modelLandingData.en.ts',
  'frontend/lib/examples/modelLandingData.fr.ts',
  'frontend/lib/examples/modelLandingData.es.ts',
].map((path) => readFileSync(join(root, path), 'utf8')).join('\n');

const sample = {
  id: 'job_1',
  href: '/video/job_1',
  modelHref: '/models/kling-3-pro',
  recreateHref: '/app?from=job_1',
  engineLabel: 'Kling 3 Pro',
  engineIconId: 'kling',
  prompt: 'A train arriving at night',
  promptFull: 'A train arriving at night',
  durationSec: 8,
  aspectRatio: '16:9',
  hasAudio: true,
  rawPosterUrl: null,
  heroPosterUrl: null,
  previewVideoUrl: null,
  videoUrl: null,
  priceLabel: null,
} as Parameters<typeof buildWatchAnchorText>[1];

test('gallery affordance and accessible watch names describe settings and price', () => {
  assert.equal(getExamplesGalleryUiCopy('en').detailsCta, 'View settings & price');
  assert.equal(getExamplesGalleryUiCopy('fr').detailsCta, 'Voir réglages et prix');
  assert.equal(getExamplesGalleryUiCopy('es').detailsCta, 'Ver ajustes y precio');

  assert.match(buildWatchAnchorText('en', sample), /View settings and price for/);
  assert.match(buildWatchAnchorText('fr', sample), /Voir les réglages et le prix de/);
  assert.match(buildWatchAnchorText('es', sample), /Ver los ajustes y el precio de/);

  assert.match(cardSource, /aria-label=\{watchAnchorText\}/);
  assert.match(cardSource, /detailsCtaLabel/);
  assert.match(
    cardSource,
    /<video[^>]*aria-hidden="true"[^>]*>/,
    'the control-less inline preview should be decorative beside the named watch link'
  );
  assert.doesNotMatch(cardSource, /aria-label=\{altText\}/);
  assert.doesNotMatch(cardSource, /recreateHref|recreateLabel|showRecreateLink/);
});

test('localized Examples copy sends visitors to the detail page for recorded cost', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const description = getExamplesLongDescription(locale);
    const mainVideo = getExamplesMainVideoCopy(locale);
    const faq = getHubExamplesFaq(locale);
    assert.match(description, /recorded (?:render )?cost|coût enregistré|coût du rendu|coste registrado|coste del render/i);
    assert.match(mainVideo.openExample, /settings|réglages|ajustes/i);
    assert.match(faq.items[2]?.answer ?? '', /open|ouvrez|abre/i);
  }
});

test('Examples source no longer claims gallery cards display price per clip', () => {
  const falseClaim =
    /(?:visible\s+)?per[-\s]+clip\s+(?:price|prices|pricing)|(?:price|prices|pricing)\s+(?:shown\s+)?per[-\s]+clip|prix\s+par\s+clip|precios?\s+por\s+clip/i;
  for (const unsupportedClaim of [
    'visible per-clip pricing',
    'per-clip pricing',
    'per-clip price',
    'pricing shown per clip',
    'precios por clip',
  ]) {
    assert.match(unsupportedClaim, falseClaim);
  }
  assert.doesNotMatch(pageSource, falseClaim);
  assert.doesNotMatch(modelPageSource, falseClaim);
  assert.doesNotMatch(modelLandingSources, falseClaim);

  for (const locale of ['en', 'fr', 'es'] as const) {
    const messages = JSON.parse(readFileSync(join(root, `frontend/messages/${locale}.json`), 'utf8')) as {
      examples: { hero: { body: string } };
      gallery: { meta: { description: string; description_engine: string } };
    };
    assert.doesNotMatch(messages.examples.hero.body, falseClaim);
    assert.doesNotMatch(messages.gallery.meta.description, falseClaim);
    assert.doesNotMatch(messages.gallery.meta.description_engine, falseClaim);
  }
});
