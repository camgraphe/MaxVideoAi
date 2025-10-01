import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

interface SupabaseClientOptions {
  allowCookieWrites: boolean;
}

function assertSupabaseEnvironment() {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not configured");
  }
}

function createSupabaseClient({ allowCookieWrites }: SupabaseClientOptions) {
  assertSupabaseEnvironment();

  return createServerClient(env.SUPABASE_URL as string, env.SUPABASE_ANON_KEY as string, {
    cookies: {
      async get(name: string) {
        const store = await cookies();
        return store.get(name)?.value;
      },
      async set(name: string, value: string, options?: Record<string, unknown>) {
        if (!allowCookieWrites) return;
        const store = await cookies();
        try {
          // @ts-expect-error: Next.js cookies typings differ from Supabase SSR signature
          store.set(name, value, options);
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes("Cookies can only be modified")) {
            throw error;
          }
        }
      },
      async remove(name: string, options?: Record<string, unknown>) {
        if (!allowCookieWrites) return;
        const store = await cookies();
        try {
          // @ts-expect-error: Next.js cookies typings differ from Supabase SSR signature
          store.set(name, "", { ...options, maxAge: 0 });
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes("Cookies can only be modified")) {
            throw error;
          }
        }
      },
    },
  });
}

export function getSupabaseRouteClient() {
  return createSupabaseClient({ allowCookieWrites: true });
}

export function getSupabaseServerClient() {
  return createSupabaseClient({ allowCookieWrites: false });
}
