'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

let browserClientPromise: Promise<SupabaseClient> | null = null;

export function loadSupabaseClient(): Promise<SupabaseClient> {
  browserClientPromise ??= import('@/lib/supabaseClient').then(({ supabase }) => supabase);
  return browserClientPromise;
}
