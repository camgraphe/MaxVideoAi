import type { NextRequest } from 'next/server';
import { authorizeHealthcheckRequest } from '@/server/ops-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const unauthorized = authorizeHealthcheckRequest(req);
  if (unauthorized) return unauthorized;

  if (!(process.env.FAL_KEY ?? process.env.FAL_API_KEY)?.trim()) {
    return Response.json(
      { ok: false, error: 'fal_credentials_missing' },
      { status: 503 }
    );
  }

  return Response.json({ ok: true });
}
