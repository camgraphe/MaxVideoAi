import assert from 'node:assert/strict';
import test from 'node:test';

import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type { McpConfig } from '../frontend/src/server/mcp/config';
import { createDefaultMaxVideoAiMcpServices } from '../frontend/src/server/mcp/server';

const principal: AgentPrincipal = {
  userId: 'staging-user',
  clientId: 'claude-desktop',
  emailVerified: true,
  authMethod: 'oauth',
};

function config(resourceOrigin: string): McpConfig {
  const resource = new URL('/mcp', resourceOrigin);
  return {
    apiHost: resource.host,
    resourceUrl: resource.toString(),
    protectedResourceMetadataUrl: new URL(
      '/.well-known/oauth-protected-resource/mcp',
      resourceOrigin,
    ).toString(),
    accountUrl: new URL('/account/connections', resourceOrigin).toString(),
  };
}

test('default account service uses the resolved MCP account URL for production and staging', async () => {
  const getWalletSummary = async () => ({
    balanceCents: 0,
    currency: 'USD',
    pendingCents: 0,
    hasCompletedTopUp: false,
  });

  for (const expectedAccountUrl of [
    'https://maxvideoai.com/account/connections',
    'https://maxvideoai-mcp-staging.vercel.app/account/connections',
  ]) {
    const services = createDefaultMaxVideoAiMcpServices(config(new URL(expectedAccountUrl).origin), {
      getWalletSummary,
    });

    const status = await services.getAccountStatus(principal);

    assert.equal(status.accountUrl, expectedAccountUrl);
    assert.deepEqual(status.wallet, { amountCents: 0, currency: 'USD', pendingCents: 0 });
  }
});
