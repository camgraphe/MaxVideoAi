import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import mcpPublication from '../frontend/config/mcp-publication.json';
import { FEATURES } from '../frontend/content/feature-flags';
import { resolveMcpConfig } from '../frontend/src/server/mcp/config';

test('the common MCP publication source owns the approved production launch state', () => {
  const expected = {
    publicMarketing: true,
    publicIndexing: true,
    transport: true,
    oauth: true,
    discovery: true,
    paidGeneration: true,
    trial: false,
    referenceUploads: true,
  };

  assert.deepEqual(mcpPublication, expected);
  assert.deepEqual(FEATURES.mcp, expected);
});

test('Supabase OAuth server is enabled for the production MCP consent flow', () => {
  const config = readFileSync('supabase/config.toml', 'utf8');
  const oauthServer = config.match(/\[auth\.oauth_server\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? '';

  assert.match(oauthServer, /^enabled = true$/m);
  assert.match(oauthServer, /^authorization_url_path = "\/oauth\/consent"$/m);
  assert.match(oauthServer, /^allow_dynamic_registration = true$/m);
});

test('public REST API references stay disabled while MCP is the only protocol integration', () => {
  assert.equal(FEATURES.docs.apiPublicRefs, false);
});

test('production MCP config defaults to the canonical API resource', () => {
  assert.deepEqual(resolveMcpConfig({ NODE_ENV: 'production' }), {
    apiHost: 'api.maxvideoai.com',
    resourceUrl: 'https://api.maxvideoai.com/mcp',
    protectedResourceMetadataUrl:
      'https://api.maxvideoai.com/.well-known/oauth-protected-resource/mcp',
    accountUrl: 'https://maxvideoai.com/account/connections',
  });
});

test('production MCP config rejects a non-HTTPS resource URL', () => {
  assert.throws(
    () =>
      resolveMcpConfig({
        NODE_ENV: 'production',
        MCP_API_HOST: 'api.maxvideoai.com',
        MCP_RESOURCE_URL: 'http://api.maxvideoai.com/mcp',
      }),
    /HTTPS/
  );
});

test('development MCP config requires an explicit loopback resource and host', () => {
  assert.throws(() => resolveMcpConfig({ NODE_ENV: 'development' }), /explicit/i);
  assert.throws(
    () =>
      resolveMcpConfig({
        NODE_ENV: 'development',
        MCP_API_HOST: 'api.example.com',
        MCP_RESOURCE_URL: 'https://api.example.com/mcp',
      }),
    /loopback/i
  );

  assert.deepEqual(
    resolveMcpConfig({
      NODE_ENV: 'development',
      MCP_API_HOST: '127.0.0.1:3000',
      MCP_RESOURCE_URL: 'http://127.0.0.1:3000/mcp',
    }),
    {
      apiHost: '127.0.0.1:3000',
      resourceUrl: 'http://127.0.0.1:3000/mcp',
      protectedResourceMetadataUrl:
        'http://127.0.0.1:3000/.well-known/oauth-protected-resource/mcp',
      accountUrl: 'http://127.0.0.1:3000/account/connections',
    }
  );
});

test('MCP API host must match the configured resource URL', () => {
  assert.throws(
    () =>
      resolveMcpConfig({
        NODE_ENV: 'production',
        MCP_API_HOST: 'other.maxvideoai.com',
        MCP_RESOURCE_URL: 'https://api.maxvideoai.com/mcp',
      }),
    /host/i
  );
});

test('hosted non-production MCP config keeps account handoff on its own origin', () => {
  const config = resolveMcpConfig({
    NODE_ENV: 'production',
    MCP_API_HOST: 'maxvideoai-mcp-staging.vercel.app',
    MCP_RESOURCE_URL: 'https://maxvideoai-mcp-staging.vercel.app/mcp',
  });
  assert.equal(
    config.accountUrl,
    'https://maxvideoai-mcp-staging.vercel.app/account/connections'
  );
});

test('canonical production API with a terminal DNS dot keeps production account handoff', () => {
  const config = resolveMcpConfig({
    NODE_ENV: 'production',
    MCP_API_HOST: 'api.maxvideoai.com.',
    MCP_RESOURCE_URL: 'https://api.maxvideoai.com./mcp',
  });
  assert.equal(config.accountUrl, 'https://maxvideoai.com/account/connections');
});
