import assert from 'node:assert/strict';
import test from 'node:test';

import type { PricingPolicyRule } from '@maxvideoai/pricing';
import {
  compareCanonicalAdminScenarios,
  quoteCanonicalAdminScenarios,
  selectAffectedPricingScenarios,
} from '../frontend/server/pricing-admin/canonical-scenarios.ts';
import { PricingAdminError } from '../frontend/server/pricing-admin/errors.ts';
import { buildPricingPreviewFingerprint } from '../frontend/server/pricing-admin/fingerprint.ts';
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

test('preview fingerprints are stable across object key and scenario order', () => {
  const left = buildPricingPreviewFingerprint({
    domain: 'policy_rule',
    operation: 'update',
    targetId: 'db-kling-1080p',
    currentState: { id: 'db-kling-1080p', selector: { resolution: '1080p', engineId: 'kling-3-pro' } },
    proposedState: { currency: 'USD', marginPercent: 0.4 },
    versionedPolicyVersion: 1,
    affectedScenarioIds: ['scenario-b', 'scenario-a'],
  });
  const right = buildPricingPreviewFingerprint({
    affectedScenarioIds: ['scenario-a', 'scenario-b'],
    versionedPolicyVersion: 1,
    proposedState: { marginPercent: 0.4, currency: 'USD' },
    currentState: { selector: { engineId: 'kling-3-pro', resolution: '1080p' }, id: 'db-kling-1080p' },
    targetId: 'db-kling-1080p',
    operation: 'update',
    domain: 'policy_rule',
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
  };
  const fingerprint = buildPricingPreviewFingerprint(base);

  assert.notEqual(buildPricingPreviewFingerprint({ ...base, currentState: { marginPercent: 0.31 } }), fingerprint);
  assert.notEqual(buildPricingPreviewFingerprint({ ...base, proposedState: { marginPercent: 0.41 } }), fingerprint);
  assert.notEqual(buildPricingPreviewFingerprint({ ...base, versionedPolicyVersion: 2 }), fingerprint);
  assert.notEqual(buildPricingPreviewFingerprint({ ...base, affectedScenarioIds: ['scenario-b'] }), fingerprint);
  assert.notEqual(buildPricingPreviewFingerprint({ ...base, targetId: 'db-kling-720p' }), fingerprint);
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

  assert.ok(standardDiscount && customDiscount && customDiscount.customerTotalCents < standardDiscount.customerTotalCents);
  assert.equal(customDiscount.breakdown.discountPercent, 0.2);
  assert.equal(profileQuote?.policyProvenance.compatibilityProfile, 'schema-current');
});

test('comparison returns a null percentage when the current total is zero', () => {
  const scenario = findScenario('billing:kling-3-pro:t2v:5:1080p:member');
  const quote = quoteCanonicalAdminScenarios({ databaseRules: [globalRule], scenarios: [scenario] })[0];
  assert.ok(quote);

  const preview = compareCanonicalAdminScenarios(
    [{ ...quote, customerTotalCents: 0 }],
    [{ ...quote, customerTotalCents: 10 }]
  );

  assert.equal(preview[0]?.deltaCents, 10);
  assert.equal(preview[0]?.deltaPercent, null);
});

test('pricing admin errors expose stable domain codes and HTTP statuses', () => {
  const cases = [
    ['invalid_payload', 400],
    ['unknown_engine', 400],
    ['missing_target', 404],
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
