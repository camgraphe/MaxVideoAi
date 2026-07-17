import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { getAgentAccountStatus } from '../frontend/src/server/agent-api/account-status';
import { listPublicAgentGenerationEngines } from '../frontend/src/server/agent-api/model-catalog';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type {
  TrialEntitlement,
  TrialEntitlementStatus,
} from '../frontend/src/server/agent-api/trial-entitlement-repository';
import {
  getTrialEligibility,
  type TrialEligibilityDependencies,
} from '../frontend/src/server/agent-api/trial-eligibility';
import {
  MCP_TRIAL_PRESET,
  TrialPresetUnsupportedError,
} from '../frontend/src/server/agent-api/trial-preset';

const VERIFICATION_URL = 'https://maxvideoai.com/account/connections';
const createdAt = new Date('2026-07-17T09:00:00.000Z');

function principal(userId: string, emailVerified: boolean): AgentPrincipal {
  return { userId, clientId: 'oauth-client', emailVerified, authMethod: 'oauth' };
}

function entitlement(
  status: TrialEntitlementStatus,
  overrides: Partial<TrialEntitlement> = {},
): TrialEntitlement {
  return {
    userId: 'user-1',
    status,
    reservedQuoteId: null,
    jobId: null,
    reservedAt: null,
    consumedAt: null,
    releasedAt: null,
    createdAt,
    updatedAt: createdAt,
    lastReasonCode: null,
    ...overrides,
  };
}

async function currentTrialCandidate() {
  const engine = listFalEngines().find((entry) => entry.id === MCP_TRIAL_PRESET.engineId)?.engine;
  assert.ok(engine, 'the configured trial engine must exist');
  const candidates = await listPublicAgentGenerationEngines({
    listEngines: async () => [engine],
    surfaceByEngineId: () => 'video',
  });
  const candidate = candidates.find((entry) => entry.engine.id === MCP_TRIAL_PRESET.engineId);
  assert.ok(candidate, 'the configured trial engine must be public');
  return candidate;
}

async function enabledDependencies(
  overrides: Partial<TrialEligibilityDependencies> = {},
): Promise<TrialEligibilityDependencies> {
  const candidate = await currentTrialCandidate();
  return {
    featureEnabled: true,
    environmentEnabled: 'true',
    verificationUrl: VERIFICATION_URL,
    async getAccountRestriction() {
      return null;
    },
    async getEntitlement() {
      return null;
    },
    async listPublicEngines() {
      return [candidate];
    },
    assertPresetSupported() {},
    ...overrides,
  };
}

test('the direct eligibility gate fails closed without touching protected dependencies', async () => {
  for (const gates of [
    { featureEnabled: false, environmentEnabled: 'true' },
    { featureEnabled: true, environmentEnabled: undefined },
    { featureEnabled: true, environmentEnabled: 'TRUE' },
    { featureEnabled: true, environmentEnabled: ' true ' },
    { featureEnabled: true, environmentEnabled: '1' },
  ] as const) {
    const calls: string[] = [];
    const status = await getTrialEligibility(
      principal('disabled-user', true),
      await enabledDependencies({
        ...gates,
        async getAccountRestriction() {
          calls.push('restriction');
          return null;
        },
        async getEntitlement() {
          calls.push('entitlement');
          return null;
        },
        async listPublicEngines() {
          calls.push('catalog');
          return [];
        },
      }),
    );
    assert.deepEqual(status, { status: 'disabled' });
    assert.deepEqual(calls, []);
  }
});

test('unverified accounts receive only the trusted MaxVideoAI verification action', async () => {
  const calls: string[] = [];
  const status = await getTrialEligibility(
    principal('unverified-user', false),
    await enabledDependencies({
      async getAccountRestriction() {
        calls.push('restriction');
        return null;
      },
      async getEntitlement() {
        calls.push('entitlement');
        return null;
      },
      async listPublicEngines() {
        calls.push('catalog');
        return [];
      },
    }),
  );

  assert.deepEqual(status, {
    status: 'verification_required',
    nextAction: { type: 'verify_email', url: VERIFICATION_URL },
  });
  assert.deepEqual(calls, []);
  assert.doesNotMatch(JSON.stringify(status), /unverified-user|oauth-client|email@|claims|token/i);
});

for (const productCase of ['verified password account', 'confirmed Google account']) {
  test(`${productCase} is eligible using only the principal verification bit`, async () => {
    const status = await getTrialEligibility(
      principal(productCase.replaceAll(' ', '-'), true),
      await enabledDependencies(),
    );

    assert.deepEqual(status, {
      status: 'available',
      preset: {
        engineId: 'seedance-2-0-mini',
        surface: 'video',
        mode: 't2v',
        durationSec: 5,
        resolution: '480p',
        aspectRatios: ['16:9', '9:16', '1:1'],
        audioOptional: true,
        outputCount: 1,
      },
    });
    assert.equal(Object.isFrozen(status), true);
    assert.equal(status.status === 'available' && Object.isFrozen(status.preset), true);
    assert.equal(
      status.status === 'available' && Object.isFrozen(status.preset.aspectRatios),
      true,
    );
    assert.doesNotMatch(JSON.stringify(status), /password|google|provider|email@|claims/i);
  });
}

test('missing, available, and released entitlements become available only after the live preset check', async () => {
  for (const state of [null, entitlement('available'), entitlement('released')] as const) {
    const calls: string[] = [];
    const status = await getTrialEligibility(
      principal('retryable-user', true),
      await enabledDependencies({
        async getAccountRestriction() {
          calls.push('restriction');
          return null;
        },
        async getEntitlement() {
          calls.push('entitlement');
          return state;
        },
        async listPublicEngines() {
          calls.push('catalog');
          return [await currentTrialCandidate()];
        },
        assertPresetSupported() {
          calls.push('preset');
        },
      }),
    );
    assert.equal(status.status, 'available');
    assert.deepEqual(calls, ['restriction', 'entitlement', 'catalog', 'preset']);
  }
});

test('reserved and consumed entitlements expose only their nullable job ID', async () => {
  for (const row of [
    entitlement('reserved', {
      reservedQuoteId: '00000000-0000-4000-8000-000000000101',
      jobId: 'job-reserved',
      reservedAt: createdAt,
      lastReasonCode: 'private_reservation_reason',
    }),
    entitlement('consumed', {
      reservedQuoteId: '00000000-0000-4000-8000-000000000102',
      jobId: null,
      consumedAt: createdAt,
      lastReasonCode: 'private_consumption_reason',
    }),
  ]) {
    let catalogCalls = 0;
    const status = await getTrialEligibility(
      principal('terminal-user', true),
      await enabledDependencies({
        async getEntitlement() {
          return row;
        },
        async listPublicEngines() {
          catalogCalls += 1;
          return [];
        },
      }),
    );
    assert.deepEqual(status, { status: row.status, jobId: row.jobId });
    assert.equal(catalogCalls, 0);
    assert.doesNotMatch(
      JSON.stringify(status),
      /quote|timestamp|reason|00000000|private_/i,
    );
  }
});

test('active restrictions fail closed without exposing restriction internals or reading later dependencies', async () => {
  const calls: string[] = [];
  const status = await getTrialEligibility(
    principal('restricted-user', true),
    await enabledDependencies({
      async getAccountRestriction() {
        calls.push('restriction');
        return {
          userId: 'restricted-user',
          reason: 'private_fraud_reason',
          message: 'private operator message',
          restrictedAt: '2026-07-17T09:00:00.000Z',
        };
      },
      async getEntitlement() {
        calls.push('entitlement');
        return null;
      },
      async listPublicEngines() {
        calls.push('catalog');
        return [];
      },
    }),
  );

  assert.deepEqual(status, {
    status: 'temporarily_unavailable',
    reason: 'account_restricted',
  });
  assert.deepEqual(calls, ['restriction']);
  assert.doesNotMatch(JSON.stringify(status), /fraud|operator|restricted-user|2026-/i);
});

test('an unsupported live preset maps only to the public preset-unavailable reason', async () => {
  const status = await getTrialEligibility(
    principal('unsupported-preset-user', true),
    await enabledDependencies({
      assertPresetSupported() {
        throw new TrialPresetUnsupportedError('private_catalog_detail');
      },
    }),
  );

  assert.deepEqual(status, {
    status: 'temporarily_unavailable',
    reason: 'preset_unavailable',
  });
  assert.doesNotMatch(JSON.stringify(status), /private|catalog_detail/i);
});

test('dependency failures map to service unavailable without leaking errors', async () => {
  for (const failingDependency of ['restriction', 'entitlement', 'catalog', 'assertion'] as const) {
    const hidden = `${failingDependency}_database_token_secret`;
    const status = await getTrialEligibility(
      principal('failure-user', true),
      await enabledDependencies({
        async getAccountRestriction() {
          if (failingDependency === 'restriction') throw new Error(hidden);
          return null;
        },
        async getEntitlement() {
          if (failingDependency === 'entitlement') throw new Error(hidden);
          return null;
        },
        async listPublicEngines() {
          if (failingDependency === 'catalog') throw new Error(hidden);
          return [await currentTrialCandidate()];
        },
        assertPresetSupported() {
          if (failingDependency === 'assertion') throw new Error(hidden);
        },
      }),
    );
    assert.deepEqual(status, {
      status: 'temporarily_unavailable',
      reason: 'service_unavailable',
    });
    assert.doesNotMatch(JSON.stringify(status), /database|token|secret/i);
  }
});

test('account status exposes enabled trial state while preserving the wallet summary', async () => {
  const trialEligibilityDependencies = await enabledDependencies();
  const status = await getAgentAccountStatus(principal('account-status-user', true), {
    async getWalletSummary() {
      return {
        balanceCents: 875,
        currency: 'USD',
        pendingCents: 125,
        hasCompletedTopUp: true,
      };
    },
    accountUrl: VERIFICATION_URL,
    trialEligibilityDependencies,
  });

  assert.equal(status.trial.status, 'available');
  assert.deepEqual(status.wallet, { amountCents: 875, currency: 'USD', pendingCents: 125 });
});

test('account status contains trial dependency failure and keeps wallet data intact', async () => {
  const status = await getAgentAccountStatus(principal('account-failure-user', true), {
    async getWalletSummary() {
      return {
        balanceCents: 640,
        currency: 'EUR',
        pendingCents: 40,
        hasCompletedTopUp: false,
      };
    },
    accountUrl: VERIFICATION_URL,
    async getTrialEligibility() {
      throw new Error('private raw database failure');
    },
  });

  assert.deepEqual(status.trial, {
    status: 'temporarily_unavailable',
    reason: 'service_unavailable',
  });
  assert.deepEqual(status.wallet, { amountCents: 640, currency: 'EUR', pendingCents: 40 });
  assert.doesNotMatch(JSON.stringify(status), /private raw|database failure/i);
});
