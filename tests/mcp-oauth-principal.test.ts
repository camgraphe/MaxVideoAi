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

test('OAuth principal accepts a missing client id without weakening user identity', async () => {
  const principal = await resolveAgentPrincipal(
    requestWithToken(),
    createDeps({ claims: { sub: 'user-1' } })
  );

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
