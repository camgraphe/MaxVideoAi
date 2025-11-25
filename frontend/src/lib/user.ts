import type { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-ssr';

export async function getUserIdFromRequest(_req?: NextRequest): Promise<string | null> {
  void _req;
  try {
    const supabase = createSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
