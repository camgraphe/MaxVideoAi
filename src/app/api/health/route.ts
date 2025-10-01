import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, unknown> = {};
  const errors: string[] = [];

  try {
    checks.APP_URL = env.APP_URL ?? null;
    checks.DATABASE_URL = Boolean(process.env.DATABASE_URL);
    checks.SUPABASE_URL = env.SUPABASE_URL ?? null;
    checks.SUPABASE_ANON_KEY = Boolean(env.SUPABASE_ANON_KEY);
    checks.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? null;
    checks.NEXT_PUBLIC_SUPABASE_ANON_KEY = Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    checks.STRIPE_SECRET_KEY = Boolean(env.STRIPE_SECRET_KEY);
  } catch (e) {
    errors.push(`env-parse: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const db = getDb();
    await db.execute("select 1");
    checks.database = "ok";
  } catch (e) {
    errors.push(`db: ${e instanceof Error ? e.message : String(e)}`);
  }

  const ok = errors.length === 0;
  return NextResponse.json({ ok, checks, errors }, { status: ok ? 200 : 500 });
}

