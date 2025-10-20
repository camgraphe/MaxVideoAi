import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { deletePricingRule, upsertPricingRule } from '@/lib/pricing';

export const runtime = 'nodejs';

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export async function PUT(req: NextRequest, { params }: { params: { ruleId: string } }) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const ruleId = params.ruleId;
  if (!ruleId) {
    return NextResponse.json({ ok: false, error: 'Missing rule id' }, { status: 400 });
  }

  try {
    const rule = await upsertPricingRule({
      id: ruleId,
      engineId: typeof payload.engineId === 'string' ? payload.engineId : undefined,
      resolution: typeof payload.resolution === 'string' ? payload.resolution : undefined,
      marginPercent: toNumber(payload.marginPercent),
      marginFlatCents: Math.round(toNumber(payload.marginFlatCents)),
      surchargeAudioPercent: toNumber(payload.surchargeAudioPercent),
      surchargeUpscalePercent: toNumber(payload.surchargeUpscalePercent),
      currency: typeof payload.currency === 'string' ? payload.currency : undefined,
      vendorAccountId: typeof payload.vendorAccountId === 'string' ? payload.vendorAccountId : undefined,
    });
    return NextResponse.json({ ok: true, rule });
  } catch (error) {
    console.error('[api/admin/pricing/rules/:id] failed to update rule', error);
    const message = error instanceof Error ? error.message : 'Failed to update pricing rule';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { ruleId: string } }) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ruleId = params.ruleId;
  if (!ruleId) {
    return NextResponse.json({ ok: false, error: 'Missing rule id' }, { status: 400 });
  }

  try {
    await deletePricingRule(ruleId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/admin/pricing/rules/:id] failed to delete rule', error);
    const message = error instanceof Error ? error.message : 'Failed to delete pricing rule';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
