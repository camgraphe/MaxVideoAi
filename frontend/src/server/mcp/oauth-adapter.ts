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
  iat?: unknown;
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
  hasActiveGrant(
    accessToken: string,
    clientId: string,
    tokenIssuedAtSeconds: number,
  ): Promise<boolean>;
};

type ActiveOAuthGrantLookupDeps = {
  supabaseUrl?: string;
  anonKey?: string;
  fetcher?: typeof fetch;
};

const RFC3339_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/;

function parseRfc3339EpochSeconds(value: string): number | null {
  const match = RFC3339_TIMESTAMP.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fractionMilliseconds = Number((match[7] ?? '').slice(0, 3).padEnd(3, '0'));
  const offsetHour = Number(match[10] ?? 0);
  const offsetMinute = Number(match[11] ?? 0);
  if (year < 1970 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59
    || offsetHour > 23 || offsetMinute > 59) {
    return null;
  }

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month - 1]!) return null;

  const wallClockMilliseconds = Date.UTC(year, month - 1, day, hour, minute, second, fractionMilliseconds);
  const offsetDirection = match[9] === '-' ? -1 : 1;
  const offsetMilliseconds = offsetDirection * ((offsetHour * 60) + offsetMinute) * 60_000;
  const epochMilliseconds = wallClockMilliseconds - offsetMilliseconds;
  if (!Number.isFinite(epochMilliseconds) || epochMilliseconds < 0) return null;
  return Math.floor(epochMilliseconds / 1000);
}

export async function hasActiveOAuthGrant(
  accessToken: string,
  clientId: string,
  tokenIssuedAtSeconds: number,
  deps: ActiveOAuthGrantLookupDeps = {},
): Promise<boolean> {
  if (!Number.isSafeInteger(tokenIssuedAtSeconds) || tokenIssuedAtSeconds < 0) return false;
  const supabaseUrl = deps.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = deps.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl?.trim() || !anonKey?.trim()) return false;

  try {
    const grantsUrl = new URL('/auth/v1/user/oauth/grants', supabaseUrl);
    const response = await (deps.fetcher ?? fetch)(grantsUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        apikey: anonKey,
        authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });
    if (!response.ok) return false;

    const grants: unknown = await response.json();
    if (!Array.isArray(grants)) return false;
    const matchingGrantTimes: number[] = [];
    for (const grant of grants) {
      if (!grant || typeof grant !== 'object') continue;
      const client = (grant as { client?: unknown }).client;
      if (!client || typeof client !== 'object' || (client as { id?: unknown }).id !== clientId) {
        continue;
      }
      const grantedAt = (grant as { granted_at?: unknown }).granted_at;
      if (typeof grantedAt !== 'string' || !grantedAt.trim()) return false;
      const grantedAtSeconds = parseRfc3339EpochSeconds(grantedAt);
      if (grantedAtSeconds === null) return false;
      matchingGrantTimes.push(grantedAtSeconds);
    }
    if (matchingGrantTimes.length === 0) return false;

    // JWT iat has whole-second precision while granted_at can include fractions.
    // Comparing both at second precision accepts the token minted for this grant,
    // while a token from an older consent generation fails closed.
    return tokenIssuedAtSeconds >= Math.max(...matchingGrantTimes);
  } catch {
    return false;
  }
}

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
  async hasActiveGrant(accessToken, clientId, tokenIssuedAtSeconds) {
    return hasActiveOAuthGrant(accessToken, clientId, tokenIssuedAtSeconds);
  },
};

function authenticationRequired(): AgentApiError {
  return new AgentApiError('AUTH_REQUIRED', 'Authentication required.');
}

async function resolveOAuthPrincipal(
  request: Request,
  deps: OAuthAdapterDeps,
  requireClientBinding: boolean,
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

  const rawClientId = claimsResult.data?.claims.client_id;
  const clientId = typeof rawClientId === 'string' && rawClientId.trim() ? rawClientId.trim() : null;
  const rawIssuedAt = claimsResult.data?.claims.iat;
  const tokenIssuedAtSeconds = Number.isSafeInteger(rawIssuedAt) && Number(rawIssuedAt) >= 0
    ? Number(rawIssuedAt)
    : null;
  if ((clientId && tokenIssuedAtSeconds === null) || (requireClientBinding && !clientId)) {
    throw authenticationRequired();
  }
  const userPromise = auth.getUser(accessToken);
  const activeGrantPromise = clientId && tokenIssuedAtSeconds !== null
    ? deps.hasActiveGrant(accessToken, clientId, tokenIssuedAtSeconds).catch(() => false)
    : Promise.resolve(true);
  const [userResult, hasActiveGrant] = await Promise.all([
    userPromise,
    activeGrantPromise,
  ]);
  const user = userResult.data.user;
  if (userResult.error || !user || user.id !== subject) {
    throw authenticationRequired();
  }
  if (!hasActiveGrant) {
    throw authenticationRequired();
  }

  return {
    userId: subject,
    clientId,
    emailVerified:
      typeof user.email_confirmed_at === 'string' && user.email_confirmed_at.trim().length > 0,
    authMethod: 'oauth',
  };
}

export function resolveAgentPrincipal(
  request: Request,
  deps: OAuthAdapterDeps = defaultOAuthAdapterDeps,
): Promise<AgentPrincipal> {
  return resolveOAuthPrincipal(request, deps, false);
}

export function resolveMcpAgentPrincipal(
  request: Request,
  deps: OAuthAdapterDeps = defaultOAuthAdapterDeps,
): Promise<AgentPrincipal> {
  return resolveOAuthPrincipal(request, deps, true);
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
