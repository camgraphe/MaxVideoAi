import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const canonicalPath = 'packages/pricing/src/canonical.ts';
const standardProfile = {
  id: 'standard',
  vendorSubtotalRounding: 'preserve' as const,
  marginRounding: 'up' as const,
  surchargeRounding: 'up' as const,
  discountRounding: 'nearest' as const,
  totalRounding: 'nearest' as const,
};
const resolvedPolicy = {
  rule: {
    id: 'default',
    marginPercent: 0.3,
    marginFlatCents: 0,
    surchargeAudioPercent: 0.2,
    surchargeUpscalePercent: 0.5,
    currency: 'USD',
  },
  source: 'versioned' as const,
  matchedBy: 'global' as const,
  sourceRuleId: 'default',
};

test('canonical quote applies margin, surcharge, discount, and provenance once', async () => {
  assert.equal(existsSync(canonicalPath), true, `${canonicalPath} should exist`);
  const { quoteCanonicalPricing } = await import('../packages/pricing/src/canonical.ts');
  const quote = quoteCanonicalPricing({
    facts: { engineId: 'engine-a', currency: 'USD', vendorSubtotalExactCents: 84, unit: 'sec', quantity: 5 },
    scenario: {
      id: 'engine-a:5s',
      engineId: 'engine-a',
      resolution: '1080p',
      membershipTier: 'plus',
      discountPercent: 0.05,
      surcharge: 'audio',
    },
    policy: resolvedPolicy,
    compatibilityProfile: standardProfile,
  });

  assert.equal(quote.vendorSubtotalCents, 84);
  assert.equal(quote.marginCents, 26);
  assert.equal(quote.surchargeCents, 17);
  assert.equal(quote.discountCents, 6);
  assert.equal(quote.customerTotalCents, 121);
  assert.deepEqual(quote.policyProvenance, {
    source: 'versioned',
    matchedBy: 'global',
    sourceRuleId: 'default',
    compatibilityProfile: 'standard',
  });
});

test('canonical quote preserves fractional vendor cents for commercial math', async () => {
  assert.equal(existsSync(canonicalPath), true, `${canonicalPath} should exist`);
  const { quoteCanonicalPricing } = await import('../packages/pricing/src/canonical.ts');
  const quote = quoteCanonicalPricing({
    facts: { engineId: 'engine-a', currency: 'USD', vendorSubtotalExactCents: 10.1, unit: 'image', quantity: 1 },
    scenario: { id: 'fractional', engineId: 'engine-a', membershipTier: 'member', discountPercent: 0 },
    policy: resolvedPolicy,
    compatibilityProfile: standardProfile,
  });

  assert.equal(quote.vendorSubtotalCents, 10);
  assert.equal(quote.marginCents, 4);
  assert.equal(quote.customerTotalCents, 14);
  assert.equal(quote.breakdown.vendorSubtotalExactCents, 10.1);
});

test('canonical quote supports explicit vendor rounding compatibility', async () => {
  assert.equal(existsSync(canonicalPath), true, `${canonicalPath} should exist`);
  const { quoteCanonicalPricing } = await import('../packages/pricing/src/canonical.ts');
  const quote = quoteCanonicalPricing({
    facts: { engineId: 'engine-a', currency: 'USD', vendorSubtotalExactCents: 10.01, unit: 'image', quantity: 1 },
    scenario: { id: 'rounded-up', engineId: 'engine-a', membershipTier: 'member', discountPercent: 0 },
    policy: resolvedPolicy,
    compatibilityProfile: { ...standardProfile, id: 'ceil-vendor', vendorSubtotalRounding: 'up' },
  });

  assert.equal(quote.vendorSubtotalCents, 11);
  assert.equal(quote.marginCents, 4);
  assert.equal(quote.customerTotalCents, 15);
});

test('canonical quote rejects invalid facts, currency mismatches, and unsupported surcharge keys', async () => {
  assert.equal(existsSync(canonicalPath), true, `${canonicalPath} should exist`);
  const { PricingDomainError, quoteCanonicalPricing } = await import('../packages/pricing/src/canonical.ts');
  const base = {
    scenario: { id: 'invalid', engineId: 'engine-a', membershipTier: 'member' as const, discountPercent: 0 },
    policy: resolvedPolicy,
    compatibilityProfile: standardProfile,
  };

  assert.throws(
    () =>
      quoteCanonicalPricing({
        ...base,
        facts: { engineId: 'engine-a', currency: 'USD', vendorSubtotalExactCents: -1, unit: 'run', quantity: 1 },
      }),
    (error: unknown) => error instanceof PricingDomainError && error.code === 'invalid_facts'
  );
  assert.throws(
    () =>
      quoteCanonicalPricing({
        ...base,
        facts: { engineId: 'engine-a', currency: 'EUR', vendorSubtotalExactCents: 1, unit: 'run', quantity: 1 },
      }),
    (error: unknown) => error instanceof PricingDomainError && error.code === 'currency_mismatch'
  );
  assert.throws(
    () =>
      quoteCanonicalPricing({
        ...base,
        facts: { engineId: 'engine-a', currency: 'USD', vendorSubtotalExactCents: 1, unit: 'run', quantity: 1 },
        scenario: { ...base.scenario, surcharge: 'other' as never },
      }),
    (error: unknown) => error instanceof PricingDomainError && error.code === 'unknown_surcharge'
  );
});
