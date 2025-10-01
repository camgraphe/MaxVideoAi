import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";

interface SupabaseClientOptions {
  allowCookieWrites: boolean;
}

type CookieSetterInput = Array<{
  name: string;
  value: string;
  options?: Record<string, unknown>;
}>;

function assertSupabaseEnvironment() {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not configured");
  }
}

async function getAllCookies() {
  const store = await cookies();
  return store.getAll();
}

async function setCookies(cookiesToSet: CookieSetterInput, allowCookieWrites: boolean) {
  if (!allowCookieWrites) {
    return;
  }

  const store = await cookies();
  for (const { name, value, options } of cookiesToSet) {
    try {
      store.set(name, value, options);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("Cookies can only be modified")) {
        throw error;
      }
    }
  }
}

async function getHeaderValue(key: string) {
  const headerList = await headers();
  return headerList.get(key) ?? undefined;
}

function createSupabaseClient({ allowCookieWrites }: SupabaseClientOptions) {
  assertSupabaseEnvironment();

  return createServerClient(env.SUPABASE_URL as string, env.SUPABASE_ANON_KEY as string, {
    cookies: {
      getAll: getAllCookies,
      setAll(cookiesToSet) {
        return setCookies(cookiesToSet, allowCookieWrites);
      },
    },
    headers: {
      get: getHeaderValue,
    },
  });
}

export function getSupabaseRouteClient() {
  return createSupabaseClient({ allowCookieWrites: true });
}

export function getSupabaseServerClient() {
  return createSupabaseClient({ allowCookieWrites: false });
}
