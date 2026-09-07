import type { User } from '@supabase/supabase-js';

export type AccountNameClient = {
  auth: {
    updateUser(attributes: { data: Record<string, unknown> }): Promise<{
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

export async function updateAccountName(client: AccountNameClient, user: User, name: string) {
  const metadata = { ...(user.user_metadata ?? {}), name, full_name: name };
  const result = await client.auth.updateUser({ data: metadata });
  if (result.error) throw new Error(result.error.message);
  if (!result.data.user) throw new Error('Account update did not return a user.');
  return result.data.user;
}
