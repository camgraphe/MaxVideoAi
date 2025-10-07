import type { NextRequest } from 'next/server';
import { getUserIdFromSupabase } from '@/lib/supabase';

// Resolve user from Supabase; fallback to x-user-id only in dev
export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const uid = await getUserIdFromSupabase(req);
  if (uid) return uid;
  const header = req.headers.get('x-user-id');
  if (process.env.NODE_ENV !== 'production' && header && header.trim()) return header.trim();
  return null;
}
