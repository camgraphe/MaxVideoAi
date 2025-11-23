import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Session } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-ssr';

type CallbackPayload = {
  event: string;
  session: Session | null;
};

export async function POST(req: NextRequest) {
  let payload: CallbackPayload | null = null;
  try {
    payload = (await req.json()) as CallbackPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = createSupabaseRouteClient();
  const event = payload?.event;
  const session = payload?.session ?? null;

  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    if (session) {
      await supabase.auth.setSession(session);
    }
  } else if (event === 'SIGNED_OUT') {
    await supabase.auth.signOut();
  }

  return NextResponse.json({ ok: true });
}
