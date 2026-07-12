import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const policyModulePath = 'packages/pricing/src/policy.ts';
const defaultsModulePath = 'frontend/src/lib/pricing-policy-defaults.ts';
const policyDocumentPath = 'frontend/config/pricing-policy.json';

test('committed pricing policy validates and keeps current global defaults', async () => {
  assert.equal(existsSync(policyModulePath), true, `${policyModulePath} should exist`);
  assert.equal(existsSync(defaultsModulePath), true, `${defaultsModulePath} should exist`);
  assert.equal(existsSync(policyDocumentPath), true, `${policyDocumentPath} should exist`);
  const { getVersionedPricingPolicy } = await import('../frontend/src/lib/pricing-policy-defaults.ts');
  const policy = getVersionedPricingPolicy();

  assert.equal(policy.version, 1);
  assert.deepEqual(policy.rules.find((rule) => rule.id === 'default'), {
    id: 'default',
    marginPercent: 0.3,
    marginFlatCents: 0,
    surchargeAudioPercent: 0.2,
    surchargeUpscalePercent: 0.5,
    currency: 'USD',
  });
});

test('policy validation rejects invalid numbers and ambiguous selectors', async () => {
  assert.equal(existsSync(policyModulePath), true, `${policyModulePath} should exist`);
  const { PricingPolicyValidationError, validatePricingPolicyDocument } = await import('../packages/pricing/src/policy.ts');
  const base = {
    version: 1,
    supportedCurrencies: ['USD'],
    compatibilityProfiles: [
      {
        id: 'standard',
        vendorSubtotalRounding: 'preserve',
        marginRounding: 'up',
        surchargeRounding: 'up',
        discountRounding: 'nearest',
        totalRounding: 'nearest',
      },
    ],
  };

  assert.throws(
    () =>
      validatePricingPolicyDocument({
        ...base,
        rules: [
          {
            id: 'negative',
            marginPercent: -0.1,
            marginFlatCents: 0,
            surchargeAudioPercent: 0,
            surchargeUpscalePercent: 0,
            currency: 'USD',
          },
        ],
      }),
    (error: unknown) => error instanceof PricingPolicyValidationError && error.code === 'invalid_number'
  );

  assert.throws(
    () =>
      validatePricingPolicyDocument({
        ...base,
        rules: [
          {
            id: 'one',
            engineId: 'engine-a',
            marginPercent: 0.3,
            marginFlatCents: 0,
            surchargeAudioPercent: 0,
            surchargeUpscalePercent: 0,
            currency: 'USD',
          },
          {
            id: 'two',
            engineId: 'engine-a',
            marginPercent: 0.4,
            marginFlatCents: 0,
            surchargeAudioPercent: 0,
            surchargeUpscalePercent: 0,
            currency: 'USD',
          },
        ],
      }),
    (error: unknown) => error instanceof PricingPolicyValidationError && error.code === 'ambiguous_selector'
  );
});

test('policy validation rejects unknown references and compatibility profiles', async () => {
  assert.equal(existsSync(policyModulePath), true, `${policyModulePath} should exist`);
  const { PricingPolicyValidationError, validatePricingPolicyDocument } = await import('../packages/pricing/src/policy.ts');
  const input = {
    version: 1,
    supportedCurrencies: ['USD'],
    compatibilityProfiles: [],
    rules: [
      {
        id: 'unknown',
        engineId: 'missing-engine',
        marginPercent: 0.3,
        marginFlatCents: 0,
        surchargeAudioPercent: 0,
        surchargeUpscalePercent: 0,
        currency: 'USD',
        compatibilityProfile: 'missing-profile',
      },
    ],
  };

  assert.throws(
    () => validatePricingPolicyDocument(input, { engineIds: new Set(['known-engine']) }),
    (error: unknown) =>
      error instanceof PricingPolicyValidationError &&
      (error.code === 'unknown_engine' || error.code === 'unknown_compatibility_profile')
  );
});

test('versioned policy facade returns defensive clones', async () => {
  assert.equal(existsSync(defaultsModulePath), true, `${defaultsModulePath} should exist`);
  const { getVersionedPricingPolicy } = await import('../frontend/src/lib/pricing-policy-defaults.ts');
  const first = getVersionedPricingPolicy();
  first.rules[0]!.marginPercent = 99;
  const second = getVersionedPricingPolicy();
  assert.equal(second.rules[0]!.marginPercent, 0.3);
});

const rule = (id: string, selector: { engineId?: string; mode?: string; resolution?: string } = {}) => ({
  id,
  ...selector,
  marginPercent: 0.3,
  marginFlatCents: 0,
  surchargeAudioPercent: 0.2,
  surchargeUpscalePercent: 0.5,
  currency: 'USD',
});

test('policy resolver applies the binding source and specificity order with provenance', async () => {
  const { resolvePricingPolicy } = await import('../packages/pricing/src/policy.ts');
  const scenario = { engineId: 'engine-a', mode: 't2v', resolution: '1080p' };
  const resolved = resolvePricingPolicy({
    scenario,
    databaseRules: [rule('db-global'), rule('db-engine', { engineId: 'engine-a' }), rule('db-precise', { engineId: 'engine-a', resolution: '1080p' })],
    versionedRules: [rule('versioned-global'), rule('versioned-precise', { engineId: 'engine-a', mode: 't2v', resolution: '1080p' })],
  });

  assert.deepEqual(resolved, {
    rule: rule('db-precise', { engineId: 'engine-a', resolution: '1080p' }),
    source: 'database',
    matchedBy: 'precise',
    sourceRuleId: 'db-precise',
  });
});

test('policy resolver falls back from empty database overrides to versioned rules', async () => {
  const { resolvePricingPolicy } = await import('../packages/pricing/src/policy.ts');
  const resolved = resolvePricingPolicy({
    scenario: { engineId: 'engine-a', mode: 't2v', resolution: '1080p' },
    databaseRules: [],
    versionedRules: [rule('versioned-global'), rule('versioned-engine', { engineId: 'engine-a' })],
  });

  assert.equal(resolved.source, 'versioned');
  assert.equal(resolved.matchedBy, 'engine');
  assert.equal(resolved.sourceRuleId, 'versioned-engine');
});

test('policy resolver rejects ambiguous rules instead of using array order', async () => {
  const { PricingPolicyResolutionError, resolvePricingPolicy } = await import('../packages/pricing/src/policy.ts');
  assert.throws(
    () =>
      resolvePricingPolicy({
        scenario: { engineId: 'engine-a', resolution: '1080p' },
        databaseRules: [
          rule('first', { engineId: 'engine-a', resolution: '1080p' }),
          rule('second', { engineId: 'engine-a', resolution: '1080p' }),
        ],
        versionedRules: [rule('default')],
      }),
    (error: unknown) => error instanceof PricingPolicyResolutionError && error.code === 'ambiguous_match'
  );
});

test('server resolver logs one structured warning and uses versioned policy when DB is unavailable', async () => {
  const serverModulePath = 'frontend/server/pricing/resolve-pricing-policy.ts';
  assert.equal(existsSync(serverModulePath), true, `${serverModulePath} should exist`);
  const { resolveServerPricingPolicy } = await import('../frontend/server/pricing/resolve-pricing-policy.ts');
  const warnings: Array<Record<string, unknown>> = [];
  const resolved = await resolveServerPricingPolicy(
    { engineId: 'kling-3-pro', mode: 't2v', resolution: '1080p' },
    {
      loadOverrides: async () => ({ status: 'unavailable', rules: [], errorCode: 'pricing_rules_query_failed' }),
      warn: (event) => warnings.push(event),
    }
  );

  assert.equal(resolved.source, 'versioned');
  assert.deepEqual(warnings, [
    {
      event: 'pricing_policy_db_fallback',
      errorCode: 'pricing_rules_query_failed',
      engineId: 'kling-3-pro',
      mode: 't2v',
      resolution: '1080p',
    },
  ]);
});

test('historical billing selector keeps exact engine, engine, global precedence', async () => {
  const { selectPricingRuleForBilling } = await import('../frontend/src/lib/pricing-rule-store.ts');
  const rules = [
    rule('global'),
    rule('engine', { engineId: 'engine-a' }),
    rule('exact', { engineId: 'engine-a', resolution: '1080p' }),
  ];
  assert.equal(selectPricingRuleForBilling(rules, 'engine-a', '1080p').id, 'exact');
  assert.equal(selectPricingRuleForBilling(rules, 'engine-a', '720p').id, 'engine');
  assert.equal(selectPricingRuleForBilling(rules, 'engine-b', '720p').id, 'global');
});
