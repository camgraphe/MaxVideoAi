import { createRouteHandlerClient, createServerComponentClient, createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

export function createSupabaseServerClient() {
  return createServerComponentClient({ cookies });
}

export function createSupabaseRouteClient() {
  return createRouteHandlerClient({ cookies });
}

export function createSupabaseMiddlewareClient(req: NextRequest, res: NextResponse) {
  return createMiddlewareClient({ req, res });
}

export async function getRouteAuthContext(_req?: NextRequest) {
  void _req;
  const supabase = createSupabaseRouteClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionUserId = session?.user?.id ?? null;
  return { supabase, session, userId: sessionUserId };
}
