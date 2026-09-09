import type { User } from '@supabase/supabase-js';

export type AccountNameClient = {
  auth: {
    getSession(): Promise<{
      data: { session: { access_token: string; user: User } | null };
      error: { message: string } | null;
    }>;
    getUser(accessToken: string): Promise<{
      data: { user: User | null };
      error: { message: string } | null;
    }>;
  };
};

export function getAccountName(user: User | null) {
  const fullName = user?.user_metadata?.full_name;
  if (typeof fullName === 'string') return fullName;
  const name = user?.user_metadata?.name;
  return typeof name === 'string' ? name : '';
}

export function validateAccountName(value: string) {
  const name = value.trim();
  if (!name) return { name, error: 'required' as const };
  if (name.length > 80) return { name, error: 'tooLong' as const };
  return { name, error: null };
}

export async function updateAccountNameWithToken({ accessToken, expectedUserId, name, fetcher = fetch, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }: {
  accessToken: string;
  expectedUserId: string;
  name: string;
  fetcher?: typeof fetch;
  supabaseUrl?: string;
  anonKey?: string;
}) {
  if (!supabaseUrl || !anonKey) throw new Error('Account service is unavailable.');
  const response = await fetcher(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    method: 'PUT',
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { name, full_name: name } }),
  });
  const payload = await response.json().catch(() => null) as (User & { user?: User; message?: string; error_description?: string }) | null;
  if (!response.ok) throw new Error(payload?.message || payload?.error_description || 'Could not save your name.');
  const updatedUser = payload?.user ?? payload;
  if (!updatedUser?.id) throw new Error('Account update did not return a user.');
  if (updatedUser.id !== expectedUserId) throw new Error('Account changed before the update completed.');
  return updatedUser;
}
