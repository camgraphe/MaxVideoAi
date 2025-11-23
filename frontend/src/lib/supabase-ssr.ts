import { createRouteHandlerClient, createServerComponentClient, createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromSupabase } from '@/lib/supabase';

export function createSupabaseServerClient() {
  return createServerComponentClient({ cookies });
}

export function createSupabaseRouteClient() {
  return createRouteHandlerClient({ cookies });
}

export function createSupabaseMiddlewareClient(req: NextRequest, res: NextResponse) {
  return createMiddlewareClient({ req, res });
}

export async function getRouteAuthContext(req?: NextRequest) {
  const supabase = createSupabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionUserId = session?.user?.id ?? null;
  if (sessionUserId) {
    return { supabase, session, userId: sessionUserId };
  }
  const fallbackUserId = req ? await getUserIdFromSupabase(req) : null;
  return { supabase, session, userId: fallbackUserId };
}
