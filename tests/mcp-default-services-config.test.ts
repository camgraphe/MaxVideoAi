import assert from 'node:assert/strict';
import test from 'node:test';

import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type { McpGenerationQuote } from '../frontend/src/server/agent-api/quote-repository';
import { resolveMcpConfig, type McpConfig } from '../frontend/src/server/mcp/config';
import { createDefaultMaxVideoAiMcpServices } from '../frontend/src/server/mcp/server';

const principal: AgentPrincipal = {
  userId: 'staging-user',
  clientId: 'claude-desktop',
  emailVerified: true,
  authMethod: 'oauth',
};
const disabledCapabilities = Object.freeze({ paidGeneration: false, referenceUploads: false });
const operationalCapabilities = Object.freeze({ paidGeneration: true, referenceUploads: true });

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
    const services = createDefaultMaxVideoAiMcpServices(
      config(new URL(expectedAccountUrl).origin),
      { clientIp: null, userAgent: null },
      disabledCapabilities,
      { getWalletSummary },
    );

    const status = await services.getAccountStatus(principal);

    assert.equal(status.accountUrl, expectedAccountUrl);
    assert.deepEqual(status.wallet, { amountCents: 0, currency: 'USD', pendingCents: 0 });
  }
});

test('official staging config reaches the real default top-up service while custom HTTPS origins stay rejected', async () => {
  const stagingConfig = resolveMcpConfig({
    NODE_ENV: 'production',
    MCP_API_HOST: 'maxvideoai-mcp-staging.vercel.app',
    MCP_RESOURCE_URL: 'https://maxvideoai-mcp-staging.vercel.app/mcp',
  });
  const request = {
    schemaVersion: 1 as const,
    surface: 'video' as const,
    engineId: 'seedance-2-0-mini',
    mode: 't2v' as const,
    prompt: 'private staging prompt',
    settings: { durationSec: 5 },
    references: [],
    outputCount: 1 as const,
  };
  const now = new Date('2026-07-16T12:00:00.000Z');
  const quote: McpGenerationQuote = {
    quoteId: '123e4567-e89b-42d3-a456-426614174000',
    userId: principal.userId,
    oauthClientId: principal.clientId,
    request,
    requestHash: hashCanonicalGenerationRequest(request),
    catalogRevision: 'staging-catalog',
    pricingSnapshot: { totalCents: 1500 },
    priceCents: 1500,
    currency: 'USD',
    fundingMode: 'wallet',
    trialFunding: null,
    state: 'prepared',
    jobId: null,
    expiresAt: new Date('2026-07-16T12:10:00.000Z'),
    claimedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const executor = { async query() { throw new Error('unexpected query'); } } as TransactionQueryExecutor;
  const events: string[] = [];
  const services = createDefaultMaxVideoAiMcpServices(
    stagingConfig,
    { clientIp: null, userAgent: null },
    operationalCapabilities,
    undefined,
    {
      secret: '0123456789abcdef0123456789abcdef',
      randomUUID: () => '123e4567-e89b-42d3-a456-426614174001',
      withTransaction: async (callback) => {
        events.push('transaction');
        return callback(executor);
      },
      lockOwnedQuote: async () => {
        events.push('lock');
        return { quote, databaseNow: now };
      },
      getWalletSummary: async () => {
        events.push('wallet');
        return { balanceCents: 0, currency: 'USD', pendingCents: 0, hasCompletedTopUp: false };
      },
      invalidatePreparedQuote: async () => {
        events.push('invalidate');
        return { ...quote, state: 'expired' };
      },
    },
  );
  const result = await services.createTopupLink?.({ quoteId: quote.quoteId }, principal);
  assert.ok(result && 'destination' in result);
  assert.equal(new URL(result.destination.url).origin, 'https://maxvideoai-mcp-staging.vercel.app');
  assert.deepEqual(events, ['transaction', 'lock', 'wallet', 'invalidate']);

  const customConfig = config('https://custom-preview.example');
  assert.throws(
    () => createDefaultMaxVideoAiMcpServices(
      customConfig,
      { clientIp: null, userAgent: null },
      disabledCapabilities,
      undefined,
      {
        secret: '0123456789abcdef0123456789abcdef',
        withTransaction: async () => { throw new Error('must not start a transaction'); },
      },
    ),
    /trusted MaxVideoAI account URL|unexpected origin/i,
  );
});

test('default MCP services scope Google canary executability to the exact staging principal', async () => {
  const runtimeEnv = {
    NODE_ENV: 'production',
    MCP_STAGING_OPERATIONAL_ENABLED: 'true',
    MCP_STAGING_CANARY_ACCOUNT_IDS: principal.userId,
    MCP_STAGING_CANARY_CLIENT_IDS: principal.clientId,
    GOOGLE_VERTEX_PROJECT_ID: 'staging-project',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"staging@example.com","private_key":"key"}',
    GOOGLE_VERTEX_INPUT_GCS_URI: 'gs://staging-inputs/mcp',
    GOOGLE_VERTEX_IMAGE_MCP_ENABLED: 'false',
    GOOGLE_VERTEX_IMAGE_MCP_PUBLIC_ROUTING_ENABLED: 'false',
    GOOGLE_VERTEX_IMAGE_MCP_ENGINE_ALLOWLIST: 'nano-banana-lite',
    GOOGLE_VERTEX_VEO_ENABLED: 'false',
    GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED: 'false',
    GOOGLE_VERTEX_VEO_ADMIN_ONLY: 'true',
  } as NodeJS.ProcessEnv;
  const services = createDefaultMaxVideoAiMcpServices(
    config('https://maxvideoai-mcp-staging.vercel.app'),
    { clientIp: null, userAgent: null },
    operationalCapabilities,
    undefined,
    undefined,
    runtimeEnv,
  );

  const allowedImage = await services.getModelDetails('nano-banana-lite', principal);
  const allowedVeo = await services.getModelDetails('veo-3-1-lite', principal);
  const blockedImage = await services.getModelDetails('nano-banana-lite', {
    ...principal,
    clientId: 'another-client',
  });

  assert.equal(allowedImage.generationEnabled, true);
  assert.equal(allowedVeo.generationEnabled, true);
  assert.equal(blockedImage.generationEnabled, false);
});
