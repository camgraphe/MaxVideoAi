export type VerifiedOAuthSession = { userId: string; sessionId: string };

type OAuthLookupDeps = {
  supabaseUrl?: string;
  anonKey?: string;
  serviceRoleKey?: string;
  fetcher?: typeof fetch;
};

export async function readOAuthUserInfo(
  accessToken: string,
  deps: OAuthLookupDeps = {},
): Promise<{ id: string; email_verified: boolean } | null> {
  const supabaseUrl = deps.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = deps.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl?.trim() || !anonKey?.trim()) return null;
  try {
    const response = await (deps.fetcher ?? fetch)(new URL('/auth/v1/oauth/userinfo', supabaseUrl), {
      headers: { accept: 'application/json', apikey: anonKey, authorization: `Bearer ${accessToken}` },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const info: unknown = await response.json();
    if (!info || typeof info !== 'object' || Array.isArray(info)) return null;
    const { sub, email_verified } = info as { sub?: unknown; email_verified?: unknown };
    if (typeof sub !== 'string' || !sub.trim()) return null;
    // UserInfo omits this claim without the email scope (and for unconfirmed
    // email). The resource server still owns verification gates for its users.
    if (email_verified === undefined) {
      const serviceRoleKey = deps.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey?.trim()) return null;
      const userResponse = await (deps.fetcher ?? fetch)(new URL(`/auth/v1/admin/users/${encodeURIComponent(sub)}`, supabaseUrl), {
        headers: { accept: 'application/json', apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
      });
      if (!userResponse.ok) return null;
      const user: unknown = await userResponse.json();
      if (!user || typeof user !== 'object' || Array.isArray(user)) return null;
      const { id, email_confirmed_at } = user as { id?: unknown; email_confirmed_at?: unknown };
      if (id !== sub) return null;
      return { id: sub, email_verified: typeof email_confirmed_at === 'string' && email_confirmed_at.trim().length > 0 };
    }
    return { id: sub, email_verified: email_verified === true };
  } catch {
    return null;
  }
}

/** Called only after signature verification; never forwards the delegated token to an account endpoint. */
export async function hasActiveOAuthGrant(
  binding: VerifiedOAuthSession,
  clientId: string,
  deps: OAuthLookupDeps = {},
  requiredScopes: readonly string[] = [],
): Promise<boolean> {
  const supabaseUrl = deps.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = deps.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl?.trim() || !serviceRoleKey?.trim()
    || !binding.userId?.trim() || !binding.sessionId?.trim() || !clientId.trim()) return false;
  try {
    const response = await (deps.fetcher ?? fetch)(new URL('/rest/v1/rpc/mcp_oauth_grant_is_active', supabaseUrl), {
      method: 'POST',
      headers: {
        accept: 'application/json', 'content-type': 'application/json',
        apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        p_user_id: binding.userId, p_client_id: clientId, p_session_id: binding.sessionId,
        p_required_scopes: requiredScopes,
      }),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    return response.ok && await response.json() === true;
  } catch {
    return false;
  }
}
