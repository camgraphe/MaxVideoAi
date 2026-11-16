import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import { loadEngineKeySpecs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-key-specs';
import { buildModelPageSpecProjection } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-spec-projection';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content';
import { buildModelPromptingViewModel } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-view-model';
import { ModelDecisionPromptingSection } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptingSection';
import { ModelDecisionMediaCard } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionMediaCard';

const requireFrontend = createRequire(path.resolve('frontend/package.json'));
const React = requireFrontend('react');
const { renderToStaticMarkup } = requireFrontend('react-dom/server');
const { NextIntlClientProvider } = requireFrontend('next-intl');
const { ImageConfigContext } = requireFrontend('next/dist/shared/lib/image-config-context.shared-runtime');
const { imageConfigDefault } = requireFrontend('next/dist/shared/lib/image-config');
(globalThis as typeof globalThis & { React: typeof React }).React = React;

const modelIds = ['seedream-5-5', 'seedream-5-0-flash'];
const locales = ['en', 'fr', 'es'] as const;

test('Seedream image detail resolution options include every tier while benchmark maximum stays 2K', async () => {
  const specs = await loadEngineKeySpecs();
  for (const modelId of modelIds) for (const locale of locales) {
    const engine = getFalEngineById(modelId)!;
    const keySpecs = specs.get(modelId)?.keySpecs;
    assert.equal(keySpecs?.maxResolution, '2K');
    const result = buildModelPageSpecProjection({ engine, locale, isImageEngine: true, showPriceInSpecs: false, keySpecs });
    assert.equal(result.keySpecRows.find(row => row.key === 'maxResolution')?.value, '1K / 1.5K / 2K', `${modelId}/${locale}`);
    assert.equal(result.keySpecValues.maxResolution, '2K', 'Benchmark/hero maximum retains its separate meaning.');
  }
  const raster = getFalEngineById('gpt-image-2-6-flare')!;
  const result = buildModelPageSpecProjection({ engine: raster, locale: 'en', isImageEngine: true,
    showPriceInSpecs: false, keySpecs: { maxResolution: '4K' } });
  assert.equal(result.keySpecRows.find(row => row.key === 'maxResolution')?.value, '4K', 'Do not expand an unrelated raster-preset catalogue into a long spec row.');
});

test('localized Seedream prompting omits empty quirks cards and preserves populated guidance', () => {
  for (const modelId of modelIds) for (const locale of locales) {
    const document = JSON.parse(readFileSync(path.join('content/models', locale, `${modelId}.json`), 'utf8'));
    const content = parseModelPromptingContent(document.prompting, modelId, locale);
    const viewModel = buildModelPromptingViewModel({ content, locale, engineId: modelId, modelSlug: modelId,
      appGenerationEnabled: true, imageAnchorId: 'prompting', isVideoEngine: false, isImageEngine: true,
      supportsNativeAudio: false, demoPromptSource: 'editorial', defaultDemoPromptSource: 'editorial',
      demoMedia: null, defaultDemoPresentation: { audioBadgeLabel: '', altContext: '' }, referenceWorkflows: [] });
    assert.equal(viewModel.engineWhy.length, 0, `${modelId}/${locale}: reproduce the authored empty list`);
    const render = (model = viewModel) => new JSDOM(renderToStaticMarkup(React.createElement(NextIntlClientProvider,
      { locale, messages: {}, children: React.createElement(ModelDecisionPromptingSection, { viewModel: model }) })));
    const empty = render();
    try {
      const headings = [...empty.window.document.querySelectorAll('h3')].map(heading => heading.textContent);
      assert.equal(headings.includes(viewModel.ui.quirks), false, `${modelId}/${locale}: an empty list must not produce a card`);
      assert.ok(headings.includes(viewModel.ui.global), 'Keep the authored nonempty prompting principles.');
    } finally { empty.window.close(); }
    const populated = render({ ...viewModel, engineWhy: ['Keep the supplied product identity.'] });
    try {
      const heading = [...populated.window.document.querySelectorAll('h3')].find(heading => heading.textContent === viewModel.ui.quirks);
      assert.ok(heading, 'A nonempty quirks card remains available.');
      assert.ok(heading.closest('article')?.textContent?.includes('Keep the supplied product identity.'));
    } finally { populated.window.close(); }
  }
});

test('image hero badges share a wrapping overlay without changing poster geometry or priority', () => {
  const badges = ['Texte→Image', 'Image→Image', '1K / 1.5K / 2K'];
  const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, { locale: 'fr', messages: {},
    children: React.createElement(ImageConfigContext.Provider, { value: { ...imageConfigDefault, qualities: [80] },
      children: React.createElement(ModelDecisionMediaCard, {
      media: { id: 'illustration', prompt: null, videoUrl: null, previewVideoUrl: null,
        posterUrl: '/assets/models/seedream-hero.webp', href: null, durationSec: null, hasAudio: false, label: 'Illustration', aspectRatio: null },
      label: 'Illustration', description: 'Un visuel illustratif.', badges,
      renderLinkLabel: 'Voir', locale: 'fr', audioBadgeLabel: '', altContext: 'Illustration',
    }) }) }));
  const dom = new JSDOM(html);
  try {
    const spans = badges.map(label => [...dom.window.document.querySelectorAll('span')].find(span => span.textContent === label));
    for (const span of spans) assert.ok(span);
    const overlay = spans[0]!.parentElement!;
    assert.ok(overlay.classList.contains('flex-wrap'), 'All top badges must participate in one wrapping flow at mobile widths.');
    for (const span of spans) {
      assert.ok(overlay.contains(span!));
      assert.equal(span!.classList.contains('absolute'), false, 'Individual badges must not overlap through independent positioning.');
    }
    const figure = dom.window.document.querySelector('figure')!;
    assert.ok(figure.querySelector('.aspect-video'));
    const image = figure.querySelector('img')!;
    assert.equal(image.getAttribute('loading'), 'eager');
    assert.equal(image.getAttribute('fetchPriority'), 'high');
    assert.ok(image.getAttribute('src')?.includes('seedream-hero.webp'));
  } finally { dom.window.close(); }
});
