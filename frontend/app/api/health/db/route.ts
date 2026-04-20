import type { NextRequest } from 'next/server';
import { authorizeHealthcheckRequest } from '@/server/ops-auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const unauthorized = authorizeHealthcheckRequest(req);
  if (unauthorized) return unauthorized;

  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: false, error: 'database_unavailable' }, { status: 503 });
  }

  try {
    const result = await query<{ ok: number }>('SELECT 1 as ok');
    return Response.json({ ok: result[0]?.ok === 1 });
  } catch (error) {
    console.error('[health/db] probe failed', error);
    return Response.json(
      { ok: false, error: 'database_unavailable' },
      { status: 503 }
    );
  }
}
