import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import compareConfig from '../frontend/config/compare-config.json' with { type: 'json' };
import scoresFile from '../data/benchmarks/engine-scores.v1.json' with { type: 'json' };
import type { ExampleGalleryVideo } from '../frontend/components/examples/examples-gallery-types.ts';
import { MARKETING_MODEL_SLUGS, MARKETING_NAV_COMPARE, MARKETING_NAV_MODELS } from '../frontend/config/navigation.ts';
import { canonicalizeFalModelSlug, listFalEngines } from '../frontend/src/config/falEngines.ts';
import { buildModelDecisionDataFromContent } from './helpers/model-decision-content.ts';
import { PREFERRED_MEDIA } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';
import { buildPricingHubData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts';
import { isPrelaunchAvailability } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-pricing.ts';
import { getComparePageOverride } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';
import { getPublishedComparisonSlugs } from '../frontend/lib/compare-hub/data.ts';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts';
import { getModelExamplesUiCopy } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-ui-copy.ts';
import { buildModelExamplePreviewAlts, resolveModelExamplesRuntimePolicy } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-runtime-policy.ts';
import { buildModelExamplesViewModel } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-view-model.ts';

const PROJECT_ROOT = process.cwd();
const LOCALES = ['en', 'fr', 'es'] as const;
const PRIMARY_COMPARE_SLUG = 'gemini-omni-flash-vs-veo-3-1';
const OMNI_COMPARE_SLUGS = [
  PRIMARY_COMPARE_SLUG,
  'gemini-omni-flash-vs-veo-3-1-fast',
  'gemini-omni-flash-vs-sora-2',
  'gemini-omni-flash-vs-seedance-2-0',
] as const;
const SCORE_FIELDS = [
  'fidelity',
  'visualQuality',
  'motion',
  'anatomy',
  'textRendering',
  'consistency',
  'lipsyncQuality',
  'sequencingQuality',
  'controllability',
  'speedStability',
  'pricing',
] as const;

function readModelContent(locale: (typeof LOCALES)[number]) {
  const raw = readFileSync(join(PROJECT_ROOT, 'content', 'models', locale, 'gemini-omni-flash.json'), 'utf8');
  const data = JSON.parse(raw) as Record<string, unknown> & { prompting?: unknown };
  return {
    raw,
    data,
    prompting: parseModelPromptingContent(
      data.prompting,
      'gemini-omni-flash',
      locale,
      `content/models/${locale}/gemini-omni-flash.json#prompting`,
    ),
  };
}

test('Gemini Omni Flash has localized model content with non-cannibalizing internal links', () => {
  const expectedLinks = {
    en: ['/app?engine=gemini-omni-flash', '/ai-video-engines/gemini-omni-flash-vs-veo-3-1', '/pricing#gemini-omni-flash-pricing'],
    fr: ['/app?engine=gemini-omni-flash', '/fr/comparatif/gemini-omni-flash-vs-veo-3-1', '/fr/tarifs#gemini-omni-flash-pricing'],
    es: ['/app?engine=gemini-omni-flash', '/es/comparativa/gemini-omni-flash-vs-veo-3-1', '/es/precios#gemini-omni-flash-pricing'],
  };

  for (const locale of LOCALES) {
    const { raw, data, prompting } = readModelContent(locale);
    assert.equal(data.marketingName, 'Gemini Omni Flash');
    assert.match(raw, /720p/i);
    assert.match(raw, /10\s*(?:s|seconds|secondes|segundos)/i);
    assert.match(raw, /previous interaction id/i);
    assert.match(raw, /reference/i);
    assert.match(raw, /Golden-hour rooftop/i);
    assert.match(raw, /Sound direction/i);
    assert.match(raw, /Camera direction/i);
    assert.deepEqual(prompting.tabs, []);
    assert.deepEqual(prompting.globalPrinciples, []);
    assert.deepEqual(prompting.engineWhy, []);
    assert.ok(prompting.demo, `${locale} Gemini Omni should expose a Prompt Lab demo`);
    assert.match(prompting.demo.prompt, /Golden-hour rooftop/i);
    assert.match(prompting.demo.prompt, /Sound direction/i);
    assert.match(prompting.demo.prompt, /Camera direction/i);
    assert.equal(prompting.demo.presentationOverrides.audioChipMode, 'media');
    assert.match(prompting.demo.presentationOverrides.modeLabel, /10\s*s|10s/i);
    assert.ok(prompting.demo.presentationOverrides.altContext.trim().length > 0);
    assert.doesNotMatch(raw, /will be published after approved|seront publies apres validation|se publicaran despues/i);
    assert.doesNotMatch(raw, /fal\.ai|\bFal\b|\bFAL\b/);
    assert.doesNotMatch(raw, /Vertex implementation tutorial/i);
    for (const href of expectedLinks[locale]) {
      assert.match(raw, new RegExp(href.replaceAll('.', '\\.').replaceAll('?', '\\?')));
    }
  }
});

test('Gemini Omni Flash model page uses approved hero and demo render IDs', () => {
  assert.deepEqual(PREFERRED_MEDIA['gemini-omni-flash'], {
    hero: 'job_bd1604b7-ae90-45eb-9a65-fb6d44dfffe9',
    demo: 'job_bbc31801-7191-4d40-90b7-6b52bdeb1a7a',
  });
});

test('Gemini Omni Flash Examples preserve current localized sections and approved media links', () => {
  const slug = 'gemini-omni-flash';
  const mediaIds = [
    'job_bd1604b7-ae90-45eb-9a65-fb6d44dfffe9',
    'job_bbc31801-7191-4d40-90b7-6b52bdeb1a7a',
  ];
  const galleryVideos: ExampleGalleryVideo[] = mediaIds.map((id, index) => ({
    id,
    href: `/video/${id}`,
    engineLabel: 'Gemini Omni Flash',
    engineIconId: 'google',
    priceLabel: null,
    prompt: index === 0
      ? 'A cinematic rooftop character performance with camera direction.'
      : 'A portrait close-up with synchronized dialogue and city ambience.',
    aspectRatio: '16:9',
    durationSec: 10,
    hasAudio: true,
    optimizedPosterUrl: `/omni-${index + 1}.webp`,
    recreateHref: `/app?engine=${slug}&recreate=${id}`,
  }));
  const expected = {
    en: { title: 'Gemini Omni Flash examples', recreate: 'Recreate this shot' },
    fr: { title: 'Exemples Gemini Omni Flash', recreate: 'Recreer ce plan' },
    es: { title: 'Ejemplos de Gemini Omni Flash', recreate: 'Recrear esta toma' },
  } as const;

  for (const locale of LOCALES) {
    const content = parseModelExamplesContent(readModelContent(locale).data.examples, slug, locale);
    const ui = getModelExamplesUiCopy(locale);
    const policy = resolveModelExamplesRuntimePolicy({ modelSlug: slug, engineId: slug });
    const galleryPreviewAlts = buildModelExamplePreviewAlts({
      galleryVideos,
      locale,
      modelName: 'Gemini Omni Flash',
      mode: policy.previewAltMode,
      numberedExampleLabel: ui.numberedExampleLabel,
    });
    const viewModel = buildModelExamplesViewModel({
      content,
      ui,
      locale,
      anchorId: 'text-to-video',
      modelName: 'Gemini Omni Flash',
      mode: 'video',
      audioMode: policy.audioMode,
      decisionAltMode: policy.decisionAltMode,
      galleryVideos,
      galleryPreviewAlts,
      fallbackPosters: new Map(),
      examplesLinkHref: { pathname: '/examples/[model]', params: { model: slug } },
      imageWorkspaceHref: `/app/image?engine=${slug}`,
    });

    assert.equal(viewModel.section.title, expected[locale].title);
    assert.equal(viewModel.section.defaultCtaLabel, null);
    assert.deepEqual(viewModel.decision.items.map(({ id }) => id), mediaIds);
    assert.deepEqual(viewModel.decision.items.map(({ href }) => href), mediaIds.map((id) => `/video/${id}`));
    assert.ok(viewModel.decision.items.every(({ recreateLabel }) => recreateLabel === expected[locale].recreate));
    assert.deepEqual(viewModel.filters.map(({ id }) => id), ['all', 'cinematic', 'audio']);
  }
});

test('Gemini Omni Flash aliases canonicalize to the public model slug', () => {
  for (const alias of ['google-omni-flash', 'omni-flash', 'gemini-omni', 'gemini-omni-flash-preview']) {
    assert.equal(canonicalizeFalModelSlug(alias), 'gemini-omni-flash');
  }
});

test('Gemini Omni Flash decision template exposes app, pricing, specs and Veo comparison paths', () => {
  const engine = listFalEngines().find((candidate) => candidate.modelSlug === 'gemini-omni-flash');
  assert.ok(engine, 'Gemini Omni Flash engine should exist');

  for (const locale of LOCALES) {
    const decision = buildModelDecisionDataFromContent({ engine, locale });
    assert.ok(decision, `${locale} decision data should exist`);
    assert.equal(decision.hero.primaryCta.href, '/app?engine=gemini-omni-flash');
    assert.ok(decision.hero.quickLinks.some((link) => link.href.includes('gemini-omni-flash-vs-veo-3-1')));
    assert.ok(decision.hero.quickLinks.some((link) => link.href.includes('gemini-omni-flash-pricing')));
    assert.ok(decision.hero.quickLinks.some((link) => link.href === '#specs'));
    assert.match(JSON.stringify(decision), /Veo 3\.1/);
    assert.doesNotMatch(JSON.stringify(decision), /fal\.ai|\bFal\b|\bFAL\b/);
  }
});

test('Gemini Omni Flash is exposed on the pricing matrix with a visible 10s 720p price', () => {
  const expectedModelHrefs = {
    en: '/models/gemini-omni-flash',
    fr: '/fr/modeles/gemini-omni-flash',
    es: '/es/modelos/gemini-omni-flash',
  };

  for (const locale of LOCALES) {
    const row = buildPricingHubData(locale).video.rows.find((candidate) => candidate.anchorId === 'gemini-omni-flash-pricing');
    assert.ok(row, `${locale} pricing row should include Gemini Omni Flash`);
    assert.equal(row.engineName, 'Gemini Omni Flash');
    assert.equal(row.family, 'veo');
    assert.equal(row.modelHref, expectedModelHrefs[locale]);
    assert.ok(row.links.some((link) => link.href === '/app?engine=gemini-omni-flash'));

    const previewQuote = row.quotes['10s-720p'];
    assert.equal(previewQuote.status, 'exact');
    assert.equal(previewQuote.amountCents, 130);
    assert.match(previewQuote.rateDisplay ?? '', /0[,.]13/);

    const standard1080Quote = row.quotes['10s-1080p'];
    assert.equal(standard1080Quote.status, 'unsupported');
    assert.match(standard1080Quote.note ?? '', /720p/i);
  }
});

test('Gemini Omni Flash comparison pages are published as scorecard-only with localized overrides', () => {
  const publishedSlugs = getPublishedComparisonSlugs();
  for (const slug of OMNI_COMPARE_SLUGS) {
    assert.ok(compareConfig.scoreboardOnlyComparisons.includes(slug), `${slug} should be scorecard-only at launch`);
    assert.ok(publishedSlugs.includes(slug), `${slug} should be a published comparison slug`);
  }

  const englishComparison = getComparePageOverride('en', PRIMARY_COMPARE_SLUG);
  const frenchComparison = getComparePageOverride('fr', PRIMARY_COMPARE_SLUG);
  const spanishComparison = getComparePageOverride('es', PRIMARY_COMPARE_SLUG);
  assert.ok(englishComparison, 'missing EN Omni vs Veo override');
  assert.ok(frenchComparison, 'missing FR Omni vs Veo override');
  assert.ok(spanishComparison, 'missing ES Omni vs Veo override');
  assert.match(englishComparison.heroIntro ?? '', /scorecard\/specs page/);
  assert.match(englishComparison.quickVerdict?.body ?? '', /first\/last-frame|extend/i);
});

test('Gemini Omni Flash limited preview is not labeled as pre-launch on compare pages', () => {
  const entry = engineCatalog.find((candidate) => candidate.modelSlug === 'gemini-omni-flash');
  assert.ok(entry, 'Gemini Omni Flash catalog entry should exist');
  assert.equal(entry.availability, 'limited');
  assert.equal(isPrelaunchAvailability(entry), false);
});

test('Gemini Omni Flash has benchmark scores and a promoted model-nav link', () => {
  const score = scoresFile.scores.find((entry) => entry.modelSlug === 'gemini-omni-flash');
  assert.ok(score, 'Gemini Omni Flash should have a benchmark score row for compare scorecards');
  for (const field of SCORE_FIELDS) {
    assert.equal(typeof (score as Record<string, unknown>)[field], 'number', `gemini-omni-flash.${field} should be scored`);
  }
  assert.equal(score.controllability, 9);
  assert.equal(score.pricing, 8.4);

  assert.ok(MARKETING_MODEL_SLUGS.includes('gemini-omni-flash'));
  assert.ok(MARKETING_NAV_MODELS.some((item) => item.key === 'gemini-omni-flash'));
  assert.ok(MARKETING_NAV_COMPARE.some((item) => item.key === PRIMARY_COMPARE_SLUG));
  assert.ok(
    MARKETING_MODEL_SLUGS.indexOf('gemini-omni-flash') > MARKETING_MODEL_SLUGS.indexOf('veo-3-1'),
    'Gemini Omni Flash should sit inside the Google/Veo model cluster'
  );
  assert.ok(
    MARKETING_MODEL_SLUGS.indexOf('gemini-omni-flash') < MARKETING_MODEL_SLUGS.indexOf('veo-3-1-lite'),
    'Gemini Omni Flash should be promoted before the Lite variant'
  );
});
