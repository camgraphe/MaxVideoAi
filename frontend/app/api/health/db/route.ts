import type { NextRequest } from 'next/server';
import { authorizeHealthcheckRequest } from '@/server/ops-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const unauthorized = authorizeHealthcheckRequest(req);
  if (unauthorized) return unauthorized;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return Response.json({ ok: false, error: 'database_unavailable' }, { status: 503 });
  }

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    try {
      const result = await client.query<{ ok: number }>('SELECT 1 as ok');
      return Response.json({ ok: result.rows?.[0]?.ok === 1 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[health/db] probe failed', error);
    return Response.json(
      { ok: false, error: 'database_unavailable' },
      { status: 503 }
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}
