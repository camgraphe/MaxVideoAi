import process from 'node:process';
import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import 'tsconfig-paths/register.js';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: false });

type TotalRow = {
  total: number | string | null;
};

type SupabaseUser = {
  id: string;
  created_at: string | null;
  updated_at: string | null;
};

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toIso(value: string | Date | null | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

async function fetchSupabaseUsers(): Promise<SupabaseUser[]> {
  const siteUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim();
  const apiKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!siteUrl || !apiKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  const baseUrl = siteUrl.replace(/\/+$/, '');
  const users: SupabaseUser[] = [];
  const perPage = 500;
  for (let page = 1; page <= 2000; page += 1) {
    const url = `${baseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`;
    const response = await fetch(url, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Failed to fetch Supabase users (status ${response.status}): ${body}`);
    }
    const payload = (await response.json()) as { users?: SupabaseUser[] };
    const batch = payload.users ?? [];
    users.push(
      ...batch.map((user) => ({
        id: user.id,
        created_at: user.created_at,
        updated_at: user.updated_at,
      }))
    );
    if (batch.length < perPage) {
      break;
    }
  }
  return users;
}

async function main(): Promise<void> {
  const { query } = await import('../src/lib/db');

  await query(`
    ALTER TABLE IF EXISTS profiles
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS synced_from_supabase BOOLEAN NOT NULL DEFAULT FALSE
  `);

  const supabaseUsers = await fetchSupabaseUsers();
  if (!supabaseUsers.length) {
    console.warn('[profiles-backfill] No Supabase users returned, nothing to sync.');
    return;
  }

  const chunkSize = 500;
  for (let index = 0; index < supabaseUsers.length; index += chunkSize) {
    const chunk = supabaseUsers.slice(index, index + chunkSize);
    const ids = chunk.map((user) => user.id);
    const created = chunk.map((user) => toIso(user.created_at));
    const updated = chunk.map((user) => toIso(user.updated_at ?? user.created_at));
    await query(
      `
        INSERT INTO profiles (id, created_at, updated_at, synced_from_supabase)
        SELECT payload.id, payload.created_at, payload.updated_at, TRUE
        FROM UNNEST ($1::uuid[], $2::timestamptz[], $3::timestamptz[]) AS payload(id, created_at, updated_at)
        ON CONFLICT (id) DO UPDATE
        SET
          created_at = LEAST(profiles.created_at, EXCLUDED.created_at),
          updated_at = GREATEST(COALESCE(profiles.updated_at, EXCLUDED.updated_at), EXCLUDED.updated_at),
          synced_from_supabase = TRUE
      `,
      [ids, created, updated]
    );
    console.log(`[profiles-backfill] synced ${index + chunk.length}/${supabaseUsers.length} users`);
  }

  const profileCount = await query<TotalRow>(`SELECT COUNT(*)::bigint AS total FROM profiles WHERE synced_from_supabase`);
  const totalsMessage = `[profiles-backfill] totals → profiles: ${toNumber(profileCount[0]?.total)}, supabase: ${supabaseUsers.length}.`;
  if (toNumber(profileCount[0]?.total) !== supabaseUsers.length) {
    console.warn(`${totalsMessage} counts diverge, investigate remaining gaps.`);
    process.exitCode = 1;
  } else {
    console.log(totalsMessage);
  }
}

void main().catch((error) => {
  console.error('[profiles-backfill] fatal error', error);
  process.exit(1);
});
