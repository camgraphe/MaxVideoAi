import assert from 'node:assert/strict';
import test from 'node:test';

import { isMcpFoundationFeatureEnabled } from '../frontend/src/server/mcp/feature-access';

const loopbackEnv = {
  NODE_ENV: 'development',
  MCP_LOCAL_ENABLED: 'true',
  MCP_API_HOST: '127.0.0.1:3000',
  MCP_RESOURCE_URL: 'http://127.0.0.1:3000/mcp',
};

test('local MCP override enables only foundation features with explicit loopback config', () => {
  assert.equal(isMcpFoundationFeatureEnabled('transport', loopbackEnv), true);
  assert.equal(isMcpFoundationFeatureEnabled('oauth', loopbackEnv), true);
  assert.equal(isMcpFoundationFeatureEnabled('discovery', loopbackEnv), true);
});

test('local MCP override is disabled by default and fails closed without valid config', () => {
  assert.equal(isMcpFoundationFeatureEnabled('transport', { NODE_ENV: 'development' }), false);
  assert.equal(
    isMcpFoundationFeatureEnabled('transport', {
      NODE_ENV: 'development',
      MCP_LOCAL_ENABLED: 'true',
    }),
    false
  );
  assert.equal(
    isMcpFoundationFeatureEnabled('transport', {
      ...loopbackEnv,
      MCP_RESOURCE_URL: 'https://api.example.com/mcp',
      MCP_API_HOST: 'api.example.com',
    }),
    false
  );
});

test('local MCP override can never enable production', () => {
  assert.equal(
    isMcpFoundationFeatureEnabled('transport', {
      ...loopbackEnv,
      NODE_ENV: 'production',
    }),
    false
  );
});
