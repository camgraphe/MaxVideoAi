import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
  assert.deepEqual(
    policy.rules
      .filter((rule) => rule.engineId === 'storyboarder')
      .map((rule) => ({ id: rule.id, mode: rule.mode, marginPercent: rule.marginPercent })),
    [
      { id: 'storyboard-generate', mode: 'storyboard', marginPercent: 2 },
      { id: 'storyboard-edit', mode: 'storyboard_edit', marginPercent: 1 },
    ]
  );
});

test('database seeds preserve the versioned storyboard prices before admin overrides', () => {
  const schemaSource = readFileSync('frontend/src/lib/schema/billing-core-schema.ts', 'utf8');
  const migrationPath = 'neon/migrations/28_storyboard_pricing_policy.sql';

  assert.equal(existsSync(migrationPath), true);
  for (const source of [schemaSource, readFileSync(migrationPath, 'utf8')]) {
    assert.match(source, /storyboard-generate/);
    assert.match(source, /storyboard-edit/);
    assert.match(source, /storyboarder/);
    assert.match(source, /storyboard_edit/);
  }
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

test('database override validation normalizes the complete canonical rule without requiring a global override', async () => {
  const { validatePricingPolicyOverrides } = await import('../packages/pricing/src/policy.ts');
  const { getVersionedPricingPolicy } = await import('../frontend/src/lib/pricing-policy-defaults.ts');
  const policy = getVersionedPricingPolicy();

  assert.deepEqual(
    validatePricingPolicyOverrides(
      [
        {
          id: '  db-kling-precise  ',
          engineId: '  kling-3-pro  ',
          mode: '  t2v  ',
          resolution: '  1080p  ',
          marginPercent: 0.31,
          marginFlatCents: 2,
          surchargeAudioPercent: 0.21,
          surchargeUpscalePercent: 0.51,
          currency: ' usd ',
          compatibilityProfile: ' standard ',
        },
      ],
      policy,
      {
        engineIds: new Set(['kling-3-pro']),
        modesByEngineId: new Map([['kling-3-pro', new Set(['t2v'])]]),
        resolutionsByEngineId: new Map([['kling-3-pro', new Set(['1080p'])]]),
      }
    ),
    [
      {
        id: 'db-kling-precise',
        engineId: 'kling-3-pro',
        mode: 't2v',
        resolution: '1080p',
        marginPercent: 0.31,
        marginFlatCents: 2,
        surchargeAudioPercent: 0.21,
        surchargeUpscalePercent: 0.51,
        currency: 'USD',
        compatibilityProfile: 'standard',
      },
    ]
  );
});

test('database override validation rejects unknown references and ambiguity within only the override set', async () => {
  const { PricingPolicyValidationError, validatePricingPolicyOverrides } = await import('../packages/pricing/src/policy.ts');
  const { getVersionedPricingPolicy } = await import('../frontend/src/lib/pricing-policy-defaults.ts');
  const policy = getVersionedPricingPolicy();
  const references = { engineIds: new Set(['kling-3-pro']) };

  assert.throws(
    () => validatePricingPolicyOverrides([rule('unknown', { engineId: 'missing' })], policy, references),
    (error: unknown) => error instanceof PricingPolicyValidationError && error.code === 'unknown_engine'
  );
  assert.throws(
    () =>
      validatePricingPolicyOverrides(
        [rule('one', { engineId: 'kling-3-pro' }), rule('two', { engineId: 'kling-3-pro' })],
        policy,
        references
      ),
    (error: unknown) => error instanceof PricingPolicyValidationError && error.code === 'ambiguous_selector'
  );
  assert.throws(
    () => validatePricingPolicyOverrides([rule('orphan-mode', { mode: 't2v' })], policy, references),
    (error: unknown) => error instanceof PricingPolicyValidationError && error.code === 'invalid_document'
  );
  assert.throws(
    () => validatePricingPolicyOverrides([rule('orphan-resolution', { resolution: '1080p' })], policy, references),
    (error: unknown) => error instanceof PricingPolicyValidationError && error.code === 'invalid_document'
  );
});

test('database override validation allows a selector that intentionally overlaps a versioned selector', async () => {
  const { validatePricingPolicyOverrides } = await import('../packages/pricing/src/policy.ts');
  const { getVersionedPricingPolicy } = await import('../frontend/src/lib/pricing-policy-defaults.ts');
  const policy = getVersionedPricingPolicy();

  const overrides = validatePricingPolicyOverrides(
    [rule('db-audio', { engineId: 'audio-generation' })],
    policy,
    { engineIds: new Set(['audio-generation']) }
  );

  assert.equal(overrides.length, 1);
  assert.equal(overrides[0]?.engineId, 'audio-generation');
});

test('database override IDs cannot collide with validation internals', async () => {
  const { validatePricingPolicyOverrides } = await import('../packages/pricing/src/policy.ts');
  const { getVersionedPricingPolicy } = await import('../frontend/src/lib/pricing-policy-defaults.ts');
  const internalLookingId = '__pricing_override_validation_global__';

  const overrides = validatePricingPolicyOverrides(
    [rule(internalLookingId, { engineId: 'kling-3-pro' })],
    getVersionedPricingPolicy(),
    { engineIds: new Set(['kling-3-pro']) }
  );

  assert.equal(overrides[0]?.id, internalLookingId);
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

const persistedRuleRow = {
  id: 'rule-kling-t2v-1080p',
  engine_id: 'kling-3-pro',
  mode: 't2v',
  resolution: '1080p',
  margin_percent: '0.300000',
  margin_flat_cents: 0,
  surcharge_audio_percent: '0.200000',
  surcharge_upscale_percent: '0.500000',
  currency: 'USD',
  compatibility_profile: 'standard',
  vendor_account_id: 'acct_existing',
  effective_from: null,
  updated_at: '2026-07-12T10:00:00.000Z',
  updated_by: '00000000-0000-0000-0000-000000000001',
};

test('pricing rule row mapping round-trips the complete canonical rule fields', async () => {
  const { mapPricingRuleRow } = await import('../frontend/src/lib/pricing-rule-store.ts');

  assert.deepEqual(mapPricingRuleRow(persistedRuleRow), {
    id: 'rule-kling-t2v-1080p',
    engineId: 'kling-3-pro',
    mode: 't2v',
    resolution: '1080p',
    marginPercent: 0.3,
    marginFlatCents: 0,
    surchargeAudioPercent: 0.2,
    surchargeUpscalePercent: 0.5,
    currency: 'USD',
    compatibilityProfile: 'standard',
    vendorAccountId: 'acct_existing',
    updatedAt: '2026-07-12T10:00:00.000Z',
    updatedBy: '00000000-0000-0000-0000-000000000001',
  });
});

test('executor-aware pricing rule upsert preserves routing on update and leaves routing null on create', async () => {
  const { upsertPricingRuleWithExecutor } = await import('../frontend/src/lib/pricing-rule-store.ts');
  const calls: Array<{ text: string; params?: ReadonlyArray<unknown> }> = [];
  const executor = {
    async query<TRecord = unknown>(text: string, params?: ReadonlyArray<unknown>): Promise<TRecord[]> {
      calls.push({ text, params });
      return [persistedRuleRow] as TRecord[];
    },
  };

  const rule = await upsertPricingRuleWithExecutor(
    executor,
    {
      id: 'rule-kling-t2v-1080p',
      engineId: 'kling-3-pro',
      mode: 't2v',
      resolution: '1080p',
      marginPercent: 0.3,
      marginFlatCents: 0,
      surchargeAudioPercent: 0.2,
      surchargeUpscalePercent: 0.5,
      currency: 'USD',
      compatibilityProfile: 'standard',
      vendorAccountId: 'must-not-be-written',
    },
    '00000000-0000-0000-0000-000000000001'
  );

  assert.equal(rule.vendorAccountId, 'acct_existing');
  assert.equal(calls.length, 1);
  const updateClause = calls[0]!.text.split('DO UPDATE SET')[1]?.split('RETURNING')[0] ?? '';
  assert.doesNotMatch(updateClause, /vendor_account_id/);
  assert.equal(calls[0]!.params?.[10], null);
  assert.equal(calls[0]!.params?.[11], '00000000-0000-0000-0000-000000000001');
});

test('executor-aware pricing rule delete returns the previous canonical row', async () => {
  const { deletePricingRuleWithExecutor } = await import('../frontend/src/lib/pricing-rule-store.ts');
  const calls: Array<{ text: string; params?: ReadonlyArray<unknown> }> = [];
  const executor = {
    async query<TRecord = unknown>(text: string, params?: ReadonlyArray<unknown>): Promise<TRecord[]> {
      calls.push({ text, params });
      return [persistedRuleRow] as TRecord[];
    },
  };

  const previous = await deletePricingRuleWithExecutor(executor, persistedRuleRow.id);

  assert.equal(previous.id, persistedRuleRow.id);
  assert.equal(previous.vendorAccountId, 'acct_existing');
  assert.match(calls[0]!.text, /DELETE FROM app_pricing_rules/);
  assert.match(calls[0]!.text, /RETURNING/);
});

test('transaction-local pricing override reads lock the authoritative rows', async () => {
  const { loadPricingPolicyOverridesWithExecutor } = await import('../frontend/src/lib/pricing-rule-store.ts');
  const calls: Array<{ text: string; params?: ReadonlyArray<unknown> }> = [];
  const executor = {
    async query<TRecord = unknown>(text: string, params?: ReadonlyArray<unknown>): Promise<TRecord[]> {
      calls.push({ text, params });
      return [persistedRuleRow] as TRecord[];
    },
  };

  const result = await loadPricingPolicyOverridesWithExecutor(executor, { lock: true });

  assert.equal(result.status, 'loaded');
  assert.match(calls[0]?.text ?? '', /LOCK TABLE app_pricing_rules IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(calls[1]?.text ?? '', /FOR UPDATE/);
});
