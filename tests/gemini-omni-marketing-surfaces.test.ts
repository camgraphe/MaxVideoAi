import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import compareConfig from '../frontend/config/compare-config.json' with { type: 'json' };
import scoresFile from '../data/benchmarks/engine-scores.v1.json' with { type: 'json' };
import { MARKETING_MODEL_SLUGS, MARKETING_NAV_COMPARE, MARKETING_NAV_MODELS } from '../frontend/config/navigation.ts';
import { canonicalizeFalModelSlug, listFalEngines } from '../frontend/src/config/falEngines.ts';
import { buildModelDecisionData } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts';
import { EN_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts';
import { FR_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts';
import { ES_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts';
import { getPublishedComparisonSlugs } from '../frontend/lib/compare-hub/data.ts';

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
  return { raw, data: JSON.parse(raw) as Record<string, unknown> };
}

test('Gemini Omni Flash has localized model content with non-cannibalizing internal links', () => {
  const expectedLinks = {
    en: ['/app?engine=gemini-omni-flash', '/ai-video-engines/gemini-omni-flash-vs-veo-3-1', '/pricing#gemini-omni-flash-pricing'],
    fr: ['/app?engine=gemini-omni-flash', '/fr/comparatif/gemini-omni-flash-vs-veo-3-1', '/fr/tarifs#gemini-omni-flash-pricing'],
    es: ['/app?engine=gemini-omni-flash', '/es/comparativa/gemini-omni-flash-vs-veo-3-1', '/es/precios#gemini-omni-flash-pricing'],
  };

  for (const locale of LOCALES) {
    const { raw, data } = readModelContent(locale);
    assert.equal(data.marketingName, 'Gemini Omni Flash');
    assert.match(raw, /720p/i);
    assert.match(raw, /10\s*(?:s|seconds|secondes|segundos)/i);
    assert.match(raw, /previous interaction id/i);
    assert.match(raw, /reference/i);
    assert.doesNotMatch(raw, /fal\.ai|\bFal\b|\bFAL\b/);
    assert.doesNotMatch(raw, /Vertex implementation tutorial/i);
    for (const href of expectedLinks[locale]) {
      assert.match(raw, new RegExp(href.replaceAll('.', '\\.').replaceAll('?', '\\?')));
    }
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
    const decision = buildModelDecisionData({ engine, locale });
    assert.ok(decision, `${locale} decision data should exist`);
    assert.equal(decision.hero.primaryCta.href, '/app?engine=gemini-omni-flash');
    assert.ok(decision.hero.quickLinks.some((link) => link.href.includes('gemini-omni-flash-vs-veo-3-1')));
    assert.ok(decision.hero.quickLinks.some((link) => link.href.includes('gemini-omni-flash-pricing')));
    assert.ok(decision.hero.quickLinks.some((link) => link.href === '#specs'));
    assert.match(JSON.stringify(decision), /Veo 3\.1/);
    assert.doesNotMatch(JSON.stringify(decision), /fal\.ai|\bFal\b|\bFAL\b/);
  }
});

test('Gemini Omni Flash comparison pages are published as scorecard-only with localized overrides', () => {
  const publishedSlugs = getPublishedComparisonSlugs();
  for (const slug of OMNI_COMPARE_SLUGS) {
    assert.ok(compareConfig.scoreboardOnlyComparisons.includes(slug), `${slug} should be scorecard-only at launch`);
    assert.ok(publishedSlugs.includes(slug), `${slug} should be a published comparison slug`);
  }

  assert.ok(EN_COMPARE_PAGE_OVERRIDES[PRIMARY_COMPARE_SLUG], 'missing EN Omni vs Veo override');
  assert.ok(FR_COMPARE_PAGE_OVERRIDES[PRIMARY_COMPARE_SLUG], 'missing FR Omni vs Veo override');
  assert.ok(ES_COMPARE_PAGE_OVERRIDES[PRIMARY_COMPARE_SLUG], 'missing ES Omni vs Veo override');
  assert.match(EN_COMPARE_PAGE_OVERRIDES[PRIMARY_COMPARE_SLUG]?.heroIntro ?? '', /scorecard\/specs page/);
  assert.match(EN_COMPARE_PAGE_OVERRIDES[PRIMARY_COMPARE_SLUG]?.quickVerdict?.body ?? '', /first\/last-frame|extend/i);
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
