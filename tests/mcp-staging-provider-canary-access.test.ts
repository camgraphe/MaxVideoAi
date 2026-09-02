import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import { resolveAgentGenerationEngineExecutability } from '../frontend/src/server/agent-runtime/model-executability';
import { resolveMcpStagingCanaryGenerationEnvironment } from '../frontend/src/server/mcp/provider-canary-access';

const principal: AgentPrincipal = {
  userId: 'staging-canary-account',
  clientId: 'staging-canary-client',
  emailVerified: true,
  authMethod: 'oauth',
};

const stagingEnv = {
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
  GOOGLE_VERTEX_OMNI_ENABLED: 'false',
  GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED: 'false',
  GOOGLE_VERTEX_OMNI_ADMIN_ONLY: 'true',
} as NodeJS.ProcessEnv;

function engine(id: string) {
  const value = listFalEngines().find((entry) => entry.id === id)?.engine;
  assert.ok(value, `${id} should be registered`);
  return value;
}

test('the exact staging account and OAuth client get private Google canary execution without mutating public flags', () => {
  const environment = resolveMcpStagingCanaryGenerationEnvironment(
    principal,
    'https://maxvideoai-mcp-staging.vercel.app/account/connections',
    stagingEnv,
  );

  assert.deepEqual(
    resolveAgentGenerationEngineExecutability(engine('nano-banana-lite'), environment),
    { executable: true, reason: 'available' },
  );
  assert.deepEqual(
    resolveAgentGenerationEngineExecutability(engine('veo-3-1-lite'), environment),
    { executable: true, reason: 'available' },
  );
  assert.deepEqual(
    resolveAgentGenerationEngineExecutability(engine('gemini-omni-flash'), environment),
    { executable: true, reason: 'available' },
  );
  assert.equal(stagingEnv.GOOGLE_VERTEX_IMAGE_MCP_ENABLED, 'false');
  assert.equal(stagingEnv.GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED, 'false');
  assert.equal(stagingEnv.GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED, 'false');
});

test('canary access fails closed outside the exact staging host, account, client, and operational mode', () => {
  const cases: Array<{
    principal: AgentPrincipal;
    accountUrl: string;
    env: NodeJS.ProcessEnv;
  }> = [
    { principal, accountUrl: 'https://maxvideoai.com/account/connections', env: stagingEnv },
    { principal: { ...principal, userId: 'other-account' }, accountUrl: 'https://maxvideoai-mcp-staging.vercel.app/account/connections', env: stagingEnv },
    { principal: { ...principal, clientId: 'other-client' }, accountUrl: 'https://maxvideoai-mcp-staging.vercel.app/account/connections', env: stagingEnv },
    { principal: { ...principal, clientId: null }, accountUrl: 'https://maxvideoai-mcp-staging.vercel.app/account/connections', env: stagingEnv },
    {
      principal,
      accountUrl: 'https://maxvideoai-mcp-staging.vercel.app/account/connections',
      env: { ...stagingEnv, MCP_STAGING_OPERATIONAL_ENABLED: 'false' },
    },
  ];

  for (const item of cases) {
    const environment = resolveMcpStagingCanaryGenerationEnvironment(item.principal, item.accountUrl, item.env);
    assert.deepEqual(
      resolveAgentGenerationEngineExecutability(engine('veo-3-1-lite'), environment),
      { executable: false, reason: 'provider_disabled' },
    );
  }
});

test('an additional staging client can be rotated in without replacing the primary allowlist', () => {
  const additionalClient = 'staging-qa-client';
  const environment = resolveMcpStagingCanaryGenerationEnvironment(
    { ...principal, clientId: additionalClient },
    'https://maxvideoai-mcp-staging.vercel.app/account/connections',
    {
      ...stagingEnv,
      MCP_STAGING_CANARY_CLIENT_IDS: 'primary-client-stays-authorized',
      MCP_STAGING_CANARY_ADDITIONAL_CLIENT_IDS: additionalClient,
    },
  );

  assert.deepEqual(
    resolveAgentGenerationEngineExecutability(engine('veo-3-1-lite'), environment),
    { executable: true, reason: 'available' },
  );
});

test('the image canary remains bounded by the authored engine allowlist', () => {
  const environment = resolveMcpStagingCanaryGenerationEnvironment(
    principal,
    'https://maxvideoai-mcp-staging.vercel.app/account/connections',
    stagingEnv,
  );

  assert.deepEqual(
    resolveAgentGenerationEngineExecutability(engine('nano-banana-2'), environment),
    { executable: false, reason: 'provider_disabled' },
  );
});

test('catalog, budget, quote preparation, confirmation, and paid submission share the same principal-scoped canary environment', () => {
  const source = readFileSync('frontend/src/server/mcp/server.ts', 'utf8');
  assert.match(source, /calculateAgentProjectBudget\([\s\S]*createAgentProjectBudgetDependencies\(catalogDepsFor\(principal\), prelaunchAccessFor\(principal\)\)/);
  assert.match(source, /prepareGeneration:\s*\(input, principal\)[\s\S]*listPublicAgentGenerationEngines\([\s\S]*catalogDepsFor\(principal\),[\s\S]*prelaunchAccessFor\(principal\)/);
  assert.match(source, /resolveAgentGenerationRequestExecutability\([\s\S]*generationEnvironmentFor\(principal\)/);
  assert.match(source, /confirmGeneration:\s*\(input, principal\)[\s\S]*listPublicAgentGenerationEnginesInExecutor\([\s\S]*generationEnvironmentFor\(principal\),[\s\S]*prelaunchAccessFor\(principal\)/);
  assert.match(
    source,
    /submitPaidGeneration:\s*\(execution\)\s*=>\s*submitReservedPaidGeneration\([\s\S]*generationEnvironmentFor\(principal\)\.providerEnv/,
  );
});
