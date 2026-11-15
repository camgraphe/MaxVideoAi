import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ENV } from '../frontend/src/lib/env';
import * as configModule from '../frontend/src/server/mcp/config';
import { GET as protectedResource } from '../frontend/app/.well-known/oauth-protected-resource/mcp/route';
import { GET as authorizationServer } from '../frontend/app/.well-known/oauth-authorization-server/route';

const directoryHost = 'openai-mcp.maxvideoai.com';
const resource = 'https://openai-mcp.maxvideoai.com/mcp';
const env = { NODE_ENV: 'production', MCP_OPENAI_DIRECTORY_ENABLED: 'true' };

function requestConfig(host: string | null, values: Record<string, string> = env) {
  const resolve = (configModule as Record<string, unknown>).resolveMcpRequestConfig;
  assert.equal(typeof resolve, 'function', 'request configuration must select an allowed resource');
  return (resolve as (host: string | null, env: Record<string, string>) => configModule.McpConfig | null)(host, values);
}

test('the enabled OpenAI resource shares the canonical account origin and leaves the direct resource intact', () => {
  assert.deepEqual(requestConfig(directoryHost), {
    apiHost: directoryHost, resourceUrl: resource,
    protectedResourceMetadataUrl: 'https://openai-mcp.maxvideoai.com/.well-known/oauth-protected-resource/mcp',
    accountUrl: 'https://maxvideoai.com/account/connections',
  });
  assert.deepEqual(requestConfig('api.maxvideoai.com'), {
    apiHost: 'api.maxvideoai.com', resourceUrl: 'https://api.maxvideoai.com/mcp',
    protectedResourceMetadataUrl: 'https://api.maxvideoai.com/.well-known/oauth-protected-resource/mcp',
    accountUrl: 'https://maxvideoai.com/account/connections',
  });
  assert.equal(requestConfig('OPENAI-MCP.MAXVIDEOAI.COM.')?.resourceUrl, resource);
});

test('an absent or invalid OpenAI enablement keeps its reserved host closed while direct remains available', () => {
  for (const value of ['', 'false', 'TRUE', 'invalid']) {
    const values = { ...env, MCP_OPENAI_DIRECTORY_ENABLED: value };
    assert.equal(requestConfig(directoryHost, values), null);
    assert.equal(requestConfig('api.maxvideoai.com', values)?.resourceUrl, 'https://api.maxvideoai.com/mcp');
  }
  for (const host of [null, 'maxvideoai.com', `${directoryHost}.attacker.test`, `${directoryHost}:443`, `${directoryHost}, api.maxvideoai.com`]) {
    assert.equal(requestConfig(host), null);
  }
});

test('OpenAI enablement cannot connect the proposed production domain to staging or development resources', () => {
  assert.throws(() => requestConfig(directoryHost, {
    ...env, MCP_API_HOST: 'maxvideoai-mcp-staging.vercel.app',
    MCP_RESOURCE_URL: 'https://maxvideoai-mcp-staging.vercel.app/mcp',
  }), /canonical production/i);
  assert.throws(() => requestConfig(directoryHost, {
    ...env, NODE_ENV: 'development', MCP_API_HOST: '127.0.0.1:3000',
    MCP_RESOURCE_URL: 'http://127.0.0.1:3000/mcp',
  }), /canonical production/i);
});

test('Vercel preview, development and custom targets cannot open the production-only OpenAI resource', () => {
  for (const values of [
    { VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' },
    { VERCEL_TARGET_ENV: 'preview' }, { VERCEL_TARGET_ENV: 'staging' },
    { VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'production' },
  ]) {
    assert.throws(() => requestConfig(directoryHost, { ...env, ...values }), /canonical production/i);
    assert.equal(requestConfig('api.maxvideoai.com', { ...env, ...values })?.resourceUrl, 'https://api.maxvideoai.com/mcp');
  }
  assert.equal(requestConfig(directoryHost, { ...env, VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production' })?.resourceUrl, resource);
});

const qualificationEnv = {
  ...env, MCP_OPENAI_DIRECTORY_DEPLOYMENT_PROFILE: 'dedicated-qualification',
  MCP_API_HOST: 'openai-review.maxvideoai.com',
  MCP_RESOURCE_URL: 'https://openai-review.maxvideoai.com/mcp',
};

test('the explicit dedicated profile keeps directory account and media origins on the review application', () => {
  assert.deepEqual(requestConfig(directoryHost, qualificationEnv), {
    apiHost: directoryHost, resourceUrl: resource,
    protectedResourceMetadataUrl: 'https://openai-mcp.maxvideoai.com/.well-known/oauth-protected-resource/mcp',
    accountUrl: 'https://openai-review.maxvideoai.com/account/connections',
  });
  assert.equal(requestConfig('openai-review.maxvideoai.com', qualificationEnv)?.accountUrl,
    'https://openai-review.maxvideoai.com/account/connections');
  assert.equal(requestConfig('api.maxvideoai.com', qualificationEnv), null);
});

test('dedicated routing cannot be selected without exact opt-in or from the primary production application', () => {
  for (const profile of ['', 'shared-production', 'DEDICATED-QUALIFICATION', 'typo']) {
    assert.throws(() => requestConfig(directoryHost, {
      ...qualificationEnv, MCP_OPENAI_DIRECTORY_DEPLOYMENT_PROFILE: profile,
    }));
  }
  assert.throws(() => requestConfig(directoryHost, {
    ...env, MCP_OPENAI_DIRECTORY_DEPLOYMENT_PROFILE: 'dedicated-qualification',
  }));
  assert.throws(() => requestConfig(directoryHost, {
    ...env, MCP_OPENAI_DIRECTORY_DEPLOYMENT_PROFILE: 'typo',
  }));
  assert.equal(requestConfig(directoryHost, { ...qualificationEnv, MCP_OPENAI_DIRECTORY_ENABLED: 'false' }), null);
  assert.equal(requestConfig('api.maxvideoai.com', { ...env, MCP_OPENAI_DIRECTORY_DEPLOYMENT_PROFILE: 'typo' })?.resourceUrl,
    'https://api.maxvideoai.com/mcp');
});

test('dedicated routing refuses lookalike origins, ports and an injected primary account destination', () => {
  for (const origin of [
    'https://openai-review.maxvideoai.com.attacker.test',
    'https://arbitrary.example', 'https://openai-review.maxvideoai.com:444',
    'http://openai-review.maxvideoai.com',
  ]) {
    assert.throws(() => requestConfig(directoryHost, {
      ...qualificationEnv, MCP_API_HOST: new URL(origin).host, MCP_RESOURCE_URL: `${origin}/mcp`,
    }));
  }
  const primary = configModule.resolveMcpConfig(qualificationEnv);
  assert.throws(() => configModule.resolveMcpRequestConfig(directoryHost, qualificationEnv, {
    ...primary, accountUrl: 'https://maxvideoai.com/account/connections',
  }));
  for (const host of [`${directoryHost}.attacker.test`, `${directoryHost}:443`, `${directoryHost}, openai-review.maxvideoai.com`]) {
    assert.equal(requestConfig(host, qualificationEnv), null);
  }
});

test('dedicated routing retains the production-runtime restriction rather than accepting ordinary Preview', () => {
  for (const values of [
    { VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' },
    { VERCEL_TARGET_ENV: 'preview' }, { VERCEL_TARGET_ENV: 'staging' },
    { VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'production' },
    { NODE_ENV: 'development' },
  ]) assert.throws(() => requestConfig(directoryHost, { ...qualificationEnv, ...values }));
});

test('the prepared environment keeps the channel closed and resolves dedicated account origins after explicit enablement', () => {
  const template = readFileSync(new URL('../docs/operations/openai-directory/qualification-2026-11-11/environment.template', import.meta.url), 'utf8');
  const values = Object.fromEntries(template.split('\n').filter(line => line && !line.startsWith('#')).map(line => {
    const delimiter = line.indexOf('=');
    assert.ok(delimiter > 0);
    return [line.slice(0, delimiter), line.slice(delimiter + 1)];
  }));
  const runtime = { ...values, NODE_ENV: 'production', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production' };
  assert.equal(requestConfig(directoryHost, runtime), null);
  const enabled = requestConfig(directoryHost, { ...runtime, MCP_OPENAI_DIRECTORY_ENABLED: 'true' });
  assert.equal(enabled?.resourceUrl, 'https://openai-mcp.maxvideoai.com/mcp');
  assert.equal(enabled?.accountUrl, 'https://openai-review.maxvideoai.com/account/connections');
  assert.equal(requestConfig('api.maxvideoai.com', runtime), null);
});

test('dedicated discovery uses its dedicated Auth metadata and ignores a forwarded primary host', async () => {
  const mutableEnv = ENV as { NEXT_PUBLIC_SUPABASE_URL?: string };
  const previousSupabase = mutableEnv.NEXT_PUBLIC_SUPABASE_URL;
  const names = [...Object.keys(qualificationEnv), 'VERCEL_ENV', 'VERCEL_TARGET_ENV'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, qualificationEnv);
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_TARGET_ENV;
  mutableEnv.NEXT_PUBLIC_SUPABASE_URL = 'https://dedicated-review.supabase.co';
  const request = (host: string) => new Request(`https://${host}/.well-known/oauth-protected-resource/mcp`, {
    headers: { host, 'x-forwarded-host': directoryHost },
  });
  try {
    const response = protectedResource(request(directoryHost));
    assert.equal(response.status, 200);
    const metadata = await response.json();
    assert.equal(metadata.resource, resource);
    assert.deepEqual(metadata.authorization_servers, ['https://dedicated-review.supabase.co/auth/v1']);
    const auth = authorizationServer(request(directoryHost));
    assert.equal(auth.status, 200);
    const authMetadata = await auth.json();
    assert.equal(authMetadata.authorization_endpoint, 'https://dedicated-review.supabase.co/auth/v1/oauth/authorize');
    assert.equal(authMetadata.token_endpoint, 'https://dedicated-review.supabase.co/auth/v1/oauth/token');
    assert.equal(authMetadata.issuer, 'https://openai-mcp.maxvideoai.com');
    for (const route of [protectedResource, authorizationServer]) {
      const rejected = route(request('api.maxvideoai.com'));
      assert.equal(rejected.status, 404);
      assert.equal(rejected.headers.get('cache-control'), 'private, no-store');
    }
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    mutableEnv.NEXT_PUBLIC_SUPABASE_URL = previousSupabase;
  }
});

test('both discovery routes announce the requested allowed resource and close unknown or disabled hosts', async () => {
  const mutableEnv = ENV as { NEXT_PUBLIC_SUPABASE_URL?: string };
  const supabaseUrl = mutableEnv.NEXT_PUBLIC_SUPABASE_URL;
  const values = { ...env, MCP_API_HOST: 'api.maxvideoai.com', MCP_RESOURCE_URL: 'https://api.maxvideoai.com/mcp' };
  const previous = Object.fromEntries([...Object.keys(values), 'VERCEL_ENV', 'VERCEL_TARGET_ENV'].map((name) => [name, process.env[name]]));
  Object.assign(process.env, values);
  mutableEnv.NEXT_PUBLIC_SUPABASE_URL = 'https://project-ref.supabase.co';
  const request = (host: string, path: string) => new Request(`https://${host}${path}`, {
    headers: { host, 'x-forwarded-host': directoryHost },
  });
  try {
    for (const host of ['api.maxvideoai.com', directoryHost]) {
      const protectedResponse = protectedResource(request(host, '/.well-known/oauth-protected-resource/mcp'));
      assert.equal(protectedResponse.status, 200);
      assert.equal(protectedResponse.headers.get('cache-control'), 'public, max-age=300');
      assert.equal((await protectedResponse.json()).resource, `https://${host}/mcp`);
      const authorizationResponse = authorizationServer(request(host, '/.well-known/oauth-authorization-server'));
      assert.equal(authorizationResponse.status, 200);
      const metadata = await authorizationResponse.json();
      assert.equal(metadata.issuer, `https://${host}`);
      assert.equal(metadata.authorization_endpoint, 'https://project-ref.supabase.co/auth/v1/oauth/authorize');
    }
    for (const name of ['VERCEL_ENV', 'VERCEL_TARGET_ENV']) {
      process.env[name] = 'preview';
      for (const route of [protectedResource, authorizationServer]) {
        const response = route(request(directoryHost, '/.well-known/oauth-protected-resource/mcp'));
        assert.equal(response.status, 503);
        assert.equal(response.headers.get('cache-control'), 'private, no-store');
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
      }
      delete process.env[name];
    }
    delete process.env.MCP_OPENAI_DIRECTORY_ENABLED;
    for (const host of [directoryHost, 'maxvideoai.com', 'unknown.example']) {
      for (const route of [protectedResource, authorizationServer]) {
        const response = route(request(host, '/.well-known/oauth-protected-resource/mcp'));
        assert.equal(response.status, 404);
        assert.equal(response.headers.get('cache-control'), 'private, no-store');
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
      }
    }
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    mutableEnv.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
  }
});
