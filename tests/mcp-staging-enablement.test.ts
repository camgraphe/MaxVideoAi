import assert from 'node:assert/strict';
import test from 'node:test';

import { isMcpFoundationFeatureEnabled } from '../frontend/src/server/mcp/feature-access';
import { resolveMcpRuntimeCapabilities } from '../frontend/src/server/mcp/operational-access';

const stagingEnv = {
  NODE_ENV: 'production',
  MCP_STAGING_ENABLED: 'true',
  MCP_STAGING_HOST: 'maxvideoai-mcp-staging.vercel.app',
  MCP_API_HOST: 'maxvideoai-mcp-staging.vercel.app',
  MCP_RESOURCE_URL: 'https://maxvideoai-mcp-staging.vercel.app/mcp',
};

const operationalStagingEnv = {
  ...stagingEnv,
  MCP_STAGING_OPERATIONAL_ENABLED: 'true',
  MCP_STAGING_REFERENCE_CLEANUP_ENABLED: 'true',
  MCP_STAGING_REFERENCE_STORAGE_PREFIX: 'mcp-reference-staging/',
  CRON_SECRET: 'test-only-cleanup-secret',
};

test('hosted staging enables only foundation features on the exact staging host', () => {
  const requestHost = 'maxvideoai-mcp-staging.vercel.app';
  assert.equal(isMcpFoundationFeatureEnabled('transport', stagingEnv, requestHost), true);
  assert.equal(isMcpFoundationFeatureEnabled('oauth', stagingEnv, requestHost), true);
  assert.equal(isMcpFoundationFeatureEnabled('discovery', stagingEnv, requestHost), true);
});

test('operational capabilities enable only on the exact hosted staging authority', () => {
  const enabled = resolveMcpRuntimeCapabilities(
    operationalStagingEnv,
    'maxvideoai-mcp-staging.vercel.app',
  );

  assert.deepEqual(enabled, { paidGeneration: true, referenceUploads: true });
  assert.equal(Object.isFrozen(enabled), true);

  for (const host of ['maxvideoai.com', 'www.maxvideoai.com', 'api.maxvideoai.com', 'other.vercel.app']) {
    assert.deepEqual(resolveMcpRuntimeCapabilities({
      ...operationalStagingEnv,
    }, host), { paidGeneration: false, referenceUploads: false });
  }
});

test('operational staging keeps reference uploads closed without the authenticated cleanup path', () => {
  const host = 'maxvideoai-mcp-staging.vercel.app';
  for (const overrides of [
    { MCP_STAGING_REFERENCE_CLEANUP_ENABLED: undefined },
    { MCP_STAGING_REFERENCE_CLEANUP_ENABLED: 'false' },
    { MCP_STAGING_REFERENCE_STORAGE_PREFIX: undefined },
    { MCP_STAGING_REFERENCE_STORAGE_PREFIX: 'user-assets/' },
    { CRON_SECRET: undefined },
    { CRON_SECRET: '   ' },
  ]) {
    assert.deepEqual(resolveMcpRuntimeCapabilities({
      ...operationalStagingEnv,
      ...overrides,
    }, host), { paidGeneration: true, referenceUploads: false });
  }
});

test('operational capabilities reject a differently configured non-production host', () => {
  const otherHostEnv = {
    ...stagingEnv,
    MCP_STAGING_HOST: 'other.vercel.app',
    MCP_API_HOST: 'other.vercel.app',
    MCP_RESOURCE_URL: 'https://other.vercel.app/mcp',
    MCP_STAGING_OPERATIONAL_ENABLED: 'true',
  };

  assert.deepEqual(resolveMcpRuntimeCapabilities(otherHostEnv, 'other.vercel.app'), {
    paidGeneration: false,
    referenceUploads: false,
  });
});

test('the operational staging flag cannot widen the local development bypass', () => {
  assert.deepEqual(resolveMcpRuntimeCapabilities({
    NODE_ENV: 'development',
    MCP_LOCAL_ENABLED: 'true',
    MCP_API_HOST: '127.0.0.1:3000',
    MCP_RESOURCE_URL: 'http://127.0.0.1:3000/mcp',
    MCP_STAGING_OPERATIONAL_ENABLED: 'true',
  }, '127.0.0.1:3000'), {
    paidGeneration: false,
    referenceUploads: false,
  });
});

test('hosted staging fails closed when the request host is missing, production, or mismatched', () => {
  for (const requestHost of [undefined, null, '', 'maxvideoai.com', 'api.maxvideoai.com', 'other.vercel.app']) {
    assert.equal(isMcpFoundationFeatureEnabled('transport', stagingEnv, requestHost), false);
  }
});

test('hosted staging fails closed without an explicit staging host', () => {
  const { MCP_STAGING_HOST: _stagingHost, ...envWithoutStagingHost } = stagingEnv;
  assert.equal(
    isMcpFoundationFeatureEnabled('transport', envWithoutStagingHost, 'maxvideoai-mcp-staging.vercel.app'),
    false,
  );
});

test('hosted staging fails closed for missing, mismatched, insecure, and production hosts', () => {
  const requestHost = 'maxvideoai-mcp-staging.vercel.app';
  assert.equal(isMcpFoundationFeatureEnabled('transport', { ...stagingEnv, MCP_STAGING_ENABLED: 'false' }, requestHost), false);
  assert.equal(isMcpFoundationFeatureEnabled('transport', { ...stagingEnv, MCP_API_HOST: 'other.vercel.app' }, requestHost), false);
  assert.equal(isMcpFoundationFeatureEnabled('transport', { ...stagingEnv, MCP_RESOURCE_URL: 'http://maxvideoai-mcp-staging.vercel.app/mcp' }, requestHost), false);

  for (const host of ['maxvideoai.com', 'www.maxvideoai.com', 'api.maxvideoai.com']) {
    assert.equal(
      isMcpFoundationFeatureEnabled('transport', {
        ...stagingEnv,
        MCP_STAGING_HOST: host,
        MCP_API_HOST: host,
        MCP_RESOURCE_URL: `https://${host}/mcp`,
      }, requestHost),
      false
    );
  }
});

test('hosted staging rejects production hosts with a terminal DNS dot', () => {
  for (const host of ['maxvideoai.com.', 'www.maxvideoai.com.', 'api.maxvideoai.com.']) {
    assert.equal(
      isMcpFoundationFeatureEnabled('transport', {
        ...stagingEnv,
        MCP_STAGING_HOST: host,
        MCP_API_HOST: host,
        MCP_RESOURCE_URL: `https://${host}/mcp`,
      }, 'maxvideoai-mcp-staging.vercel.app'),
      false
    );
  }
});
