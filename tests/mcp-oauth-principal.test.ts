import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import {
  resolveAgentPrincipal,
  resolveMcpAgentPrincipal,
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
  onGrantCheck?: (accessToken: string, clientId: string) => void;
}): OAuthAdapterDeps {
  return {
    async createAuthClient() {
      return {
        async getClaims() {
          return {
            data: options?.claims === null ? null : {
              claims: options?.claims ?? { sub: 'user-1', client_id: 'client-1', session_id: 'session-1' },
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
    async hasActiveGrant(accessToken, clientId) {
      options?.onGrantCheck?.(accessToken, clientId);
      return options?.activeGrant ?? true;
    },
  };
}

function isAuthRequired(error: unknown): boolean {
  return error instanceof AgentApiError && error.code === 'AUTH_REQUIRED';
}

test('OAuth-bound principals require a signed session identity before live lookups', async () => {
  await assert.rejects(resolveMcpAgentPrincipal(requestWithToken(), createDeps({
    claims: { sub: 'user-1', client_id: 'client-1' },
  })), isAuthRequired);
});

test('OAuth principals pass the verified session binding and consume fresh OIDC email verification', async () => {
  let boundClient: string | undefined;
  let checkedBinding: unknown;
  const principal = await resolveMcpAgentPrincipal(requestWithToken(), {
    createAuthClient: async () => ({
      getClaims: async () => ({ data: { claims: { sub: 'user-1', client_id: 'client-1', session_id: 'session-1' } }, error: null }),
      getUser: async (_token: string, clientId?: string) => {
        boundClient = clientId;
        return { data: { user: { id: 'user-1', email_verified: true } }, error: null };
      },
    }),
    hasActiveGrant: async (_token, _clientId, _scopes, binding) => { checkedBinding = binding; return true; },
  });
  assert.equal(boundClient, 'client-1');
  assert.deepEqual(checkedBinding, { userId: 'user-1', sessionId: 'session-1' });
  assert.equal(principal.emailVerified, true);
});

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

test('OAuth principal checks the active grant with the verified bearer and client binding', async () => {
  let checkedGrant: { accessToken: string; clientId: string } | undefined;
  await resolveAgentPrincipal(
    requestWithToken('verified-access-token'),
    createDeps({
      claims: { sub: 'user-1', client_id: 'client-1', session_id: 'session-1' },
      onGrantCheck: (accessToken, clientId) => { checkedGrant = { accessToken, clientId }; },
    }),
  );

  assert.deepEqual(checkedGrant, {
    accessToken: 'verified-access-token',
    clientId: 'client-1',
  });
});

test('first-party OAuth principal accepts a signed bearer without an OAuth client binding', async () => {
  const principal = await resolveAgentPrincipal(
    requestWithToken('first-party-access-token'),
    createDeps({ claims: { sub: 'user-1' } }),
  );

  assert.deepEqual(principal, {
    userId: 'user-1',
    clientId: null,
    emailVerified: true,
    authMethod: 'oauth',
  });
});

test('MCP OAuth principal rejects a signed bearer without an OAuth client binding', async () => {
  await assert.rejects(
    () => resolveMcpAgentPrincipal(
      requestWithToken('unbound-access-token'),
      createDeps({ claims: { sub: 'user-1' } }),
    ),
    isAuthRequired,
  );
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
      claims: { sub: 'user-1', client_id: 'client-1', session_id: 'session-1', email_verified: true },
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
