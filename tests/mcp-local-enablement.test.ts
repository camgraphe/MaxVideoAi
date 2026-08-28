import assert from 'node:assert/strict';
import test from 'node:test';

import { isMcpFoundationFeatureEnabled } from '../frontend/src/server/mcp/feature-access';

const unpublishedFoundation = {
  transport: false,
  oauth: false,
  discovery: false,
} as const;

const loopbackEnv = {
  NODE_ENV: 'development',
  MCP_LOCAL_ENABLED: 'true',
  MCP_API_HOST: '127.0.0.1:3000',
  MCP_RESOURCE_URL: 'http://127.0.0.1:3000/mcp',
};

test('local MCP override enables only foundation features with explicit loopback config', () => {
  assert.equal(isMcpFoundationFeatureEnabled('transport', loopbackEnv, '127.0.0.1:3000', unpublishedFoundation), true);
  assert.equal(isMcpFoundationFeatureEnabled('oauth', loopbackEnv, '127.0.0.1:3000', unpublishedFoundation), true);
  assert.equal(isMcpFoundationFeatureEnabled('discovery', loopbackEnv, '127.0.0.1:3000', unpublishedFoundation), true);
});

test('local MCP override fails closed without the exact request host and port', () => {
  for (const requestHost of [undefined, null, '', '127.0.0.1', '127.0.0.1:3001', 'localhost:3000']) {
    assert.equal(isMcpFoundationFeatureEnabled('transport', loopbackEnv, requestHost, unpublishedFoundation), false);
  }
});

test('local MCP override is disabled by default and fails closed without valid config', () => {
  assert.equal(
    isMcpFoundationFeatureEnabled(
      'transport',
      { NODE_ENV: 'development' },
      '127.0.0.1:3000',
      unpublishedFoundation,
    ),
    false,
  );
  assert.equal(
    isMcpFoundationFeatureEnabled('transport', {
      NODE_ENV: 'development',
      MCP_LOCAL_ENABLED: 'true',
    }, '127.0.0.1:3000', unpublishedFoundation),
    false
  );
  assert.equal(
    isMcpFoundationFeatureEnabled('transport', {
      ...loopbackEnv,
      MCP_RESOURCE_URL: 'https://api.example.com/mcp',
      MCP_API_HOST: 'api.example.com',
    }, 'api.example.com', unpublishedFoundation),
    false
  );
});

test('local MCP override can never enable production', () => {
  assert.equal(
    isMcpFoundationFeatureEnabled('transport', {
      ...loopbackEnv,
      NODE_ENV: 'production',
    }, '127.0.0.1:3000', unpublishedFoundation),
    false
  );
});
