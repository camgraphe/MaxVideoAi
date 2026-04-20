import type { NextRequest } from 'next/server';
import { authorizeHealthcheckRequest } from '@/server/ops-auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

const REQUIRED_KEYS = ['terms', 'privacy', 'cookies'] as const;

type RequiredKey = (typeof REQUIRED_KEYS)[number];

export async function GET(req: NextRequest) {
  const unauthorized = authorizeHealthcheckRequest(req);
  if (unauthorized) return unauthorized;

  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false, error: 'legal_unavailable' }, { status: 503 });
  }

  try {
    const result = await query<{ key: string; version: string }>(
      `select key, version from legal_documents where key = any($1::text[])`,
      [REQUIRED_KEYS]
    );

    const found = new Map<RequiredKey, string>();
    for (const row of result) {
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
  } catch (error) {
    console.error('[health/legal] probe failed', error);
    return Response.json(
      { ok: false, error: 'legal_unavailable' },
      { status: 503 }
    );
  }
}
