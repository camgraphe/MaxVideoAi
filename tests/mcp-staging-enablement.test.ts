import assert from 'node:assert/strict';
import test from 'node:test';

import { isMcpFoundationFeatureEnabled } from '../frontend/src/server/mcp/feature-access';

const stagingEnv = {
  NODE_ENV: 'production',
  MCP_STAGING_ENABLED: 'true',
  MCP_STAGING_HOST: 'maxvideoai-mcp-staging.vercel.app',
  MCP_API_HOST: 'maxvideoai-mcp-staging.vercel.app',
  MCP_RESOURCE_URL: 'https://maxvideoai-mcp-staging.vercel.app/mcp',
};

test('hosted staging enables only foundation features on the exact staging host', () => {
  assert.equal(isMcpFoundationFeatureEnabled('transport', stagingEnv), true);
  assert.equal(isMcpFoundationFeatureEnabled('oauth', stagingEnv), true);
  assert.equal(isMcpFoundationFeatureEnabled('discovery', stagingEnv), true);
});

test('hosted staging fails closed without an explicit staging host', () => {
  const { MCP_STAGING_HOST: _stagingHost, ...envWithoutStagingHost } = stagingEnv;
  assert.equal(isMcpFoundationFeatureEnabled('transport', envWithoutStagingHost), false);
});

test('hosted staging fails closed for missing, mismatched, insecure, and production hosts', () => {
  assert.equal(isMcpFoundationFeatureEnabled('transport', { ...stagingEnv, MCP_STAGING_ENABLED: 'false' }), false);
  assert.equal(isMcpFoundationFeatureEnabled('transport', { ...stagingEnv, MCP_API_HOST: 'other.vercel.app' }), false);
  assert.equal(isMcpFoundationFeatureEnabled('transport', { ...stagingEnv, MCP_RESOURCE_URL: 'http://maxvideoai-mcp-staging.vercel.app/mcp' }), false);

  for (const host of ['maxvideoai.com', 'www.maxvideoai.com', 'api.maxvideoai.com']) {
    assert.equal(
      isMcpFoundationFeatureEnabled('transport', {
        ...stagingEnv,
        MCP_STAGING_HOST: host,
        MCP_API_HOST: host,
        MCP_RESOURCE_URL: `https://${host}/mcp`,
      }),
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
      }),
      false
    );
  }
});
