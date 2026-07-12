import assert from 'node:assert/strict';
import test from 'node:test';

import type { PricingPolicyRule } from '@maxvideoai/pricing';
import {
  compareCanonicalAdminScenarios,
  quoteCanonicalAdminScenarios,
  selectAffectedPricingScenarios,
  type AdminCanonicalScenarioOutcome,
  type AdminCanonicalScenarioQuote,
} from '../frontend/server/pricing-admin/canonical-scenarios.ts';
import { PricingAdminError } from '../frontend/server/pricing-admin/errors.ts';
import { buildPricingPreviewFingerprint } from '../frontend/server/pricing-admin/fingerprint.ts';
import type { PricingChangeJsonValue } from '../frontend/lib/admin/pricing-change-contract.ts';
import { buildPricingAuditScenarios } from '../frontend/src/lib/pricing-audit/scenarios.ts';

const globalRule: PricingPolicyRule = {
  id: 'db-global',
  marginPercent: 0,
  marginFlatCents: 46,
  surchargeAudioPercent: 0.2,
  surchargeUpscalePercent: 0.5,
  currency: 'USD',
};

function findScenario(id: string) {
  const scenario = buildPricingAuditScenarios().find((candidate) => candidate.id === id);
  assert.ok(scenario, `Missing pricing audit scenario ${id}`);
  return scenario;
}

function requireQuoted(
  outcome: AdminCanonicalScenarioOutcome | undefined
): asserts outcome is AdminCanonicalScenarioQuote {
  assert.ok(outcome, 'Missing canonical scenario outcome');
  assert.equal(outcome.status, 'quoted', 'Expected a supported canonical scenario quote');
}

test('preview fingerprints are stable across object key and scenario order', () => {
  const left = buildPricingPreviewFingerprint({
    domain: 'policy_rule',
    operation: 'update',
    targetId: 'db-kling-1080p',
    currentState: { id: 'db-kling-1080p', selector: { resolution: '1080p', engineId: 'kling-3-pro' } },
    proposedState: { currency: 'USD', marginPercent: 0.4 },
    versionedPolicyVersion: 1,
    affectedScenarioIds: ['scenario-b', 'scenario-a'],
    unsupportedScenarioIds: [],
  });
  const right = buildPricingPreviewFingerprint({
    affectedScenarioIds: ['scenario-a', 'scenario-b'],
    versionedPolicyVersion: 1,
    proposedState: { marginPercent: 0.4, currency: 'USD' },
    currentState: { selector: { engineId: 'kling-3-pro', resolution: '1080p' }, id: 'db-kling-1080p' },
    targetId: 'db-kling-1080p',
    operation: 'update',
    domain: 'policy_rule',
    unsupportedScenarioIds: [],
  });

  assert.match(left, /^[a-f0-9]{64}$/);
  assert.equal(left, right);
});

test('preview fingerprints bind current state, proposal, policy version, scenarios, and target', () => {
  const base = {
    domain: 'policy_rule' as const,
    operation: 'update' as const,
    targetId: 'db-kling-1080p',
    currentState: { marginPercent: 0.3 },
    proposedState: { marginPercent: 0.4 },
    versionedPolicyVersion: 1,
    affectedScenarioIds: ['scenario-a'],
    unsupportedScenarioIds: [],
  };
  const fingerprint = buildPricingPreviewFingerprint(base);

  assert.notEqual(buildPricingPreviewFingerprint({ ...base, currentState: { marginPercent: 0.31 } }), fingerprint);
  assert.notEqual(buildPricingPreviewFingerprint({ ...base, proposedState: { marginPercent: 0.41 } }), fingerprint);
  assert.notEqual(buildPricingPreviewFingerprint({ ...base, versionedPolicyVersion: 2 }), fingerprint);
  assert.notEqual(buildPricingPreviewFingerprint({ ...base, affectedScenarioIds: ['scenario-b'] }), fingerprint);
  assert.notEqual(buildPricingPreviewFingerprint({ ...base, targetId: 'db-kling-720p' }), fingerprint);
  assert.notEqual(
    buildPricingPreviewFingerprint({ ...base, projectionState: { currentRules: [{ id: 'other', marginPercent: 0.31 }] } }),
    fingerprint
  );
});

test('preview fingerprints reject every non-JSON state value instead of collapsing it', () => {
  const base = {
    domain: 'policy_rule' as const,
    operation: 'update' as const,
    targetId: 'db-kling-1080p',
    currentState: null,
    proposedState: { marginPercent: 0.4 },
    versionedPolicyVersion: 1,
    affectedScenarioIds: ['scenario-a'],
    unsupportedScenarioIds: [],
  };
  const sparse = [1] as unknown[];
  sparse.length = 2;
  const invalidStates: unknown[] = [
    { a: 1, nested: { b: undefined } },
    { a: [1, undefined] },
    { a: [1, Number.NaN] },
    { a: Number.POSITIVE_INFINITY },
    { a: Number.NEGATIVE_INFINITY },
    { a: () => 1 },
    { a: Symbol('invalid') },
    { a: BigInt(1) },
    { a: sparse },
  ];

  for (const currentState of invalidStates) {
    assert.throws(
      () =>
        buildPricingPreviewFingerprint({
          ...base,
          currentState: currentState as PricingChangeJsonValue,
        }),
      (error: unknown) => error instanceof PricingAdminError && error.code === 'invalid_payload'
    );
  }
});

test('affected scenario selection follows canonical global, engine, mode, resolution, and precise selectors', () => {
  const scenarios = buildPricingAuditScenarios();
  const representative = findScenario('billing:kling-3-pro:t2v:5:1080p:member');

  assert.deepEqual(selectAffectedPricingScenarios({}).map((row) => row.id), scenarios.map((row) => row.id));
  assert.deepEqual(
    selectAffectedPricingScenarios({ engineId: representative.engineId }),
    scenarios.filter((row) => row.engineId === representative.engineId)
  );
  assert.deepEqual(
    selectAffectedPricingScenarios({ engineId: representative.engineId, mode: representative.mode }),
    scenarios.filter((row) => row.engineId === representative.engineId && row.mode === representative.mode)
  );
  assert.deepEqual(
    selectAffectedPricingScenarios({ engineId: representative.engineId, resolution: representative.resolution }),
    scenarios.filter(
      (row) => row.engineId === representative.engineId && row.resolution === representative.resolution
    )
  );
  assert.deepEqual(
    selectAffectedPricingScenarios({
      engineId: representative.engineId,
      mode: representative.mode,
      resolution: representative.resolution,
    }),
    scenarios.filter(
      (row) =>
        row.engineId === representative.engineId &&
        row.mode === representative.mode &&
        row.resolution === representative.resolution
    )
  );
});

test('canonical admin quotes compare only affected totals and preserve provenance', () => {
  const kling1080 = findScenario('billing:kling-3-pro:t2v:5:1080p:member');
  const veo720 = findScenario('billing:veo-3-1:t2v:8:720p:member');
  const kling1080Rule: PricingPolicyRule = {
    ...globalRule,
    id: 'db-kling-1080p',
    engineId: kling1080.engineId,
    mode: kling1080.mode,
    resolution: kling1080.resolution,
    marginFlatCents: 56,
  };
  const scenarios = [kling1080, veo720];

  const current = quoteCanonicalAdminScenarios({ databaseRules: [globalRule], scenarios });
  const proposed = quoteCanonicalAdminScenarios({
    databaseRules: [globalRule, kling1080Rule],
    scenarios,
  });
  const preview = compareCanonicalAdminScenarios(current, proposed);

  assert.deepEqual(preview.map((row) => row.scenarioId), [kling1080.id]);
  assert.equal(preview[0]?.currentTotalCents, 130);
  assert.equal(preview[0]?.proposedTotalCents, 140);
  assert.equal(preview[0]?.deltaCents, 10);
  assert.equal(preview[0]?.deltaPercent, 10 / 130);
  assert.deepEqual(preview[0]?.currentProvenance, {
    source: 'database',
    matchedBy: 'global',
    sourceRuleId: globalRule.id,
    compatibilityProfile: 'standard',
  });
  assert.deepEqual(preview[0]?.proposedProvenance, {
    source: 'database',
    matchedBy: 'precise',
    sourceRuleId: kling1080Rule.id,
    compatibilityProfile: 'standard',
  });
  assert.equal(preview[0]?.compatibilityProfile, 'standard');
});

test('canonical admin quotes accept explicit membership discounts and scenario compatibility profiles', () => {
  const plus = findScenario('billing:kling-3-pro:t2v:5:1080p:plus');
  const jsonLd = buildPricingAuditScenarios().find((scenario) => scenario.surface === 'json-ld');
  assert.ok(jsonLd, 'Missing JSON-LD pricing audit scenario');

  const standardDiscount = quoteCanonicalAdminScenarios({ databaseRules: [globalRule], scenarios: [plus] })[0];
  const customDiscount = quoteCanonicalAdminScenarios({
    databaseRules: [globalRule],
    membershipDiscounts: { member: 0, plus: 0.2, pro: 0.1 },
    scenarios: [plus],
  })[0];
  const profileQuote = quoteCanonicalAdminScenarios({ databaseRules: [globalRule], scenarios: [jsonLd] })[0];

  requireQuoted(standardDiscount);
  requireQuoted(customDiscount);
  requireQuoted(profileQuote);
  assert.ok(customDiscount.customerTotalCents < standardDiscount.customerTotalCents);
  assert.equal(customDiscount.breakdown.discountPercent, 0.2);
  assert.equal(profileQuote?.policyProvenance.compatibilityProfile, 'schema-current');
});

test('an explicit database compatibility profile overrides a provider-reference billing scenario', () => {
  const scenario = findScenario('billing:seedance-2-0-fast:t2v:1:720p:member');
  assert.equal(scenario.compatibilityProfile, 'provider-reference-current');
  const standardRule: PricingPolicyRule = {
    ...globalRule,
    id: 'db-seedance-standard',
    engineId: scenario.engineId,
    mode: scenario.mode,
    resolution: scenario.resolution,
    marginPercent: 0.3,
    marginFlatCents: 0,
    compatibilityProfile: 'standard',
  };

  const baseline = quoteCanonicalAdminScenarios({ databaseRules: [], scenarios: [scenario] })[0];
  const quote = quoteCanonicalAdminScenarios({ databaseRules: [standardRule], scenarios: [scenario] })[0];

  requireQuoted(baseline);
  requireQuoted(quote);
  assert.equal(baseline.customerTotalCents, 31);
  assert.equal(quote.policyProvenance.compatibilityProfile, 'standard');
  assert.equal(quote.customerTotalCents, 30);
});

test('public scenario facts keep their authoritative compatibility profile over a database profile', () => {
  const scenario = findScenario('estimator:seedance-2-0-fast:1:720p');
  assert.equal(scenario.compatibilityProfile, 'provider-reference-current');
  const standardRule: PricingPolicyRule = {
    ...globalRule,
    id: 'db-seedance-standard',
    engineId: scenario.engineId,
    mode: scenario.mode,
    resolution: scenario.resolution,
    marginPercent: 0.3,
    marginFlatCents: 0,
    compatibilityProfile: 'standard',
  };

  const quote = quoteCanonicalAdminScenarios({ databaseRules: [standardRule], scenarios: [scenario] })[0];

  requireQuoted(quote);
  assert.equal(quote.policyProvenance.compatibilityProfile, 'provider-reference-current');
});

test('comparison returns a null percentage when the current total is zero', () => {
  const scenario = findScenario('billing:kling-3-pro:t2v:5:1080p:member');
  const quote = quoteCanonicalAdminScenarios({ databaseRules: [globalRule], scenarios: [scenario] })[0];
  requireQuoted(quote);

  const preview = compareCanonicalAdminScenarios(
    [{ ...quote, customerTotalCents: 0 }],
    [{ ...quote, customerTotalCents: 10 }]
  );

  assert.equal(preview[0]?.deltaCents, 10);
  assert.equal(preview[0]?.deltaPercent, null);
});

test('canonical projection returns one explicit outcome for every selected scenario', () => {
  const scenarios = buildPricingAuditScenarios();
  const outcomes = quoteCanonicalAdminScenarios({ databaseRules: [], scenarios });

  assert.deepEqual(
    outcomes.map((outcome) => outcome.scenarioId).sort(),
    scenarios.map((scenario) => scenario.id).sort()
  );
  const unsupported = outcomes.filter((outcome) => 'status' in outcome && outcome.status === 'unsupported');
  assert.deepEqual(
    unsupported.map((outcome) => outcome.scenarioId),
    [
      'pricing-hub:pika-text-to-video:10s-1080p-audio',
      'pricing-hub:pika-text-to-video:4k-route',
      'pricing-hub:pika-text-to-video:8s-1080p',
      'tool:upscale:default',
    ]
  );
});

test('comparison and fingerprinting reject explicit unsupported scenario outcomes', () => {
  const unsupported = {
    status: 'unsupported',
    scenarioId: 'pricing-hub:pika-text-to-video:10s-1080p-audio',
    engineId: 'pika-text-to-video',
    surface: 'pricing-hub',
    reason: 'canonical_facts_unavailable',
    warning: 'No canonical facts are available for this scenario.',
  };

  assert.throws(
    () => compareCanonicalAdminScenarios([unsupported] as never[], [unsupported] as never[]),
    (error: unknown) => error instanceof PricingAdminError && String(error.code) === 'unsupported_scenario'
  );
  assert.throws(
    () =>
      buildPricingPreviewFingerprint({
        domain: 'policy_rule',
        operation: 'update',
        targetId: 'db-pika',
        currentState: { marginPercent: 0.3 },
        proposedState: { marginPercent: 0.4 },
        versionedPolicyVersion: 1,
        affectedScenarioIds: [unsupported.scenarioId],
        unsupportedScenarioIds: [unsupported.scenarioId],
      }),
    (error: unknown) => error instanceof PricingAdminError && String(error.code) === 'unsupported_scenario'
  );
});

test('audio surcharge scenarios are explicit unsupported outcomes when canonical facts are unavailable', () => {
  const scenario = buildPricingAuditScenarios().find((candidate) => candidate.input.audio === true);
  assert.ok(scenario, 'Missing authoritative audio surcharge scenario');
  const currentRule = { ...globalRule, surchargeAudioPercent: 0.2 };
  const proposedRule = { ...globalRule, surchargeAudioPercent: 0.4 };

  const current = quoteCanonicalAdminScenarios({ databaseRules: [currentRule], scenarios: [scenario] })[0];
  const proposed = quoteCanonicalAdminScenarios({ databaseRules: [proposedRule], scenarios: [scenario] })[0];

  assert.equal(current?.status, 'unsupported');
  assert.equal(proposed?.status, 'unsupported');
  assert.equal((current as { surcharge?: string } | undefined)?.surcharge, 'audio');
  assert.match((current as { warning?: string } | undefined)?.warning ?? '', /audio surcharge impact/);
  assert.throws(
    () => compareCanonicalAdminScenarios(current ? [current] : [], proposed ? [proposed] : []),
    (error: unknown) => error instanceof PricingAdminError && error.code === 'unsupported_scenario'
  );
});

test('upscale surcharge-only policy changes are blocked when no authoritative policy scenario exists', () => {
  const scenario = findScenario('tool:upscale:default');
  const currentRule: PricingPolicyRule = {
    ...globalRule,
    id: 'db-upscale',
    engineId: 'upscale',
    marginFlatCents: 0,
    compatibilityProfile: 'standard',
    surchargeUpscalePercent: 0.2,
  };
  const proposedRule: PricingPolicyRule = { ...currentRule, surchargeUpscalePercent: 0.5 };
  const current = quoteCanonicalAdminScenarios({ databaseRules: [currentRule], scenarios: [scenario] })[0];
  const proposed = quoteCanonicalAdminScenarios({ databaseRules: [proposedRule], scenarios: [scenario] })[0];

  assert.equal(current?.status, 'unsupported');
  assert.equal(proposed?.status, 'unsupported');
  assert.equal((current as { surcharge?: string }).surcharge, 'upscale');
  assert.match((current as { warning?: string }).warning ?? '', /upscale surcharge impact/);
  assert.throws(
    () => compareCanonicalAdminScenarios(current ? [current] : [], proposed ? [proposed] : []),
    (error: unknown) => error instanceof PricingAdminError && error.code === 'unsupported_scenario'
  );
});

test('requested audio coverage builds a selector-aware canonical Kling scenario', () => {
  const selector = { engineId: 'kling-3-pro', mode: 't2v', resolution: '1080p' };
  const scenarios = selectAffectedPricingScenarios(selector);
  const currentRule: PricingPolicyRule = {
    ...globalRule,
    id: 'db-kling-audio',
    ...selector,
    marginPercent: 0,
    marginFlatCents: 0,
    surchargeAudioPercent: 0.2,
  };
  const proposedRule: PricingPolicyRule = { ...currentRule, surchargeAudioPercent: 0.4 };
  const requestedSurcharges = [{ kind: 'audio' as const, selector }];

  const current = quoteCanonicalAdminScenarios({ databaseRules: [currentRule], scenarios, requestedSurcharges });
  const proposed = quoteCanonicalAdminScenarios({ databaseRules: [proposedRule], scenarios, requestedSurcharges });
  const requested = current.find(
    (outcome) => outcome.scenarioId === 'admin-surcharge:audio:kling-3-pro:t2v:1080p'
  );

  requireQuoted(requested);
  assert.equal(requested.surcharge, 'audio');
  assert.equal(requested.policyProvenance.sourceRuleId, currentRule.id);
  const preview = compareCanonicalAdminScenarios(current, proposed);
  assert.deepEqual(preview.map((row) => row.scenarioId), [requested.scenarioId]);
  assert.equal(preview[0]?.deltaCents, 17);
});

test('requested upscale coverage blocks an ordinary selector without an authoritative scenario', () => {
  const selector = { engineId: 'kling-3-pro', mode: 't2v', resolution: '1080p' };
  const scenarios = selectAffectedPricingScenarios(selector);
  const requestedSurcharges = [{ kind: 'upscale' as const, selector }];
  const outcomes = quoteCanonicalAdminScenarios({ databaseRules: [globalRule], scenarios, requestedSurcharges });
  const requested = outcomes.find(
    (outcome) => outcome.scenarioId === 'admin-surcharge:upscale:kling-3-pro:t2v:1080p'
  );

  assert.equal(requested?.status, 'unsupported');
  assert.equal(
    requested?.status === 'unsupported' ? requested.reason : undefined,
    'surcharge_policy_not_authoritative'
  );
  assert.throws(
    () => compareCanonicalAdminScenarios(outcomes, outcomes),
    (error: unknown) => error instanceof PricingAdminError && error.code === 'unsupported_scenario'
  );
});

test('pricing admin errors expose stable domain codes and HTTP statuses', () => {
  const cases = [
    ['invalid_payload', 400],
    ['unsupported_scenario', 400],
    ['unknown_engine', 400],
    ['missing_target', 404],
    ['routing_conflict', 409],
    ['preview_stale', 409],
    ['database_unavailable', 503],
    ['persistence_failed', 500],
  ] as const;

  for (const [code, status] of cases) {
    const error = new PricingAdminError(code, `Message for ${code}`);
    assert.equal(error.name, 'PricingAdminError');
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    assert.equal(error.message, `Message for ${code}`);
  }
});
