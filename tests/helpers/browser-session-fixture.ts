/** Mock the external SDK session, keeping the application's owned transport real. */
export async function mockBrowserSession(initialUserId: string | null) {
  const env = new Map(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].map(key => [key, process.env[key]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://auth.example.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon-key';
  const { loadSupabaseClient } = await import('../../frontend/src/lib/supabaseClientLoader');
  const supabase = await loadSupabaseClient();
  const original = supabase.auth.getSession;
  let userId = initialUserId;
  supabase.auth.getSession = async () => ({
    data: { session: userId ? {
      access_token: `synthetic-token-${userId}`,
      refresh_token: 'synthetic-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: userId, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
    } : null },
    error: null,
  });
  return {
    setUserId(next: string | null) { userId = next; },
    async restore() {
      supabase.auth.getSession = original;
      await supabase.auth.stopAutoRefresh();
      (supabase.auth as unknown as { broadcastChannel?: BroadcastChannel }).broadcastChannel?.close();
      for (const [key, value] of env) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    },
  };
}
