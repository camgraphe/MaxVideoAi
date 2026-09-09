import type { NextRequest } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export async function getUserIdFromRequest(req?: NextRequest): Promise<string | null> {
  try {
    return (await getRouteAuthContext(req)).userId;
  } catch {
    return null;
  }
}
