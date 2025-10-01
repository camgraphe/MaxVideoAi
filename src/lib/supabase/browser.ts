"use client";

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.");
    }
    client = createBrowserClient(url, anonKey);
  }
  return client;
}

