import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type SupabaseAuthClient = SupabaseClient<Record<string, never>>;

let client: SupabaseAuthClient | null = null;

function isConfigured(): boolean {
  return Boolean((process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim() && (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim());
}

export function getSupabaseAdmin(): SupabaseAuthClient {
  if (!isConfigured()) {
    throw new Error('Supabase service role not configured');
  }
  if (!client) {
    client = createClient(
      String(process.env.NEXT_PUBLIC_SUPABASE_URL),
      String(process.env.SUPABASE_SERVICE_ROLE_KEY),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }
  return client;
}

export async function getUserIdentity(userId: string): Promise<{ id: string; email: string | null; fullName: string | null } | null> {
  if (!isConfigured()) return null;
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    const user = data.user;
    const email = typeof user.email === 'string' ? user.email : null;
    const fullName =
      typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === 'string'
          ? user.user_metadata.name
          : null;
    return { id: user.id, email, fullName };
  } catch (error) {
    console.warn('[supabase-admin] getUserIdentity failed', error instanceof Error ? error.message : error);
    return null;
  }
}
