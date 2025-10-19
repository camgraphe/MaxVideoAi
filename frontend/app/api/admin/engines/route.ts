import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { getAdminEngineEntries } from '@/server/engine-overrides';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Admin features not configured' }, { status: 501 });
  }

  const entries = await getAdminEngineEntries();
  const payload = entries.map(({ engine, disabled, override }) => ({
    id: engine.id,
    label: engine.label,
    provider: engine.provider,
    status: engine.status,
    availability: engine.availability,
    latencyTier: engine.latencyTier,
    disabled,
    override: override
      ? {
          active: override.active,
          availability: override.availability,
          status: override.status,
          latencyTier: override.latency_tier,
        }
      : null,
  }));

  return NextResponse.json({ ok: true, engines: payload });
}
