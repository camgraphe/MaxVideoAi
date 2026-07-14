import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { QueryExecutor } from '../frontend/src/lib/db';
import { recordMcpEvent } from '../frontend/src/server/agent-api/audit-events';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const acquisitionPath = 'frontend/lib/mcp-acquisition.ts';
const routePath = 'frontend/app/api/mcp/acquisition/route.ts';
const actionsPath =
  'frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpConnectActions.client.tsx';
const actionFlagsPath = 'frontend/config/mcp-client-actions.json';
const secret = 'task-5-test-signing-secret-with-32-bytes';
const validInput = {
  action: 'connect',
  source: 'mcp_landing',
  medium: 'owned',
  campaign: 'mcp_connect',
  client: 'claude',
} as const;

function requireFile(path: string): string {
  assert.equal(existsSync(path), true, `${path} should exist`);
  return readFileSync(path, 'utf8');
}

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function signRaw(prefix: string, payload: string): string {
  return createHmac('sha256', secret).update(`${prefix}.${payload}`).digest('base64url');
}

test('Task 5 has focused acquisition, route, and client-action owners', () => {
  for (const path of [acquisitionPath, routePath, actionsPath, actionFlagsPath]) requireFile(path);

  const actions = requireFile(actionsPath);
  assert.match(actions, /^['"]use client['"];?/);
  assert.match(actions, /McpClientActions/);
  assert.match(actions, /\/api\/mcp\/acquisition/);
});

test('landing acquisition accepts only the exact coarse allowlist and rejects extra data', async () => {
  requireFile(acquisitionPath);
  const { parseMcpAcquisitionRequest } = await import(
    '../frontend/lib/mcp-acquisition.ts'
  );

  assert.deepEqual(parseMcpAcquisitionRequest(validInput), validInput);
  assert.deepEqual(
    parseMcpAcquisitionRequest({ ...validInput, action: 'copy_endpoint', client: 'codex' }),
    { ...validInput, action: 'copy_endpoint', client: 'codex' },
  );

  for (const invalid of [
    { ...validInput, source: 'newsletter' },
    { ...validInput, medium: 'cpc' },
    { ...validInput, campaign: 'arbitrary-campaign' },
    { ...validInput, client: 'other' },
    { ...validInput, action: 'connection_completed' },
    { ...validInput, email: 'person@example.com' },
    { ...validInput, authorization_id: 'authz_secret' },
    { ...validInput, prompt: 'private prompt' },
  ]) {
    assert.equal(parseMcpAcquisitionRequest(invalid), null, JSON.stringify(invalid));
  }
});

test('signed acquisition cookies verify exact context and fail closed on tamper, expiry, and version', async () => {
  requireFile(acquisitionPath);
  const {
    createSignedMcpAcquisitionCookie,
    verifySignedMcpAcquisitionCookie,
  } = await import('../frontend/lib/mcp-acquisition.ts');
  const acquisitionId = 'acq_ABCDEFGHIJKLMNOPQRSTUVWX';
  const signed = createSignedMcpAcquisitionCookie(
    {
      source: validInput.source,
      medium: validInput.medium,
      campaign: validInput.campaign,
      client: validInput.client,
    },
    { secret, nowSeconds: 1_000, acquisitionId },
  );

  assert.ok(signed.value.length < 512);
  assert.deepEqual(verifySignedMcpAcquisitionCookie(signed.value, { secret, nowSeconds: 1_599 }), {
    version: 1,
    acquisitionId,
    source: 'mcp_landing',
    medium: 'owned',
    campaign: 'mcp_connect',
    client: 'claude',
    issuedAt: 1_000,
    expiresAt: 1_600,
  });
  assert.equal(verifySignedMcpAcquisitionCookie(signed.value, { secret, nowSeconds: 1_600 }), null);

  const [prefix, payload, signature] = signed.value.split('.');
  assert.ok(prefix && payload && signature);
  const tamperedPayload = `${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}`;
  assert.equal(
    verifySignedMcpAcquisitionCookie(`${prefix}.${tamperedPayload}.${signature}`, {
      secret,
      nowSeconds: 1_001,
    }),
    null,
  );

  const wrongVersionPayload = base64Url(JSON.stringify({
    version: 2,
    acquisitionId,
    source: 'mcp_landing',
    medium: 'owned',
    campaign: 'mcp_connect',
    client: 'claude',
    issuedAt: 1_000,
    expiresAt: 1_600,
  }));
  const wrongVersion = `v2.${wrongVersionPayload}.${signRaw('v2', wrongVersionPayload)}`;
  assert.equal(verifySignedMcpAcquisitionCookie(wrongVersion, { secret, nowSeconds: 1_001 }), null);
});

test('acquisition signing requires a dedicated strong secret and produces an opaque id', async () => {
  requireFile(acquisitionPath);
  const {
    createSignedMcpAcquisitionCookie,
    resolveMcpAcquisitionSigningSecret,
    verifySignedMcpAcquisitionCookie,
  } = await import('../frontend/lib/mcp-acquisition.ts');

  assert.throws(() => resolveMcpAcquisitionSigningSecret({}), /signing secret/i);
  assert.throws(
    () => resolveMcpAcquisitionSigningSecret({ MCP_ACQUISITION_SIGNING_SECRET: 'short' }),
    /signing secret/i,
  );
  assert.equal(
    resolveMcpAcquisitionSigningSecret({ MCP_ACQUISITION_SIGNING_SECRET: secret }),
    secret,
  );

  const signed = createSignedMcpAcquisitionCookie(
    {
      source: 'mcp_landing',
      medium: 'owned',
      campaign: 'mcp_connect',
      client: 'codex',
    },
    { secret, nowSeconds: 2_000 },
  );
  const verified = verifySignedMcpAcquisitionCookie(signed.value, { secret, nowSeconds: 2_001 });
  assert.match(verified?.acquisitionId ?? '', /^acq_[A-Za-z0-9_-]{24}$/);
});

test('acquisition cookie options are short-lived, HttpOnly, scoped, and production-secure', async () => {
  requireFile(acquisitionPath);
  const {
    MCP_ACQUISITION_COOKIE_MAX_AGE_SECONDS,
    MCP_ACQUISITION_COOKIE_NAME,
    mcpAcquisitionCookieOptions,
  } = await import('../frontend/lib/mcp-acquisition.ts');

  assert.equal(MCP_ACQUISITION_COOKIE_NAME, 'mv_mcp_acquisition');
  assert.equal(MCP_ACQUISITION_COOKIE_MAX_AGE_SECONDS, 600);
  assert.deepEqual(mcpAcquisitionCookieOptions({ NODE_ENV: 'production' }), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/oauth/consent',
    maxAge: 600,
  });
  assert.equal(mcpAcquisitionCookieOptions({ NODE_ENV: 'test' }).secure, false);
});

test('the dedicated signing secret is documented as server-only deployment configuration', () => {
  const envExample = requireFile('frontend/.env.local.example');
  const oauthRunbook = requireFile('docs/operations/mcp-oauth-configuration.md');

  assert.match(envExample, /^MCP_ACQUISITION_SIGNING_SECRET=$/m);
  assert.match(oauthRunbook, /MCP_ACQUISITION_SIGNING_SECRET/);
  assert.match(oauthRunbook, /32 (?:random )?bytes/i);
  assert.match(oauthRunbook, /server-only/i);
  assert.doesNotMatch(oauthRunbook, /NEXT_PUBLIC_MCP_ACQUISITION/);
});

test('acquisition endpoint validates origin, content type, body size, and never returns the id', async () => {
  requireFile(routePath);
  const previousSecret = process.env.MCP_ACQUISITION_SIGNING_SECRET;
  process.env.MCP_ACQUISITION_SIGNING_SECRET = secret;
  try {
    const { POST } = await import('../frontend/app/api/mcp/acquisition/route.ts');
    const request = (body: unknown, options: { origin?: string; contentLength?: string; contentType?: string } = {}) =>
      new Request('https://maxvideoai.com/api/mcp/acquisition', {
        method: 'POST',
        headers: {
          origin: options.origin ?? 'https://maxvideoai.com',
          'content-type': options.contentType ?? 'application/json',
          ...(options.contentLength ? { 'content-length': options.contentLength } : {}),
        },
        body: JSON.stringify(body),
      });

    const accepted = await POST(request(validInput) as never);
    assert.equal(accepted.status, 204);
    assert.equal(await accepted.text(), '');
    const setCookie = accepted.headers.get('set-cookie') ?? '';
    assert.match(setCookie, /^mv_mcp_acquisition=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Path=\/oauth\/consent/i);
    assert.match(setCookie, /Max-Age=600/i);
    assert.doesNotMatch(setCookie, /person@example\.com|authorization_id|prompt|access.?token/i);

    assert.equal((await POST(request(validInput, { origin: 'https://evil.example' }) as never)).status, 403);
    assert.equal((await POST(request(validInput, { contentType: 'text/plain' }) as never)).status, 415);
    assert.equal((await POST(request(validInput, { contentLength: '5000' }) as never)).status, 413);
    assert.equal((await POST(request({ ...validInput, client: 'attacker' }) as never)).status, 400);
  } finally {
    if (previousSecret === undefined) delete process.env.MCP_ACQUISITION_SIGNING_SECRET;
    else process.env.MCP_ACQUISITION_SIGNING_SECRET = previousSecret;
  }
});

test('OAuth connection resolution keeps real claims and user checks before direct_mcp classification', async () => {
  const { resolveAuthenticatedMcpConnection } = await import(
    '../frontend/src/server/mcp/oauth-adapter.ts'
  );
  const calls: string[] = [];
  const resolved = await resolveAuthenticatedMcpConnection(
    new Request('https://api.maxvideoai.com/mcp', {
      headers: { authorization: 'Bearer access-token' },
    }),
    {
      async createAuthClient() {
        return {
          async getClaims(accessToken: string) {
            calls.push(`claims:${accessToken}`);
            return {
              data: { claims: { sub: 'user-1', client_id: 'oauth-client-1' } },
              error: null,
            };
          },
          async getUser(accessToken: string) {
            calls.push(`user:${accessToken}`);
            return {
              data: {
                user: {
                  id: 'user-1',
                  email_confirmed_at: '2026-07-14T10:00:00.000Z',
                  user_metadata: {
                    acquisitionId: 'forged',
                    source: 'forged',
                    role: 'admin',
                  },
                },
              },
              error: null,
            };
          },
        };
      },
    },
  );

  assert.deepEqual(calls, ['claims:access-token', 'user:access-token']);
  assert.deepEqual(resolved.principal, {
    userId: 'user-1',
    clientId: 'oauth-client-1',
    emailVerified: true,
    authMethod: 'oauth',
  });
  assert.deepEqual(resolved.acquisition, {
    acquisitionId: null,
    source: 'direct_mcp',
    medium: 'mcp',
    campaign: 'none',
    client: 'other',
  });
});

test('current audit storage fails closed instead of inventing an acquisition binding before Task 7', async () => {
  let queryCount = 0;
  const executor: QueryExecutor = {
    async query<TRecord>() {
      queryCount += 1;
      return [] as TRecord[];
    },
  };
  const recorded = await recordMcpEvent(
    {
      eventType: 'mcp_connection_completed',
      userId: 'user-1',
      oauthClientId: 'client-1',
      tool: null,
      outcome: 'success',
      surface: null,
      engineId: null,
      errorCode: null,
      acquisitionId: 'acq_ABCDEFGHIJKLMNOPQRSTUVWX',
      source: 'mcp_landing',
      client: 'claude',
      prompt: 'must never be stored',
    } as never,
    { executor, ensureSchema: async () => undefined },
  );

  assert.equal(recorded, false);
  assert.equal(queryCount, 0);
});

test('CTA and endpoint-copy analytics are distinct, consent-aware, and never claim success', () => {
  const source = requireFile(actionsPath);
  assert.match(source, /dispatchGaEvent/);
  assert.match(source, /mcp_landing_cta_clicked/);
  assert.match(source, /mcp_endpoint_copy_clicked/);
  assert.match(source, /navigator\.clipboard\.writeText/);
  assert.match(source, /aria-live=["']polite["']/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.equal((source.match(/window\.location\.assign\(/g) ?? []).length, 1);
  assert.doesNotMatch(source, /mcp_connection_completed|connection_success|copy_success/i);
  assert.doesNotMatch(source, /authorization_id|access.?token|email|prompt/i);
});

test('client deep links remain disabled and localized setup plus endpoint copy always render', async () => {
  const flags = JSON.parse(requireFile(actionFlagsPath)) as Record<
    'claude' | 'codex',
    { deepLinkEnabled: boolean; deepLink: string | null }
  >;
  assert.deepEqual(flags, {
    claude: { deepLinkEnabled: false, deepLink: null },
    codex: { deepLinkEnabled: false, deepLink: null },
  });

  requireFile(actionsPath);
  const { McpConnectActions } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpConnectActions.client.tsx'
  );
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  for (const [locale, expectedHrefs] of [
    ['en', ['/integrations/claude', '/integrations/codex']],
    ['fr', ['/fr/integrations/claude', '/fr/integrations/codex']],
    ['es', ['/es/integraciones/claude', '/es/integraciones/codex']],
  ] as const) {
    const copy = getMcpPageCopy(locale);
    const html = renderToStaticMarkup(React.createElement(McpConnectActions, {
      actions: copy.hero.actions,
      copy: copy.hero.connectActions,
      resourceUrl: 'https://api.maxvideoai.com/mcp',
      locale,
    }));
    for (const href of expectedHrefs) assert.match(html, new RegExp(`href="${href}"`));
    assert.match(html, /https:\/\/api\.maxvideoai\.com\/mcp/);
    assert.equal((html.match(/data-copy-endpoint=/g) ?? []).length, 2);
  }

  const en = getMcpPageCopy('en').hero.connectActions;
  assert.notDeepEqual(en, getMcpPageCopy('fr').hero.connectActions);
  assert.notDeepEqual(en, getMcpPageCopy('es').hero.connectActions);
});
