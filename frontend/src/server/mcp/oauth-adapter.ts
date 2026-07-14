import { AgentApiError } from '@/server/agent-api/errors';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import { readRequestBearerAccessToken } from '@/lib/request-auth';
import { createSupabaseRouteClient } from '@/lib/supabase-ssr';
import {
  createDirectMcpAcquisition,
  type McpConnectionAcquisition,
} from '@/lib/mcp-acquisition';

export type OAuthClaims = {
  sub?: unknown;
  client_id?: unknown;
  email_verified?: unknown;
};

export type OAuthUser = {
  id: string;
  email_confirmed_at?: string | null;
  identities?: Array<{ provider?: string | null }> | null;
  user_metadata?: Record<string, unknown> | null;
};

type OAuthAuthClient = {
  getClaims(accessToken: string): Promise<{
    data: { claims: OAuthClaims } | null;
    error: unknown;
  }>;
  getUser(accessToken: string): Promise<{
    data: { user: OAuthUser | null };
    error: unknown;
  }>;
};

export type OAuthAdapterDeps = {
  createAuthClient(): Promise<OAuthAuthClient>;
};

const defaultOAuthAdapterDeps: OAuthAdapterDeps = {
  async createAuthClient() {
    const supabase = await createSupabaseRouteClient();
    return {
      async getClaims(accessToken) {
        const result = await supabase.auth.getClaims(accessToken);
        return {
          data: result.data ? { claims: result.data.claims as OAuthClaims } : null,
          error: result.error,
        };
      },
      async getUser(accessToken) {
        const result = await supabase.auth.getUser(accessToken);
        const user = result.data.user;
        return {
          data: {
            user: user
              ? {
                  id: user.id,
                  email_confirmed_at: user.email_confirmed_at,
                  identities: user.identities?.map((identity) => ({ provider: identity.provider })) ?? null,
                }
              : null,
          },
          error: result.error,
        };
      },
    };
  },
};

function authenticationRequired(): AgentApiError {
  return new AgentApiError('AUTH_REQUIRED', 'Authentication required.');
}

export async function resolveAgentPrincipal(
  request: Request,
  deps: OAuthAdapterDeps = defaultOAuthAdapterDeps
): Promise<AgentPrincipal> {
  const accessToken = readRequestBearerAccessToken(request);
  if (!accessToken) {
    throw authenticationRequired();
  }

  const auth = await deps.createAuthClient();
  const claimsResult = await auth.getClaims(accessToken);
  const subject =
    typeof claimsResult.data?.claims.sub === 'string'
      ? claimsResult.data.claims.sub.trim()
      : '';
  if (claimsResult.error || !subject) {
    throw authenticationRequired();
  }

  const userResult = await auth.getUser(accessToken);
  const user = userResult.data.user;
  if (userResult.error || !user || user.id !== subject) {
    throw authenticationRequired();
  }

  const rawClientId = claimsResult.data?.claims.client_id;
  const clientId = typeof rawClientId === 'string' && rawClientId.trim() ? rawClientId.trim() : null;

  return {
    userId: subject,
    clientId,
    emailVerified:
      typeof user.email_confirmed_at === 'string' && user.email_confirmed_at.trim().length > 0,
    authMethod: 'oauth',
  };
}

export type AuthenticatedMcpConnection = {
  principal: AgentPrincipal;
  acquisition: McpConnectionAcquisition;
};

/**
 * Classifies a host connection only after the caller has resolved a normalized OAuth principal.
 * Task 7 will own any durable landing-acquisition binding; this seam never reads browser state.
 */
export function createDirectAuthenticatedMcpConnection(
  principal: AgentPrincipal,
): AuthenticatedMcpConnection {
  return {
    principal,
    acquisition: createDirectMcpAcquisition(),
  };
}
