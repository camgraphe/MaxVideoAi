import assert from 'node:assert/strict';
import test from 'node:test';

import { getAgentAccountStatus } from '../frontend/src/server/agent-api/account-status';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';

const principal: AgentPrincipal = {
  userId: 'user-secret-id',
  clientId: 'codex-client',
  emailVerified: true,
  authMethod: 'oauth',
};

test('account status is read-only, uses the shared wallet summary, and omits email', async () => {
  let walletUserId = '';
  const status = await getAgentAccountStatus(principal, {
    async getWalletSummary(userId) {
      walletUserId = userId;
      return {
        balanceCents: 875,
        currency: 'USD',
        pendingCents: 0,
        hasCompletedTopUp: true,
      };
    },
    accountUrl: 'https://maxvideoai.com/account/connections',
  });

  assert.equal(walletUserId, 'user-secret-id');
  assert.deepEqual(status, {
    accountId: 'user-secret-id',
    emailVerified: true,
    clientId: 'codex-client',
    wallet: { amountCents: 875, currency: 'USD', pendingCents: 0 },
    trial: { status: 'disabled' },
    spendingLimits: {
      perGenerationCents: null,
      dailyCents: null,
      webApprovalAboveCents: null,
    },
    accountUrl: 'https://maxvideoai.com/account/connections',
  });
  assert.equal('email' in status, false);
  assert.equal('hasCompletedTopUp' in status.wallet, false);
});

test('account status preserves unverified state without exposing identity claims', async () => {
  const status = await getAgentAccountStatus(
    { ...principal, clientId: null, emailVerified: false },
    {
      async getWalletSummary() {
        return { balanceCents: 0, currency: 'USD', pendingCents: 0, hasCompletedTopUp: false };
      },
      accountUrl: 'https://maxvideoai.com/account/connections',
    }
  );

  assert.equal(status.emailVerified, false);
  assert.equal(status.clientId, null);
  assert.doesNotMatch(JSON.stringify(status), /email@|claims|token/i);
});
