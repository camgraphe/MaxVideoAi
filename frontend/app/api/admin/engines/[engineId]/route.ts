import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { upsertEngineOverride } from '@/lib/engine-overrides';
import { ensureBillingSchema } from '@/lib/schema';
import { getEngineById } from '@/lib/engines';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { engineId: string } }) {
  let adminId: string;
  try {
    adminId = await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 501 });
  }

  const engineId = params.engineId;
  if (!engineId) {
    return NextResponse.json({ error: 'Missing engineId' }, { status: 400 });
  }

  const engine = await getEngineById(engineId);
  if (!engine) {
    return NextResponse.json({ error: 'Unknown engine' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const active = body.active as boolean | undefined;
  const availability = typeof body.availability === 'string' ? body.availability : undefined;
  const status = typeof body.status === 'string' ? body.status : undefined;
  const latencyTier = typeof body.latencyTier === 'string' ? body.latencyTier : undefined;

  try {
    await ensureBillingSchema().catch(() => undefined);
  } catch {
    // ignore schema errors for admin toggles
  }

  try {
    await upsertEngineOverride(
      engine.id,
      {
        active,
        availability: availability ?? null,
        status: status ?? null,
        latency_tier: latencyTier ?? null,
      },
      adminId
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
