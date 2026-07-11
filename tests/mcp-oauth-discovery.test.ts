import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { buildProtectedResourceMetadata } from '../frontend/src/server/mcp/oauth-resource-metadata';

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

test('protected resource route is flag-gated and publicly cacheable only when enabled', () => {
  const routePath = join(
    process.cwd(),
    'frontend/app/.well-known/oauth-protected-resource/mcp/route.ts'
  );
  assert.equal(existsSync(routePath), true);
  const source = readFileSync(routePath, 'utf8');

  assert.match(source, /isMcpFoundationFeatureEnabled\('discovery'\)/);
  assert.match(source, /public, max-age=300/);
  assert.match(source, /buildProtectedResourceMetadata/);
  assert.doesNotMatch(source, /SERVICE_ROLE|SUPABASE_SECRET|accessToken/);
});
