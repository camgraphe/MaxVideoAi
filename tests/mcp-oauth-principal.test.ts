import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import {
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
  onGrantCheck?: () => void;
}): OAuthAdapterDeps {
  return {
    async createAuthClient() {
      return {
        async getClaims() {
          return {
            data: options?.claims === null ? null : { claims: options?.claims ?? { sub: 'user-1', client_id: 'client-1' } },
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
    async hasActiveGrant() {
      options?.onGrantCheck?.();
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

test('active OAuth grant lookup accepts only the matching client grant', async () => {
  const module = await import('../frontend/src/server/mcp/oauth-adapter');
  const lookup = (module as typeof module & {
    hasActiveOAuthGrant?: (
      accessToken: string,
      clientId: string,
      deps: { supabaseUrl: string; anonKey: string; fetcher: typeof fetch },
    ) => Promise<boolean>;
  }).hasActiveOAuthGrant;
  assert.equal(typeof lookup, 'function');

  const requests: Request[] = [];
  const active = await lookup!('access-token', 'client-1', {
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

  const inactive = await lookup!('access-token', 'client-1', {
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

test('active OAuth grant lookup fails closed on unavailable or malformed Auth responses', async () => {
  const { hasActiveOAuthGrant } = await import('../frontend/src/server/mcp/oauth-adapter');
  const config = {
    supabaseUrl: 'https://project.supabase.co',
    anonKey: 'public-anon-key',
  };

  assert.equal(await hasActiveOAuthGrant('access-token', 'client-1', {
    ...config,
    fetcher: async () => new Response(null, { status: 503 }),
  }), false);
  assert.equal(await hasActiveOAuthGrant('access-token', 'client-1', {
    ...config,
    fetcher: async () => Response.json({ grants: [] }),
  }), false);
  assert.equal(await hasActiveOAuthGrant('access-token', 'client-1', {
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
      claims: { sub: 'user-1', client_id: 'client-1', email_verified: true },
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
