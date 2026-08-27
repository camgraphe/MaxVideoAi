import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { FEATURES } from '../frontend/content/feature-flags';
import { ENV } from '../frontend/src/lib/env';
import * as oauthMetadataModule from '../frontend/src/server/mcp/oauth-resource-metadata';
import { buildProtectedResourceMetadata } from '../frontend/src/server/mcp/oauth-resource-metadata';
import { GET as getProtectedResourceMetadata } from '../frontend/app/.well-known/oauth-protected-resource/mcp/route';

test('protected resource metadata identifies MaxVideoAI and Supabase OAuth', () => {
  assert.deepEqual(
    buildProtectedResourceMetadata({
      resourceUrl: 'https://api.maxvideoai.com/mcp',
      supabaseUrl: 'https://project-ref.supabase.co',
    }),
    {
      resource: 'https://api.maxvideoai.com/mcp',
      resource_name: 'MaxVideoAI MCP',
      authorization_servers: ['https://project-ref.supabase.co/auth/v1'],
      bearer_methods_supported: ['header'],
      scopes_supported: ['openid', 'email', 'profile'],
    }
  );
});

test('protected resource metadata rejects unsafe authorization server URLs', () => {
  assert.throws(
    () =>
      buildProtectedResourceMetadata({
        resourceUrl: 'https://api.maxvideoai.com/mcp',
        supabaseUrl: 'http://project-ref.supabase.co',
      }),
    /HTTPS/
  );
});

test('protected resource metadata permits explicit loopback HTTP for local OAuth development', () => {
  assert.deepEqual(
    buildProtectedResourceMetadata({
      resourceUrl: 'http://127.0.0.1:3100/mcp',
      supabaseUrl: 'http://127.0.0.1:54321',
    }),
    {
      resource: 'http://127.0.0.1:3100/mcp',
      resource_name: 'MaxVideoAI MCP',
      authorization_servers: ['http://127.0.0.1:54321/auth/v1'],
      bearer_methods_supported: ['header'],
      scopes_supported: ['openid', 'email', 'profile'],
    }
  );
});

test('authorization-server compatibility metadata sends legacy MCP clients to Supabase OAuth endpoints', () => {
  const buildAuthorizationServerCompatibilityMetadata = (
    oauthMetadataModule as Record<string, unknown>
  ).buildAuthorizationServerCompatibilityMetadata;

  assert.equal(typeof buildAuthorizationServerCompatibilityMetadata, 'function');
  assert.deepEqual(
    (buildAuthorizationServerCompatibilityMetadata as (input: {
      resourceUrl: string;
      supabaseUrl: string;
    }) => unknown)({
      resourceUrl: 'https://api.maxvideoai.com/mcp',
      supabaseUrl: 'https://project-ref.supabase.co',
    }),
    {
      issuer: 'https://api.maxvideoai.com',
      authorization_endpoint: 'https://project-ref.supabase.co/auth/v1/oauth/authorize',
      token_endpoint: 'https://project-ref.supabase.co/auth/v1/oauth/token',
      registration_endpoint: 'https://project-ref.supabase.co/auth/v1/oauth/clients/register',
      scopes_supported: ['openid', 'email', 'profile', 'offline_access'],
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256'],
    }
  );
});

test('authorization-server compatibility route exposes the Supabase endpoints on the MCP API host', async () => {
  const routePath = join(
    process.cwd(),
    'frontend/app/.well-known/oauth-authorization-server/route.ts'
  );
  assert.equal(existsSync(routePath), true);

  const route = await import('../frontend/app/.well-known/oauth-authorization-server/route');
  const mutableEnv = ENV as { NEXT_PUBLIC_SUPABASE_URL?: string };
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    apiHost: process.env.MCP_API_HOST,
    resourceUrl: process.env.MCP_RESOURCE_URL,
    supabaseUrl: mutableEnv.NEXT_PUBLIC_SUPABASE_URL,
  };
  process.env.NODE_ENV = 'production';
  process.env.MCP_API_HOST = 'api.maxvideoai.com';
  process.env.MCP_RESOURCE_URL = 'https://api.maxvideoai.com/mcp';
  mutableEnv.NEXT_PUBLIC_SUPABASE_URL = 'https://project-ref.supabase.co';

  try {
    const response = route.GET(new Request(
      'https://api.maxvideoai.com/.well-known/oauth-authorization-server',
      { headers: { host: 'api.maxvideoai.com' } }
    ));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=300');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.deepEqual(await response.json(), {
      issuer: 'https://api.maxvideoai.com',
      authorization_endpoint: 'https://project-ref.supabase.co/auth/v1/oauth/authorize',
      token_endpoint: 'https://project-ref.supabase.co/auth/v1/oauth/token',
      registration_endpoint: 'https://project-ref.supabase.co/auth/v1/oauth/clients/register',
      scopes_supported: ['openid', 'email', 'profile', 'offline_access'],
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256'],
    });
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.apiHost === undefined) delete process.env.MCP_API_HOST;
    else process.env.MCP_API_HOST = previous.apiHost;
    if (previous.resourceUrl === undefined) delete process.env.MCP_RESOURCE_URL;
    else process.env.MCP_RESOURCE_URL = previous.resourceUrl;
    mutableEnv.NEXT_PUBLIC_SUPABASE_URL = previous.supabaseUrl;
  }
});

test('protected resource route is flag-gated and publicly cacheable only when enabled', () => {
  const routePath = join(
    process.cwd(),
    'frontend/app/.well-known/oauth-protected-resource/mcp/route.ts'
  );
  assert.equal(existsSync(routePath), true);
  const source = readFileSync(routePath, 'utf8');

  assert.match(source, /isMcpFoundationFeatureEnabled\('discovery'/);
  assert.match(source, /export function GET\(request: Request\)/);
  assert.match(source, /getMcpRequestHost\(request\.headers\)/);
  assert.match(source, /isMcpFoundationFeatureEnabled\('discovery', process\.env, requestHost\)/);
  assert.match(source, /public, max-age=300/);
  assert.match(source, /buildProtectedResourceMetadata/);
  assert.doesNotMatch(source, /SERVICE_ROLE|SUPABASE_SECRET|accessToken/);
});

test('disabled protected-resource discovery is noindex and ignores forwarded-host spoofing', () => {
  const mutableMcpFeatures = FEATURES.mcp as { discovery: boolean };
  const previousDiscovery = mutableMcpFeatures.discovery;
  mutableMcpFeatures.discovery = false;

  try {
    const response = getProtectedResourceMetadata(
      new Request('https://maxvideoai.com/.well-known/oauth-protected-resource/mcp', {
        headers: { host: 'maxvideoai.com', 'x-forwarded-host': 'api.maxvideoai.com' },
      }),
    );
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  } finally {
    mutableMcpFeatures.discovery = previousDiscovery;
  }
});
