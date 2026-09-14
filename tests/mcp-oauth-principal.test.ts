import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import {
  hasActiveOAuthGrant,
  resolveAgentPrincipal,
  type OAuthAdapterDeps,
  type OAuthClaims,
  type OAuthUser,
} from '../frontend/src/server/mcp/oauth-adapter';

function requestWithToken(token = 'access-token'): Request {
  return new Request('https://api.maxvideoai.com/mcp', {
    headers: { authorization: `Bearer ${token}` },
  });
}

function createDeps(options?: {
  claims?: OAuthClaims | null;
  claimsError?: unknown;
  user?: OAuthUser | null;
  userError?: unknown;
  activeGrant?: boolean;
  onGrantCheck?: (issuedAtSeconds: number) => void;
}): OAuthAdapterDeps {
  return {
    async createAuthClient() {
      return {
        async getClaims() {
          return {
            data: options?.claims === null ? null : {
              claims: options?.claims ?? { sub: 'user-1', client_id: 'client-1', iat: 1_789_372_800 },
            },
            error: options?.claimsError ?? null,
          };
        },
        async getUser() {
          return {
            data: {
              user:
                options?.user === null
                  ? null
                  : options?.user ?? {
                      id: 'user-1',
                      email_confirmed_at: '2026-07-11T12:00:00.000Z',
                      identities: [{ provider: 'email' }],
                    },
            },
            error: options?.userError ?? null,
          };
        },
      };
    },
    async hasActiveGrant(_accessToken, _clientId, issuedAtSeconds) {
      options?.onGrantCheck?.(issuedAtSeconds);
      return options?.activeGrant ?? true;
    },
  };
}

function isAuthRequired(error: unknown): boolean {
  return error instanceof AgentApiError && error.code === 'AUTH_REQUIRED';
}

test('OAuth principal requires a bearer access token', async () => {
  await assert.rejects(
    () => resolveAgentPrincipal(new Request('https://api.maxvideoai.com/mcp'), createDeps()),
    isAuthRequired
  );
});

test('OAuth principal rejects invalid claims and missing subjects', async () => {
  await assert.rejects(
    () => resolveAgentPrincipal(requestWithToken(), createDeps({ claimsError: new Error('invalid') })),
    isAuthRequired
  );
  await assert.rejects(
    () => resolveAgentPrincipal(requestWithToken(), createDeps({ claims: { client_id: 'client-1' } })),
    isAuthRequired
  );
});

test('OAuth principal requires the fresh Auth user to match the token subject', async () => {
  await assert.rejects(
    () =>
      resolveAgentPrincipal(
        requestWithToken(),
        createDeps({
          user: {
            id: 'other-user',
            email_confirmed_at: '2026-07-11T12:00:00.000Z',
            identities: [{ provider: 'email' }],
          },
        })
      ),
    isAuthRequired
  );
});

test('OAuth principal rejects a signed access token after its client grant is revoked', async () => {
  await assert.rejects(
    () => resolveAgentPrincipal(
      requestWithToken('revoked-access-token'),
      createDeps({ activeGrant: false }),
    ),
    isAuthRequired,
  );
});

test('OAuth principal passes the verified JWT issuance time to the active-grant check', async () => {
  let checkedIssuedAt: number | undefined;
  await resolveAgentPrincipal(
    requestWithToken(),
    createDeps({
      claims: { sub: 'user-1', client_id: 'client-1', iat: 1_789_372_800 },
      onGrantCheck: (issuedAtSeconds) => { checkedIssuedAt = issuedAtSeconds; },
    }),
  );

  assert.equal(checkedIssuedAt, 1_789_372_800);
});

test('OAuth principal fails closed when a client-bound token has no valid JWT issuance time', async () => {
  for (const iat of [undefined, '1789372800', Number.NaN, 1_789_372_800.5]) {
    await assert.rejects(
      () => resolveAgentPrincipal(
        requestWithToken(),
        createDeps({ claims: { sub: 'user-1', client_id: 'client-1', iat } }),
      ),
      isAuthRequired,
    );
  }
});

test('active OAuth grant lookup accepts only the matching client grant', async () => {
  const requests: Request[] = [];
  const active = await hasActiveOAuthGrant('access-token', 'client-1', 1_789_372_800, {
    supabaseUrl: 'https://project.supabase.co',
    anonKey: 'public-anon-key',
    fetcher: async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json([
        {
          id: 'grant-1',
          scopes: ['openid', 'email', 'profile'],
          granted_at: '2026-09-14T08:00:00.000Z',
          client: { id: 'client-1', name: 'GitHub Copilot CLI', uri: '' },
        },
      ]);
    },
  });

  assert.equal(active, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, 'https://project.supabase.co/auth/v1/user/oauth/grants');
  assert.equal(requests[0]?.method, 'GET');
  assert.equal(requests[0]?.headers.get('authorization'), 'Bearer access-token');
  assert.equal(requests[0]?.headers.get('apikey'), 'public-anon-key');
  assert.equal(requests[0]?.cache, 'no-store');

  const activeWithOffset = await hasActiveOAuthGrant('access-token', 'client-1', 1_789_372_800, {
    supabaseUrl: 'https://project.supabase.co',
    anonKey: 'public-anon-key',
    fetcher: async () => Response.json([{
      id: 'grant-with-offset',
      granted_at: '2026-09-14T10:00:00+02:00',
      client: { id: 'client-1' },
    }]),
  });
  assert.equal(activeWithOffset, true);

  const inactive = await hasActiveOAuthGrant('access-token', 'client-1', 1_789_372_800, {
    supabaseUrl: 'https://project.supabase.co',
    anonKey: 'public-anon-key',
    fetcher: async () => Response.json([
      {
        id: 'grant-2',
        scopes: ['openid', 'email', 'profile'],
        granted_at: '2026-09-14T08:00:00.000Z',
        client: { id: 'client-2', name: 'Another client', uri: '' },
      },
    ]),
  });
  assert.equal(inactive, false);
});

test('active OAuth grant lookup rejects a token issued before the current consent generation', async () => {
  const { hasActiveOAuthGrant } = await import('../frontend/src/server/mcp/oauth-adapter');
  const config = {
    supabaseUrl: 'https://project.supabase.co',
    anonKey: 'public-anon-key',
    fetcher: async () => Response.json([{
      id: 'replacement-grant',
      scopes: ['openid', 'email', 'profile'],
      granted_at: '2026-09-14T08:00:01.000Z',
      client: { id: 'client-1', name: 'GitHub Copilot CLI', uri: '' },
    }]),
  };

  assert.equal(await hasActiveOAuthGrant('old-token', 'client-1', 1_789_372_800, config), false);
  assert.equal(await hasActiveOAuthGrant('new-token', 'client-1', 1_789_372_801, config), true);
});

test('active OAuth grant lookup fails closed on unavailable or malformed Auth responses', async () => {
  const config = {
    supabaseUrl: 'https://project.supabase.co',
    anonKey: 'public-anon-key',
  };

  assert.equal(await hasActiveOAuthGrant('access-token', 'client-1', 1_789_372_800, {
    ...config,
    fetcher: async () => new Response(null, { status: 503 }),
  }), false);
  for (const grantedAt of [
    '0',
    '2026-09-14T08:00:00',
    '2026-02-30T08:00:00Z',
    '1969-12-31T23:59:59Z',
    '2026-09-14T08:00:00+24:00',
  ]) {
    assert.equal(await hasActiveOAuthGrant('access-token', 'client-1', 1_789_372_800, {
      ...config,
      fetcher: async () => Response.json([{
        id: 'malformed-time-grant',
        granted_at: grantedAt,
        client: { id: 'client-1' },
      }]),
    }), false, `must reject non-canonical grant time: ${grantedAt}`);
  }
  assert.equal(await hasActiveOAuthGrant('access-token', 'client-1', 1_789_372_800, {
    ...config,
    fetcher: async () => Response.json({ grants: [] }),
  }), false);
  assert.equal(await hasActiveOAuthGrant('access-token', 'client-1', 1_789_372_800, {
    ...config,
    fetcher: async () => Response.json([{
      id: 'grant-without-authoritative-time',
      client: { id: 'client-1' },
    }]),
  }), false);
  assert.equal(await hasActiveOAuthGrant('access-token', 'client-1', 1_789_372_800, {
    ...config,
    fetcher: async () => { throw new Error('network unavailable'); },
  }), false);
});

test('OAuth principal accepts a missing client id without weakening user identity', async () => {
  let grantChecks = 0;
  const principal = await resolveAgentPrincipal(
    requestWithToken(),
    createDeps({
      claims: { sub: 'user-1' },
      onGrantCheck: () => { grantChecks += 1; },
    })
  );

  assert.equal(grantChecks, 0);
  assert.deepEqual(principal, {
    userId: 'user-1',
    clientId: null,
    emailVerified: true,
    authMethod: 'oauth',
  });
});

test('OAuth principal treats confirmed Google accounts as verified', async () => {
  const principal = await resolveAgentPrincipal(
    requestWithToken(),
    createDeps({
      user: {
        id: 'user-1',
        email_confirmed_at: '2026-07-11T12:00:00.000Z',
        identities: [{ provider: 'google' }],
      },
    })
  );

  assert.equal(principal.emailVerified, true);
  assert.equal(principal.clientId, 'client-1');
});

test('OAuth principal does not trust claims or user metadata for email verification', async () => {
  const principal = await resolveAgentPrincipal(
    requestWithToken(),
    createDeps({
      claims: { sub: 'user-1', client_id: 'client-1', iat: 1_789_372_800, email_verified: true },
      user: {
        id: 'user-1',
        email_confirmed_at: null,
        identities: [{ provider: 'google' }],
        user_metadata: { email_verified: true },
      },
    })
  );

  assert.equal(principal.emailVerified, false);
});
