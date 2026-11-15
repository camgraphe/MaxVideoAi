import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import { hasActiveOAuthGrant, resolveMcpAgentPrincipal, resolveMcpRequestPrincipal, type OAuthAdapterDeps, type OAuthClaims } from '../frontend/src/server/mcp/oauth-adapter';
import { handleMcpHttpRequest } from '../frontend/src/server/mcp/http-handler';

const policy = { issuer: 'https://identity.example.invalid/auth/v1', resourceUrl: 'https://openai-mcp.maxvideoai.com/mcp', requiredGrantScopes: ['openid'] };
const request = new Request(policy.resourceUrl, { headers: { authorization: 'Bearer signed-fixture-token' } });
const validClaims = () => ({ sub: 'policy-user', client_id: 'policy-client', iss: policy.issuer, aud: policy.resourceUrl, exp: Math.floor(Date.now() / 1000) + 3600 });
function deps(claims: OAuthClaims, scopes: unknown = ['openid', 'email', 'profile']) {
  const calls = { user: 0, grant: 0 };
  const adapter: OAuthAdapterDeps = {
    createAuthClient: async () => ({
      getClaims: async () => ({ data: { claims }, error: null }),
      getUser: async () => { calls.user++; return { data: { user: { id: 'policy-user', email_confirmed_at: '2026-10-02T12:00:00Z' } }, error: null }; },
    }),
    hasActiveGrant: async (token, clientId, requiredScopes) => {
      calls.grant++;
      return hasActiveOAuthGrant(token, clientId, {
        supabaseUrl: 'https://identity.example.invalid', anonKey: 'fixture-public-key',
        fetcher: async () => Response.json([{ client: { id: 'policy-client' }, scopes }]),
      }, requiredScopes);
    },
  };
  return { adapter, calls };
}
const authRequired = (error: unknown) => error instanceof AgentApiError && error.code === 'AUTH_REQUIRED';

test('directory authentication rejects wrong issuer, audience and validity before requesting live identity or consent', async () => {
  const now = Math.floor(Date.now() / 1000);
  for (const mutation of [
    { iss: 'https://other.example.invalid/auth/v1' }, { iss: undefined },
    { aud: 'authenticated' }, { aud: 'https://api.maxvideoai.com/mcp' }, { aud: undefined },
    { aud: [policy.resourceUrl, 1] }, { exp: now }, { exp: undefined }, { exp: '9999999999' },
    { nbf: now + 3600 }, { nbf: '0' },
  ]) {
    const fixture = deps({ ...validClaims(), ...mutation });
    await assert.rejects(() => resolveMcpAgentPrincipal(request, fixture.adapter, policy), authRequired, JSON.stringify(mutation));
    assert.deepEqual(fixture.calls, { user: 0, grant: 0 });
  }
});

test('resource-bound token still needs a fresh matching user and an active grant with the required identity scope', async () => {
  const fixture = deps(validClaims());
  const principal = await resolveMcpAgentPrincipal(request, fixture.adapter, policy);
  assert.deepEqual(principal, { userId: 'policy-user', clientId: 'policy-client', emailVerified: true, authMethod: 'oauth' });
  assert.deepEqual(fixture.calls, { user: 1, grant: 1 });
  for (const scopes of [[], ['email', 'profile'], 'openid', ['openid', 1], undefined]) {
    // Explicit undefined must represent a malformed grant, rather than a default.
    const rejected = deps(validClaims(), scopes === undefined ? null : scopes);
    await assert.rejects(() => resolveMcpAgentPrincipal(request, rejected.adapter, policy), authRequired);
  }
  const wrongUser = deps(validClaims());
  wrongUser.adapter.createAuthClient = async () => ({ getClaims: async () => ({ data: { claims: validClaims() }, error: null }), getUser: async () => ({ data: { user: { id: 'other-user' } }, error: null }) });
  await assert.rejects(() => resolveMcpAgentPrincipal(request, wrongUser.adapter, policy), authRequired);
});

test('directory accepts a valid audience array and direct authentication retains its existing signed-session contract', async () => {
  const directory = deps({ ...validClaims(), aud: ['authenticated', policy.resourceUrl], nbf: Math.floor(Date.now() / 1000) - 1 });
  assert.equal((await resolveMcpAgentPrincipal(request, directory.adapter, policy)).userId, 'policy-user');
  const direct = deps({ sub: 'policy-user', client_id: 'policy-client' }, []);
  assert.equal((await resolveMcpAgentPrincipal(new Request('https://api.maxvideoai.com/mcp', request), direct.adapter)).userId, 'policy-user');
});

test('HTTP authentication receives the server-selected resource and profile, ignoring forwarded host suggestions', async () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, MCP_OPENAI_DIRECTORY_ENABLED: process.env.MCP_OPENAI_DIRECTORY_ENABLED };
  Object.assign(process.env, { NODE_ENV: 'production', MCP_OPENAI_DIRECTORY_ENABLED: 'true' });
  const contexts: unknown[] = [];
  try {
    for (const host of ['api.maxvideoai.com', 'openai-mcp.maxvideoai.com']) {
      const response = await handleMcpHttpRequest(new Request(`https://${host}/mcp`, {
        method: 'POST', headers: { host, 'x-forwarded-host': 'attacker.example.invalid', authorization: 'Bearer fixture', accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'policy-client', version: '1' } } }),
      }), {
        enabled: true,
        config: { apiHost: 'api.maxvideoai.com', resourceUrl: 'https://api.maxvideoai.com/mcp', protectedResourceMetadataUrl: 'https://api.maxvideoai.com/.well-known/oauth-protected-resource/mcp', accountUrl: 'https://maxvideoai.com/account/connections' },
        resolvePrincipal: async (_request, context) => { contexts.push(context); return { userId: 'policy-user', clientId: 'policy-client', emailVerified: true, authMethod: 'oauth' }; },
        recordEvent: async () => true,
        recordConnection: async () => ({ persisted: false, acquisitionId: null, integrationId: null } as never),
      });
      assert.equal(response.status, 200);
      await response.text();
    }
    assert.deepEqual(contexts, [
      { resourceUrl: 'https://api.maxvideoai.com/mcp', distributionProfile: 'direct' },
      { resourceUrl: 'https://openai-mcp.maxvideoai.com/mcp', distributionProfile: 'openai-directory' },
    ]);
  } finally {
    for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});

test('directory request resolver combines real SDK signature verification with audience and live consent checks', async () => {
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const counterfeit = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'fixture-signing-key', alg: 'ES256', use: 'sig' };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const signedToken = (key = keys.privateKey) => {
    const payload = `${encode({ alg: 'ES256', typ: 'JWT', kid: jwk.kid })}.${encode({ ...validClaims(), iat: Math.floor(Date.now() / 1000), role: 'authenticated', aal: 'aal1', session_id: 'fixture-session', email: '', phone: '', is_anonymous: false })}`;
    return `${payload}.${sign('sha256', Buffer.from(payload), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  };
  let userRequests = 0;
  const client = createClient('https://identity.example.invalid', 'fixture-public-key', {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: async (url) => {
      assert.equal(String(url), 'https://identity.example.invalid/auth/v1/user');
      userRequests++;
      return Response.json({ id: 'policy-user', email_confirmed_at: '2026-10-02T12:00:00Z', app_metadata: {}, user_metadata: {}, created_at: '2026-10-02T12:00:00Z' });
    } },
  });
  const adapter = deps(validClaims()).adapter;
  adapter.createAuthClient = async () => ({
    getClaims: token => client.auth.getClaims(token, { jwks: { keys: [jwk] } }),
    getUser: token => client.auth.getUser(token),
  });
  const context = { resourceUrl: policy.resourceUrl, distributionProfile: 'openai-directory' as const };
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://identity.example.invalid' };
  const tokenRequest = (token: string) => new Request(policy.resourceUrl, { headers: { authorization: `Bearer ${token}` } });
  assert.equal((await resolveMcpRequestPrincipal(tokenRequest(signedToken()), context, adapter, env)).userId, 'policy-user');
  assert.equal(userRequests, 1);
  await assert.rejects(() => resolveMcpRequestPrincipal(tokenRequest(signedToken(counterfeit.privateKey)), context, adapter, env), authRequired);
  assert.equal(userRequests, 1, 'invalid signatures must never reach the user endpoint');
});

test('directory policy rejects an ordinary authenticated audience before fresh user or grant lookup', async () => {
  let freshLookups = 0;
  const deps: OAuthAdapterDeps = {
    createAuthClient: async () => ({
      getClaims: async () => ({ data: { claims: { sub: 'owner', client_id: 'client', iss: 'https://auth.example/auth/v1', aud: 'authenticated', exp: Math.floor(Date.now()/1000)+300 } }, error: null }),
      getUser: async () => { freshLookups++; return { data: { user: { id: 'owner', email_confirmed_at: '2026-10-06' } }, error: null }; },
    }),
    hasActiveGrant: async () => { freshLookups++; return true; },
  };
  const policy = { issuer: 'https://auth.example/auth/v1', resourceUrl: 'https://openai-mcp.maxvideoai.com/mcp', requiredGrantScopes: ['openid'] };
  await assert.rejects(resolveMcpAgentPrincipal(new Request('https://openai-mcp.maxvideoai.com/mcp', { headers: { authorization: 'Bearer fixture' } }), deps, policy), { code: 'AUTH_REQUIRED' });
  assert.equal(freshLookups, 0);
});
