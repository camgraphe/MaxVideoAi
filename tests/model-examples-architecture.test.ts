import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';

import type { ExampleGalleryVideo } from '../frontend/components/examples/examples-gallery-types.ts';
import { getModelExamplesUiCopy } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-ui-copy.ts';
import { buildModelExamplesViewModel } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-view-model.ts';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const ROOT = process.cwd();
const ROUTE_ROOT = path.join(
  ROOT,
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]',
);
const paths = {
  page: path.join(ROUTE_ROOT, 'page.tsx'),
  layout: path.join(ROUTE_ROOT, '_components/MarketingModelPageLayout.tsx'),
  contentSections: path.join(ROUTE_ROOT, '_components/ModelPageContentSections.tsx'),
  wrapper: path.join(ROUTE_ROOT, '_components/ModelExamplesSection.tsx'),
  decision: path.join(ROUTE_ROOT, '_components/ModelDecisionExamplesSection.tsx'),
  default: path.join(ROUTE_ROOT, '_components/ModelDefaultExamplesSection.tsx'),
  client: path.join(ROUTE_ROOT, '_components/ModelDecisionExamplesGallery.client.tsx'),
  parser: path.join(ROUTE_ROOT, '_lib/model-page-examples-content.ts'),
  viewModel: path.join(ROUTE_ROOT, '_lib/model-page-examples-view-model.ts'),
  uiCopy: path.join(ROUTE_ROOT, '_lib/model-page-examples-ui-copy.ts'),
  media: path.join(ROUTE_ROOT, '_lib/model-page-example-media.ts'),
  runtimePolicy: path.join(ROUTE_ROOT, '_lib/model-page-examples-runtime-policy.ts'),
  legacyProjector: path.join(ROUTE_ROOT, '_lib/model-page-examples-legacy.ts'),
  converter: path.join(ROOT, 'scripts/migrate-model-examples-content.ts'),
  legacyParityTest: path.join(ROOT, 'tests/model-examples-legacy-projection.test.ts'),
  audit: path.join(ROOT, 'scripts/models-audit.mjs'),
  legacyCopy: path.join(ROUTE_ROOT, '_lib/model-page-copy.ts'),
  legacyCopyTypes: path.join(ROUTE_ROOT, '_lib/model-page-specs-types.ts'),
};

const readSource = (filePath: string) => existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
const count = (source: string, token: string) => source.split(token).length - 1;
const lines = (source: string) => source.split('\n').length;

test('model Examples parses and builds once before rendering', () => {
  const layoutSource = readSource(paths.layout);

  assert.equal(count(layoutSource, 'parseModelExamplesContent('), 1);
  assert.equal(count(layoutSource, 'buildModelExamplesViewModel('), 1);
  assert.match(layoutSource, /examplesProps=\{\{\s*viewModel:\s*examplesViewModel/);
});

test('server Examples renderers accept only the render-ready view model', () => {
  const wrapperSource = readSource(paths.wrapper);
  const decisionSource = readSource(paths.decision);
  const defaultSource = readSource(paths.default);

  assert.ok(decisionSource, 'focused decision renderer should exist');
  assert.ok(defaultSource, 'focused default renderer should exist');
  for (const source of [wrapperSource, decisionSource, defaultSource]) {
    assert.doesNotMatch(
      source,
      /SoraCopy|AppLocale|ExampleGalleryVideo|engineSlug|galleryPreviewAlts|fallbackImageUrl/,
    );
    assert.doesNotMatch(source, /nano-banana|seedream|luma-|veo-|sora-|kling-|seedance-/i);
  }
  assert.match(wrapperSource, /viewModel:\s*ModelExamplesViewModel/);
  assert.match(decisionSource, /viewModel:\s*ModelExamplesViewModel/);
  assert.match(defaultSource, /viewModel:\s*ModelExamplesViewModel/);
});

test('active Examples ownership no longer imports the legacy projector', () => {
  const activeSource = [paths.layout, paths.wrapper, paths.decision, paths.default]
    .map(readSource)
    .join('\n');

  assert.doesNotMatch(activeSource, /model-page-examples-legacy|buildLegacyModelExamplesContent/);
});

test('temporary Examples migration owners are absent', () => {
  for (const filePath of [paths.legacyProjector, paths.converter, paths.legacyParityTest]) {
    assert.equal(existsSync(filePath), false, filePath);
  }
});

test('SoraCopy and buildSoraCopy contain no Examples ownership', () => {
  const source = [paths.legacyCopyTypes, paths.legacyCopy].map(readSource).join('\n');
  for (const key of ['galleryTitle', 'galleryIntro', 'galleryAllCta', 'gallerySceneCta', 'recreateLabel']) {
    assert.doesNotMatch(source, new RegExp(`\\b${key}\\b`));
  }
});

test('model audit requires strict Examples content and rejects legacy custom ownership', () => {
  const source = readSource(paths.audit);

  assert.match(source, /validateModelExamplesContent/);
  assert.match(source, /runLocalizedExamplesChecks/);
  assert.match(source, /localized_examples_parity_mismatch/);
  assert.match(source, /LEGACY_GALLERY_KEYS/);
  assert.match(source, /legacy_examples_ownership/);
});

test('client gallery consumes permanent filter and item contracts plus localized no-preview copy', () => {
  const clientSource = readSource(paths.client);

  assert.match(clientSource, /ModelExampleFilter/);
  assert.match(clientSource, /DecisionExampleFilterId/);
  assert.match(clientSource, /ModelExamplesGalleryItem/);
  assert.match(clientSource, /noPreviewLabel:\s*string/);
  assert.match(clientSource, /\{noPreviewLabel\}/);
  assert.doesNotMatch(clientSource, /export type DecisionExampleFilterId|export type DecisionExampleGalleryItem/);
});

test('dormant Examples CTA route plumbing is deleted', () => {
  const activeSource = [
    paths.page,
    paths.layout,
    paths.contentSections,
    paths.wrapper,
    paths.decision,
    paths.default,
    paths.client,
    paths.legacyCopy,
    paths.legacyCopyTypes,
  ].map(readSource).join('\n');

  assert.doesNotMatch(activeSource, /galleryCtaHref|gallerySceneCta/);
});

test('Examples files respect permanent line caps', () => {
  const cappedFiles = [
    [paths.wrapper, 120],
    [paths.decision, 220],
    [paths.default, 220],
    [paths.parser, 300],
    [paths.viewModel, 300],
    [paths.uiCopy, 160],
    [paths.media, 220],
    [paths.runtimePolicy, 180],
  ] as const;

  for (const [filePath, cap] of cappedFiles) {
    const source = readSource(filePath);
    assert.ok(source, `${path.basename(filePath)} should exist`);
    assert.ok(lines(source) <= cap, `${path.basename(filePath)} should stay at or below ${cap} lines`);
  }
});

test('default renderer localizes missing previews and hides recreate links without a label', async () => {
  const video: ExampleGalleryVideo = {
    id: 'job_no_preview',
    href: '/video/job_no_preview',
    engineLabel: 'Fixture Engine',
    engineIconId: 'fixture',
    priceLabel: null,
    prompt: 'A quiet product render.',
    aspectRatio: '16:9',
    durationSec: 6,
    hasAudio: false,
    optimizedPosterUrl: null,
    rawPosterUrl: null,
    recreateHref: '/app?engine=fixture&recreate=job_no_preview',
  };
  const viewModel = buildModelExamplesViewModel({
    content: {
      modelSlug: 'fixture',
      section: {
        title: 'Fixture examples',
        intro: 'Fixture intro',
        defaultCtaLabel: null,
        recreateLabel: null,
      },
      filters: [{ id: 'all', label: 'All' }],
      proofItems: [
        { id: 'one', icon: 'sparkles', title: 'One', body: 'One body' },
        { id: 'two', icon: 'zap', title: 'Two', body: 'Two body' },
        { id: 'three', icon: 'audio', title: 'Three', body: 'Three body' },
        { id: 'four', icon: 'users', title: 'Four', body: 'Four body' },
        { id: 'five', icon: 'shield', title: 'Five', body: 'Five body' },
      ],
      fallbackItems: null,
    },
    ui: getModelExamplesUiCopy('en'),
    locale: 'en',
    anchorId: 'text-to-video',
    modelName: 'Fixture',
    mode: 'video',
    audioMode: 'runtime',
    decisionAltMode: 'preview-alt',
    galleryVideos: [video],
    galleryPreviewAlts: new Map(),
    fallbackPosters: new Map(),
    examplesLinkHref: { pathname: '/examples' },
    imageWorkspaceHref: '/app/image?engine=fixture',
  });
  const { ModelDefaultExamplesSection } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDefaultExamplesSection.tsx'
  );
  const markup = renderToStaticMarkup(React.createElement(ModelDefaultExamplesSection, { viewModel }));

  assert.match(markup, />No preview</);
  assert.doesNotMatch(markup, /recreate=job_no_preview/);
});

test('decision renderer preserves localized copy, generic view-all, proof order, and gallery wiring', async () => {
  const video: ExampleGalleryVideo = {
    id: 'job_decision_fixture',
    href: '/video/job_decision_fixture',
    engineLabel: 'Fixture Engine',
    engineIconId: 'fixture',
    priceLabel: null,
    prompt: 'A cinematic product sprint with synchronized audio.',
    aspectRatio: '16:9',
    durationSec: 8,
    hasAudio: true,
    optimizedPosterUrl: null,
    rawPosterUrl: null,
    recreateHref: '/app?engine=fixture&recreate=job_decision_fixture',
  };
  const proofItems = [
    { id: 'one', icon: 'sparkles' as const, title: 'Proof one', body: 'One body' },
    { id: 'two', icon: 'zap' as const, title: 'Proof two', body: 'Two body' },
    { id: 'three', icon: 'audio' as const, title: 'Proof three', body: 'Three body' },
    { id: 'four', icon: 'users' as const, title: 'Proof four', body: 'Four body' },
    { id: 'five', icon: 'shield' as const, title: 'Proof five', body: 'Five body' },
  ];
  const viewModel = buildModelExamplesViewModel({
    content: {
      modelSlug: 'fixture',
      section: {
        title: 'Localized decision examples',
        intro: 'Localized decision intro',
        defaultCtaLabel: null,
        recreateLabel: 'Recreate fixture →',
      },
      filters: [
        { id: 'all', label: 'Everything' },
        { id: 'audio', label: 'With sound' },
      ],
      proofItems,
      fallbackItems: null,
    },
    ui: getModelExamplesUiCopy('en'),
    locale: 'en',
    anchorId: 'examples',
    modelName: 'Fixture',
    mode: 'video',
    audioMode: 'runtime',
    decisionAltMode: 'preview-alt',
    galleryVideos: [video],
    galleryPreviewAlts: new Map(),
    fallbackPosters: new Map(),
    examplesLinkHref: '/examples/fixture',
    imageWorkspaceHref: '/app/image?engine=fixture',
  });
  const { ModelDecisionExamplesSection } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionExamplesSection.tsx'
  );
  const { I18nProvider } = await import('../frontend/lib/i18n/I18nProvider.tsx');
  const markup = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      { locale: 'en', dictionary: {}, fallback: {} },
      React.createElement(ModelDecisionExamplesSection, { viewModel }),
    ),
  );

  assert.match(markup, /Localized decision examples/);
  assert.match(markup, /Localized decision intro/);
  assert.match(markup, />View all examples</);
  assert.match(markup, />Everything</);
  assert.match(markup, />With sound</);
  assert.match(markup, />No preview</);
  assert.match(markup, /Recreate fixture/);
  assert.deepEqual(
    proofItems.map(({ title }) => markup.indexOf(title)),
    [...proofItems.keys()].map((index) => markup.indexOf(proofItems[index].title)).sort((a, b) => a - b),
  );
  assert.match(markup, /lucide-sparkles[\s\S]*lucide-zap[\s\S]*lucide-audio-lines[\s\S]*lucide-users[\s\S]*lucide-shield-check/);
});
