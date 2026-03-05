import type { NextRequest } from 'next/server';
import { authorizeHealthcheckRequest } from '@/server/ops-auth';

export const runtime = 'nodejs';

const REQUIRED_KEYS = ['terms', 'privacy', 'cookies'] as const;

type RequiredKey = (typeof REQUIRED_KEYS)[number];

export async function GET(req: NextRequest) {
  const unauthorized = authorizeHealthcheckRequest(req);
  if (unauthorized) return unauthorized;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return Response.json({ ok: false, error: 'legal_unavailable' }, { status: 503 });
  }

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    try {
      const result = await client.query<{ key: string; version: string }>(
        `select key, version from legal_documents where key = any($1::text[])`,
        [REQUIRED_KEYS]
      );

      const found = new Map<RequiredKey, string>();
      for (const row of result.rows) {
        if (REQUIRED_KEYS.includes(row.key as RequiredKey)) {
          found.set(row.key as RequiredKey, row.version);
        }
      }

      const missing = REQUIRED_KEYS.filter((key) => !found.has(key));
      const payload = {
        ok: missing.length === 0,
        documents: REQUIRED_KEYS.map((key) => ({
          key,
          version: found.get(key) ?? null,
        })),
      };
      const status = missing.length === 0 ? 200 : 500;
      return Response.json({ ...payload, missing }, { status });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[health/legal] probe failed', error);
    return Response.json(
      { ok: false, error: 'legal_unavailable' },
      { status: 503 }
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}
