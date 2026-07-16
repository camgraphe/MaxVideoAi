import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import keySpecsFile from '../data/benchmarks/engine-key-specs.v1.json' with { type: 'json' };
import type { ExampleGalleryVideo } from '../frontend/components/examples/examples-gallery-types.ts';
import { getHubEngines } from '../frontend/lib/compare-hub/data.ts';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts';
import { getModelExamplesUiCopy } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-ui-copy.ts';
import { buildModelExamplePreviewAlts, resolveModelExamplesRuntimePolicy } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-runtime-policy.ts';
import { buildModelExamplesViewModel } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-view-model.ts';
import {
  buildSpecValues,
  formatMaxResolution,
} from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-values.ts';

type EngineCatalogEntry = (typeof engineCatalog)[number];

function getCatalogEntry(slug: string): EngineCatalogEntry {
  const entry = engineCatalog.find((candidate) => candidate.modelSlug === slug);
  assert.ok(entry, `Expected catalog entry for ${slug}`);
  return entry;
}

function getKeySpecs(slug: string): Record<string, unknown> {
  const entry = keySpecsFile.specs.find((candidate) => candidate.modelSlug === slug);
  assert.ok(entry?.keySpecs, `Expected benchmark key specs for ${slug}`);
  return entry.keySpecs;
}

test('Veo 3.1 Fast Examples keep the active real-media title instead of editorially replacing it', () => {
  const slug = 'veo-3-1-fast';
  const document = JSON.parse(
    readFileSync(join(process.cwd(), 'content', 'models', 'en', `${slug}.json`), 'utf8'),
  ) as { examples?: unknown };
  const content = parseModelExamplesContent(document.examples, slug, 'en');
  const ui = getModelExamplesUiCopy('en');
  const policy = resolveModelExamplesRuntimePolicy({ modelSlug: slug, engineId: slug });
  const media: ExampleGalleryVideo = {
    id: 'job_e34e8979-9056-4564-bbfd-27e8d886fa26',
    href: '/video/job_e34e8979-9056-4564-bbfd-27e8d886fa26',
    engineLabel: 'Veo 3.1 Fast',
    engineIconId: 'google',
    priceLabel: null,
    prompt: '8s 16:9 Veo 3.1 Fast desk draft with a presenter, slow handheld drift, soft typing, city ambience, and one short calm line.',
    aspectRatio: '16:9',
    durationSec: 8,
    hasAudio: true,
    optimizedPosterUrl: '/veo-fast.webp',
    recreateHref: '/app?engine=veo-3-1-fast&recreate=job_e34e8979-9056-4564-bbfd-27e8d886fa26',
  };
  const previewAlts = buildModelExamplePreviewAlts({
    galleryVideos: [media],
    locale: 'en',
    modelName: 'Veo 3.1 Fast',
    mode: policy.previewAltMode,
    numberedExampleLabel: ui.numberedExampleLabel,
  });
  const viewModel = buildModelExamplesViewModel({
    content,
    ui,
    locale: 'en',
    anchorId: 'text-to-video',
    modelName: 'Veo 3.1 Fast',
    mode: 'video',
    audioMode: policy.audioMode,
    decisionAltMode: policy.decisionAltMode,
    galleryVideos: [media],
    galleryPreviewAlts: previewAlts,
    fallbackPosters: new Map(),
    examplesLinkHref: { pathname: '/examples/[model]', params: { model: slug } },
    imageWorkspaceHref: '/app/image?engine=veo-3-1-fast',
  });

  assert.equal(viewModel.section.title, 'Example Gallery: Real Veo 3.1 Fast Outputs');
  assert.equal(
    viewModel.decision.items[0]?.title,
    '8s Veo 3.1 Fast desk draft with a presenter, slow handhel...',
  );
  assert.equal(viewModel.decision.items[0]?.href, media.href);
  assert.equal(viewModel.decision.items[0]?.audioBadgeLabel, 'Audio on');
});

test('Google Veo marketing cards and compare specs reflect 4K support by tier', () => {
  const standard = getCatalogEntry('veo-3-1');
  const fast = getCatalogEntry('veo-3-1-fast');
  const lite = getCatalogEntry('veo-3-1-lite');

  assert.equal(formatMaxResolution(standard), '4K');
  assert.equal(formatMaxResolution(fast), '4K');
  assert.equal(formatMaxResolution(lite), '1080p');

  const standardSpecs = buildSpecValues(standard, getKeySpecs('veo-3-1'));
  const fastSpecs = buildSpecValues(fast, getKeySpecs('veo-3-1-fast'));
  const liteSpecs = buildSpecValues(lite, getKeySpecs('veo-3-1-lite'));

  assert.equal(standardSpecs.maxResolution, '4K');
  assert.equal(fastSpecs.maxResolution, '4K');
  assert.equal(liteSpecs.maxResolution, '1080p');
  assert.equal(lite.engine.resolutions.includes('4k'), false);

  assert.equal(standardSpecs.aspectRatios, '16:9 / 9:16');
  assert.equal(fastSpecs.aspectRatios, '16:9 / 9:16');
  assert.equal(liteSpecs.aspectRatios, '16:9 / 9:16');

  assert.match(standardSpecs.referenceImageStyle, /1-3/);
  assert.match(fastSpecs.referenceImageStyle, /1-3/);
  assert.doesNotMatch(standardSpecs.referenceImageStyle, /1-4/);
  assert.doesNotMatch(fastSpecs.referenceImageStyle, /1-4/);

  const hubCards = new Map(getHubEngines().map((entry) => [entry.modelSlug, entry]));
  assert.equal(hubCards.get('veo-3-1')?.maxResolutionLabel, '4K');
  assert.equal(hubCards.get('veo-3-1-fast')?.maxResolutionLabel, '4K');
  assert.equal(hubCards.get('veo-3-1-lite')?.maxResolutionLabel, '1080p');
});

test('Google Veo compare specs expose lip sync consistently across all public tiers', () => {
  for (const slug of ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite']) {
    const entry = getCatalogEntry(slug);
    const specs = buildSpecValues(entry, getKeySpecs(slug));

    assert.equal(entry.features?.lipsync?.value, true, `${slug} should set the catalog lipsync feature`);
    assert.equal(specs.audioOutput, 'Supported');
    assert.equal(specs.nativeAudioGeneration, 'Supported');
    assert.equal(specs.lipSync, 'Supported');
  }
});
