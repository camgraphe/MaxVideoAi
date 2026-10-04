import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-ssr';

export async function POST() {
  try {
    const supabase = await createSupabaseRouteClient();
    // Signing out of the website must preserve independently authorized MCP sessions.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[auth.signout] failed to clear session', error);
    return NextResponse.json({ ok: false, error: 'Unable to sign out' }, { status: 500 });
  }
}
