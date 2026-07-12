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
