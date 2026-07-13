import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLocalizedModelPath } from '../frontend/config/model-registry';
import { getRuntimeModelById } from '../frontend/config/model-runtime';
import { localeRegions, type AppLocale } from '../frontend/i18n/locales';
import type { McpPublicationState } from '../frontend/lib/mcp-publication';
import { listFalEngines } from '../frontend/src/config/falEngines';
import {
  buildMcpBudgetOptions,
  type McpBudgetOption,
} from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-budget-options';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';
import { quotePublicPricing } from '../frontend/src/lib/pricing-public-quote';
import { getModelByEngineId } from '../frontend/src/lib/model-roster';

const livePublication: McpPublicationState = {
  renderPublicPage: true,
  indexable: true,
  showTrialClaim: true,
  showPaidGenerationClaim: true,
  showReferenceClaim: true,
};

function quoteScenario(engineId: string, durationSeconds: number, resolution: string): number {
  const entry = listFalEngines().find((candidate) => candidate.id === engineId);
  assert.ok(entry, `missing engine ${engineId}`);
  const facts = buildPublicPricingFacts({
    engine: entry.engine,
    durationSec: durationSeconds,
    resolution,
    mode: 't2v',
  });
  return quotePublicPricing({
    facts: facts.facts,
    scenario: {
      id: `mcp-budget-parity:${engineId}:${durationSeconds}:${resolution}`,
      engineId,
      mode: 't2v',
      resolution,
      membershipTier: 'member',
    },
    compatibilityProfileId: facts.compatibilityProfileId,
  }).customerTotalCents;
}

function option(options: McpBudgetOption[], slot: McpBudgetOption['slot']): McpBudgetOption {
  const match = options.find((candidate) => candidate.slot === slot);
  assert.ok(match, `missing ${slot} option`);
  return match;
}

test('budget options use the current canonical trial, lowest paid route, and capability upgrade', () => {
  const options = buildMcpBudgetOptions('en', livePublication);

  assert.deepEqual(options.map((candidate) => candidate.slot), [
    'included_trial',
    'lowest_paid',
    'affordable_upgrade',
  ]);
  assert.equal(options[0].engineId, 'seedance-2-0-mini');
  assert.equal(options[0].modelSlug, 'dreamina-seedance-2-0-mini');
  assert.equal(options[0].amountCents, null);
  assert.equal(options[0].priceSource, 'included_trial');

  assert.equal(options[1].engineId, 'pika-text-to-video');
  assert.equal(options[1].amountCents, 26);
  assert.equal(options[1].amountCents, quoteScenario('pika-text-to-video', 5, '720p'));
  assert.equal(options[1].priceSource, 'canonical_public_quote');

  assert.equal(options[2].engineId, 'wan-2-6');
  assert.equal(options[2].amountCents, quoteScenario('wan-2-6', 5, '720p'));
  assert.ok(options[1].amountCents! <= options[2].amountCents!);
});

test('the named public pricing scenarios stay locked to current canonical totals', () => {
  assert.equal(quoteScenario('ltx-2-3-fast', 6, '1080p'), 32);
  assert.equal(quoteScenario('wan-2-6', 5, '720p'), 65);
});

test('selected routes are current, public, enabled, non-legacy, and text-to-video compatible', () => {
  for (const selected of buildMcpBudgetOptions('en', livePublication)) {
    const entry = listFalEngines().find((candidate) => candidate.id === selected.engineId);
    const roster = getModelByEngineId(selected.engineId);
    const runtime = getRuntimeModelById(selected.engineId);

    assert.ok(entry);
    assert.ok(roster);
    assert.ok(runtime);
    assert.equal(entry.isLegacy, undefined);
    assert.equal(entry.modes.some((mode) => mode.mode === 't2v'), true);
    assert.equal(entry.engine.status, 'live');
    assert.equal(entry.engine.availability, 'available');
    assert.equal(entry.surfaces.app.enabled, true);
    assert.equal(entry.surfaces.pricing.includeInEstimator, true);
    assert.equal(roster.availability, 'available');
    assert.equal(roster.surfaces?.modelPage?.indexable, true);
    assert.equal(runtime.publication.examples.current, true);
  }
});

test('trial, paid, and reference-sensitive claims fail closed with publication gates', () => {
  const trialOnly = buildMcpBudgetOptions('en', {
    ...livePublication,
    showPaidGenerationClaim: false,
    showReferenceClaim: false,
  });
  assert.deepEqual(trialOnly.map((candidate) => candidate.slot), ['included_trial']);

  const paidOnly = buildMcpBudgetOptions('en', {
    ...livePublication,
    indexable: false,
    showTrialClaim: false,
  });
  assert.deepEqual(paidOnly.map((candidate) => candidate.slot), ['lowest_paid', 'affordable_upgrade']);
  assert.equal(paidOnly.some((candidate) => candidate.priceSource === 'included_trial'), false);

  const withoutReferenceClaim = buildMcpBudgetOptions('en', {
    ...livePublication,
    indexable: false,
    showReferenceClaim: false,
  });
  assert.equal(option(withoutReferenceClaim, 'affordable_upgrade').engineId, 'wan-2-6');
  assert.equal(
    withoutReferenceClaim.some((candidate) => /reference/i.test(candidate.scenarioLabel)),
    false,
  );

  assert.deepEqual(
    buildMcpBudgetOptions('en', {
      ...livePublication,
      indexable: false,
      showTrialClaim: false,
      showPaidGenerationClaim: false,
      showReferenceClaim: false,
    }),
    [],
  );
  assert.deepEqual(
    buildMcpBudgetOptions('en', {
      ...livePublication,
      renderPublicPage: false,
    }),
    [],
  );
});

test('labels, currency, and model links are stable and localized in English, French, and Spanish', () => {
  const expectations: Record<
    AppLocale,
    { included: string; silent: RegExp; trialHref: string; paidHref: string }
  > = {
    en: {
      included: 'Included',
      silent: /Silent/,
      trialHref: '/models/dreamina-seedance-2-0-mini',
      paidHref: '/models/pika-text-to-video',
    },
    fr: {
      included: 'Inclus',
      silent: /Sans audio/,
      trialHref: '/fr/modeles/dreamina-seedance-2-0-mini',
      paidHref: '/fr/modeles/pika-text-to-video',
    },
    es: {
      included: 'Incluido',
      silent: /Sin audio/,
      trialHref: '/es/modelos/dreamina-seedance-2-0-mini',
      paidHref: '/es/modelos/pika-text-to-video',
    },
  };

  for (const locale of ['en', 'fr', 'es'] as const) {
    const options = buildMcpBudgetOptions(locale, livePublication);
    const trial = option(options, 'included_trial');
    const paid = option(options, 'lowest_paid');
    const expected = expectations[locale];

    assert.equal(trial.priceLabel, expected.included);
    assert.equal(trial.modelHref, expected.trialHref);
    assert.equal(trial.modelHref, buildLocalizedModelPath(locale, trial.modelSlug));
    assert.equal(paid.modelHref, expected.paidHref);
    assert.equal(paid.modelHref, buildLocalizedModelPath(locale, paid.modelSlug));
    assert.equal(paid.currency, 'USD');
    assert.equal(
      paid.priceLabel,
      new Intl.NumberFormat(localeRegions[locale], {
        style: 'currency',
        currency: paid.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(paid.amountCents! / 100),
    );
    assert.match(paid.scenarioLabel, expected.silent);
    assert.doesNotMatch(paid.scenarioLabel, /provider|fal-ai|margin|token/i);
  }
});
