import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLocalizedModelPath } from '../frontend/config/model-registry';
import { getRuntimeModelById } from '../frontend/config/model-runtime';
import { localeRegions, type AppLocale } from '../frontend/i18n/locales';
import type { McpPublicationState } from '../frontend/lib/mcp-publication';
import { listFalEngines, type FalEngineEntry } from '../frontend/src/config/falEngines';
import {
  buildMcpBudgetOptions,
  type McpBudgetOptionsDependencies,
  type McpBudgetOption,
} from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-budget-options';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';
import { quotePublicPricing } from '../frontend/src/lib/pricing-public-quote';
import { getModelByEngineId } from '../frontend/src/lib/model-roster';

const livePublication: McpPublicationState = {
  renderPublicPage: true,
  connectionAvailable: true,
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

function defaultDependencies(): McpBudgetOptionsDependencies {
  return {
    listEngines: listFalEngines,
    getRosterByEngineId: getModelByEngineId,
    getRuntimeByEngineId: getRuntimeModelById,
    buildPricingFacts: buildPublicPricingFacts,
    quotePricing: quotePublicPricing,
  };
}

function withMutatedEngine(
  engineId: string,
  mutate: (entry: FalEngineEntry) => void,
): McpBudgetOptionsDependencies {
  const dependencies = defaultDependencies();
  const engines = dependencies.listEngines().map((entry) => {
    if (entry.id !== engineId) return entry;
    const copy = structuredClone(entry);
    mutate(copy);
    return copy;
  });
  return { ...dependencies, listEngines: () => engines };
}

function withOnlyEngine(
  engineId: string,
  mutate?: (entry: FalEngineEntry) => void,
): McpBudgetOptionsDependencies {
  const dependencies = defaultDependencies();
  const source = dependencies.listEngines().find((entry) => entry.id === engineId);
  assert.ok(source, `missing engine ${engineId}`);
  const entry = structuredClone(source);
  mutate?.(entry);
  return { ...dependencies, listEngines: () => [entry] };
}

type AuthoritativePaidRoute = {
  engineId: string;
  durationSeconds: number;
  resolution: string;
  amountCents: number;
  currency: string;
};

function parseAuthoritativeDuration(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.match(/\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function collectAuthoritativePaidRoutes(
  dependencies: McpBudgetOptionsDependencies,
): AuthoritativePaidRoute[] {
  const nonPublicApi = /\b(admin|internal|private|hidden|disabled|unavailable)\b/i;
  const routes: AuthoritativePaidRoute[] = [];

  for (const entry of dependencies.listEngines()) {
    const roster = dependencies.getRosterByEngineId(entry.id);
    const runtime = dependencies.getRuntimeByEngineId(entry.id);
    const t2v = entry.modes.find((mode) => mode.mode === 't2v');
    if (
      entry.id === 'seedance-2-0-mini' ||
      !roster ||
      !runtime ||
      !t2v ||
      (entry.category ?? 'video') !== 'video' ||
      entry.isLegacy ||
      entry.engine.isLab ||
      entry.availability !== 'available' ||
      entry.engine.availability !== 'available' ||
      entry.engine.status !== 'live' ||
      (entry.engine.apiAvailability && nonPublicApi.test(entry.engine.apiAvailability)) ||
      !entry.engine.modes.includes('t2v') ||
      !entry.surfaces.app.enabled ||
      !entry.surfaces.pricing.includeInEstimator ||
      !entry.surfaces.modelPage.indexable ||
      roster.availability !== 'available' ||
      roster.surfaces?.modelPage?.indexable !== true ||
      !runtime.publication.model.published ||
      !runtime.publication.examples.current ||
      !runtime.publication.app.published ||
      !runtime.publication.pricing.published ||
      typeof t2v.ui.audioToggle !== 'boolean' ||
      t2v.ui.audioToggle !== entry.engine.audio
    ) {
      continue;
    }

    const durationConfig = t2v.ui.duration;
    const durationValues =
      durationConfig && 'options' in durationConfig
        ? durationConfig.options
        : [durationConfig?.default];
    const durations = [...new Set(durationValues.map(parseAuthoritativeDuration))]
      .filter((value): value is number => Number.isSafeInteger(value) && value > 0);
    const engineResolutions = new Map(
      entry.engine.resolutions.map((resolution) => [
        String(resolution).toLowerCase(),
        String(resolution),
      ]),
    );
    const resolutionValues = t2v.ui.resolution?.length
      ? t2v.ui.resolution
      : entry.engine.resolutions.map(String);
    const resolutions = [...new Set(resolutionValues.flatMap((resolution) => {
      const exact = engineResolutions.get(String(resolution).toLowerCase());
      return exact && exact.toLowerCase() !== 'auto' ? [exact] : [];
    }))];

    for (const durationSeconds of durations) {
      for (const resolution of resolutions) {
        const scenarioId = `mcp-budget-authority:${entry.id}:${durationSeconds}:${resolution}`;
        try {
          const facts = dependencies.buildPricingFacts({
            engine: entry.engine,
            durationSec: durationSeconds,
            resolution,
            mode: 't2v',
          });
          const quote = dependencies.quotePricing({
            facts: facts.facts,
            scenario: {
              id: scenarioId,
              engineId: entry.id,
              mode: 't2v',
              resolution,
              membershipTier: 'member',
            },
            compatibilityProfileId: facts.compatibilityProfileId,
          });
          if (
            facts.facts.engineId !== entry.id ||
            facts.facts.quantity !== durationSeconds ||
            facts.base.seconds !== durationSeconds ||
            quote.engineId !== entry.id ||
            quote.scenarioId !== scenarioId ||
            quote.quantity !== durationSeconds ||
            quote.unit !== facts.facts.unit ||
            quote.currency !== facts.facts.currency ||
            !Number.isSafeInteger(quote.customerTotalCents) ||
            quote.customerTotalCents <= 0
          ) {
            continue;
          }
          routes.push({
            engineId: entry.id,
            durationSeconds,
            resolution,
            amountCents: quote.customerTotalCents,
            currency: quote.currency,
          });
        } catch {
          // An authoritative quote failure makes this route ineligible.
        }
      }
    }
  }

  return routes.sort(
    (left, right) =>
      left.amountCents - right.amountCents ||
      left.engineId.localeCompare(right.engineId) ||
      left.durationSeconds - right.durationSeconds ||
      left.resolution.localeCompare(right.resolution),
  );
}

function assertLowestMatchesAuthoritativeMinimum(
  dependencies: McpBudgetOptionsDependencies,
): void {
  const expected = collectAuthoritativePaidRoutes(dependencies)[0];
  assert.ok(expected, 'missing independently derived eligible paid route');
  const selected = option(
    buildMcpBudgetOptions('en', livePublication, dependencies),
    'lowest_paid',
  );
  assert.deepEqual(
    {
      engineId: selected.engineId,
      durationSeconds: selected.durationSeconds,
      resolution: selected.resolution,
      amountCents: selected.amountCents,
      currency: selected.currency,
    },
    expected,
  );
}

test('budget selection accepts injectable authoritative catalog and quote dependencies', () => {
  let catalogReads = 0;
  const dependencies = defaultDependencies();
  const options = buildMcpBudgetOptions('en', livePublication, {
    ...dependencies,
    listEngines: () => {
      catalogReads += 1;
      return dependencies.listEngines();
    },
  });

  assert.equal(catalogReads, 1);
  assert.deepEqual(options, buildMcpBudgetOptions('en', livePublication));
});

test('lowest paid is the independently derived minimum across exact eligible routes', () => {
  const dependencies = defaultDependencies();
  const expected = collectAuthoritativePaidRoutes(dependencies)[0];
  assert.ok(expected);
  assert.equal(expected.engineId, 'pika-text-to-video');
  assertLowestMatchesAuthoritativeMinimum(dependencies);
});

test('unavailable and disabled candidates are excluded and the minimum is recomputed', () => {
  const unavailable = withMutatedEngine('pika-text-to-video', (entry) => {
    entry.availability = 'unavailable';
  });
  const disabled = withMutatedEngine('pika-text-to-video', (entry) => {
    entry.surfaces.app.enabled = false;
  });

  for (const dependencies of [unavailable, disabled]) {
    assertLowestMatchesAuthoritativeMinimum(dependencies);
    assert.notEqual(
      option(
        buildMcpBudgetOptions('en', livePublication, dependencies),
        'lowest_paid',
      ).engineId,
      'pika-text-to-video',
    );
  }
});

test('quote failures recompute the minimum or hide paid options when none remain', () => {
  const dependencies = defaultDependencies();
  const withoutPika: McpBudgetOptionsDependencies = {
    ...dependencies,
    quotePricing: (input) => {
      if (input.scenario.engineId === 'pika-text-to-video') {
        throw new Error('injected quote failure');
      }
      return dependencies.quotePricing(input);
    },
  };
  assertLowestMatchesAuthoritativeMinimum(withoutPika);
  assert.notEqual(
    option(buildMcpBudgetOptions('en', livePublication, withoutPika), 'lowest_paid').engineId,
    'pika-text-to-video',
  );

  const withoutPaidQuotes: McpBudgetOptionsDependencies = {
    ...dependencies,
    quotePricing: (input) => {
      if (input.scenario.engineId !== 'seedance-2-0-mini') {
        throw new Error('injected paid quote failure');
      }
      return dependencies.quotePricing(input);
    },
  };
  assert.deepEqual(
    buildMcpBudgetOptions('en', livePublication, withoutPaidQuotes).map((candidate) => candidate.slot),
    ['included_trial'],
  );
});

test('clamped canonical facts cannot be displayed as the requested duration', () => {
  const dependencies = withMutatedEngine('pika-text-to-video', (entry) => {
    const t2v = entry.modes.find((mode) => mode.mode === 't2v');
    assert.ok(t2v);
    t2v.ui.duration = { options: [1], default: 1 };
  });
  const options = buildMcpBudgetOptions('en', livePublication, dependencies);

  assert.equal(
    options.some(
      (candidate) =>
        candidate.engineId === 'pika-text-to-video' && candidate.durationSeconds === 1,
    ),
    false,
  );
  assertLowestMatchesAuthoritativeMinimum(dependencies);
});

test('noninteger duration presets fail closed instead of being normalized', () => {
  const dependencies = withMutatedEngine('pika-text-to-video', (entry) => {
    const t2v = entry.modes.find((mode) => mode.mode === 't2v');
    assert.ok(t2v);
    t2v.ui.duration = { options: [5.5], default: 5.5 };
  });
  const options = buildMcpBudgetOptions('en', livePublication, dependencies);

  assert.equal(options.some((candidate) => candidate.durationSeconds === 5.5), false);
  assertLowestMatchesAuthoritativeMinimum(dependencies);
});

test('the included trial is hidden when its exact duration preset is removed', () => {
  const dependencies = withMutatedEngine('seedance-2-0-mini', (entry) => {
    const t2v = entry.modes.find((mode) => mode.mode === 't2v');
    assert.ok(t2v);
    t2v.ui.duration = { options: [4, 6], default: 4 };
  });

  assert.equal(
    buildMcpBudgetOptions('en', livePublication, dependencies).some(
      (candidate) => candidate.slot === 'included_trial',
    ),
    false,
  );
});

test('the included trial is hidden when its exact resolution preset is removed', () => {
  const dependencies = withMutatedEngine('seedance-2-0-mini', (entry) => {
    const t2v = entry.modes.find((mode) => mode.mode === 't2v');
    assert.ok(t2v);
    t2v.ui.resolution = ['720p'];
  });

  assert.equal(
    buildMcpBudgetOptions('en', livePublication, dependencies).some(
      (candidate) => candidate.slot === 'included_trial',
    ),
    false,
  );
});

test('canonical quote scenario mismatches fail closed for the displayed resolution', () => {
  const dependencies = defaultDependencies();
  const mismatchedQuote: McpBudgetOptionsDependencies = {
    ...dependencies,
    quotePricing: (input) => {
      const quote = dependencies.quotePricing(input);
      if (
        input.scenario.engineId === 'pika-text-to-video' &&
        input.scenario.resolution === '720p'
      ) {
        return { ...quote, scenarioId: `${input.scenario.id}:1080p` };
      }
      return quote;
    },
  };

  assert.notEqual(
    option(buildMcpBudgetOptions('en', livePublication, mismatchedQuote), 'lowest_paid').engineId,
    'pika-text-to-video',
  );
  assertLowestMatchesAuthoritativeMinimum(mismatchedQuote);
});

test('catalog audio mismatches fail closed for the displayed T2V scenario', () => {
  const dependencies = withMutatedEngine('pika-text-to-video', (entry) => {
    entry.engine.audio = true;
  });

  assert.notEqual(
    option(buildMcpBudgetOptions('en', livePublication, dependencies), 'lowest_paid').engineId,
    'pika-text-to-video',
  );
  assertLowestMatchesAuthoritativeMinimum(dependencies);
});

test('catalog resolution mismatches are excluded before pricing', () => {
  const dependencies = withMutatedEngine('pika-text-to-video', (entry) => {
    entry.engine.resolutions = ['1080p'];
    const t2v = entry.modes.find((mode) => mode.mode === 't2v');
    assert.ok(t2v);
    t2v.ui.resolution = ['720p'];
  });

  assert.notEqual(
    option(buildMcpBudgetOptions('en', livePublication, dependencies), 'lowest_paid').engineId,
    'pika-text-to-video',
  );
  assertLowestMatchesAuthoritativeMinimum(dependencies);
});

test('budget options use the current canonical trial and lowest paid route without legacy upgrades', () => {
  const options = buildMcpBudgetOptions('en', livePublication);

  assert.deepEqual(options.map((candidate) => candidate.slot), [
    'included_trial',
    'lowest_paid',
  ]);
  assert.equal(options[0].engineId, 'seedance-2-0-mini');
  assert.equal(options[0].modelSlug, 'dreamina-seedance-2-0-mini');
  assert.equal(options[0].amountCents, null);
  assert.equal(options[0].priceSource, 'included_trial');
  assert.equal(options[0].audioState, 'enabled');

  assert.equal(options[1].engineId, 'pika-text-to-video');
  assert.equal(options[1].amountCents, 26);
  assert.equal(options[1].amountCents, quoteScenario('pika-text-to-video', 5, '720p'));
  assert.equal(options[1].priceSource, 'canonical_public_quote');
  assert.equal(options[1].audioState, 'silent');

  assert.equal(options.some((candidate) => candidate.engineId === 'wan-2-6'), false);
});

test('audio presentation follows exact T2V defaults and optional inputs instead of engine capability', () => {
  const seedanceDefaultOff = withMutatedEngine('seedance-2-0-mini', (entry) => {
    const audio = entry.engine.inputSchema?.optional?.find((field) => field.id === 'generate_audio');
    assert.ok(audio);
    audio.default = false;
  });
  assert.equal(
    option(buildMcpBudgetOptions('en', livePublication, seedanceDefaultOff), 'included_trial').audioState,
    'optional',
  );

  const veoWithoutAudioInput = withOnlyEngine('veo-3-1', (entry) => {
    entry.engine.inputSchema!.optional = entry.engine.inputSchema!.optional!.filter(
      (field) => field.id !== 'generate_audio',
    );
    entry.engine.audio = false;
    const t2v = entry.modes.find((mode) => mode.mode === 't2v');
    assert.ok(t2v);
    t2v.ui.audioToggle = false;
  });
  const veo = option(buildMcpBudgetOptions('en', livePublication, veoWithoutAudioInput), 'lowest_paid');
  assert.equal(veo.engineId, 'veo-3-1');
  assert.equal(veo.audioState, 'silent');
  assert.match(veo.scenarioLabel, /Silent/);
});

test('enum-backed T2V audio controls use only schema-proven boolean strings', () => {
  const selectedVeo = option(
    buildMcpBudgetOptions('en', livePublication, withOnlyEngine('veo-3-1-lite')),
    'lowest_paid',
  );
  assert.equal(selectedVeo.engineId, 'veo-3-1-lite');
  assert.equal(selectedVeo.audioState, 'enabled');
  assert.match(selectedVeo.scenarioLabel, /Audio enabled/);

  const defaultOff = withOnlyEngine('veo-3-1-lite', (entry) => {
    const audio = entry.engine.inputSchema?.optional?.find((field) => field.id === 'generate_audio');
    assert.ok(audio);
    audio.default = 'false';
  });
  const optional = option(buildMcpBudgetOptions('en', livePublication, defaultOff), 'lowest_paid');
  assert.equal(optional.amountCents, selectedVeo.amountCents);
  assert.equal(optional.audioState, 'optional');
  assert.match(optional.scenarioLabel, /Optional audio/);

  const falseOnly = withOnlyEngine('veo-3-1-lite', (entry) => {
    const audio = entry.engine.inputSchema?.optional?.find((field) => field.id === 'generate_audio');
    assert.ok(audio);
    audio.values = ['false'];
    audio.default = 'false';
  });
  assert.equal(
    option(buildMcpBudgetOptions('en', livePublication, falseOnly), 'lowest_paid').audioState,
    'silent',
  );

  const unprovenTruthyDefault = withOnlyEngine('veo-3-1-lite', (entry) => {
    const audio = entry.engine.inputSchema?.optional?.find((field) => field.id === 'generate_audio');
    assert.ok(audio);
    audio.values = ['yes', 'no'];
    audio.default = 'true';
  });
  assert.equal(
    option(buildMcpBudgetOptions('en', livePublication, unprovenTruthyDefault), 'lowest_paid').audioState,
    'silent',
  );
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
    assert.equal(entry.isLegacy, false);
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

test('trial and paid claims fail closed with publication gates after legacy recommendation exclusion', () => {
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
  assert.deepEqual(paidOnly.map((candidate) => candidate.slot), ['lowest_paid']);
  assert.equal(paidOnly.some((candidate) => candidate.priceSource === 'included_trial'), false);

  const withoutReferenceClaim = buildMcpBudgetOptions('en', {
    ...livePublication,
    indexable: false,
    showReferenceClaim: false,
  });
  assert.deepEqual(withoutReferenceClaim.map((candidate) => candidate.slot), [
    'included_trial',
    'lowest_paid',
  ]);
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
    assert.equal(paid.audioState, 'silent');
    assert.doesNotMatch(paid.scenarioLabel, /provider|fal-ai|margin|token/i);
  }
});
