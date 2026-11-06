import { authFetch } from '@/lib/authFetch';
import { loadSupabaseClient } from '@/lib/supabaseClientLoader';

/** Bind an account-scoped operation to its owner, including across session refresh. */
export async function ownedAuthFetch(
  input: RequestInfo | URL,
  expectedUserId: string | null | undefined,
  init?: RequestInit
): Promise<Response> {
  const unauthorized = () => Object.assign(new Error('UNAUTHORIZED'), { code: 'UNAUTHORIZED' });
  init?.signal?.throwIfAborted();
  if (!expectedUserId) throw unauthorized();
  const client = await loadSupabaseClient();
  init?.signal?.throwIfAborted();
  const { data, error } = await client.auth.getSession();
  init?.signal?.throwIfAborted();
  const session = data.session;
  if (error || !session?.access_token || session.user.id !== expectedUserId) throw unauthorized();

  // Keep same-origin deployment protection cookies, but never let application
  // cookies select another account if this explicit bearer expires or is revoked.
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  headers.set('x-maxvideoai-auth-mode', 'bearer');
  return authFetch(input, { ...init, headers, credentials: 'same-origin' });
}
