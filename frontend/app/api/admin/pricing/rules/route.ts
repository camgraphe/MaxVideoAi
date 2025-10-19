import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { upsertPricingRule } from '@/lib/pricing';

export const runtime = 'nodejs';

type IncomingRulePayload = {
  id?: unknown;
  engineId?: unknown;
  resolution?: unknown;
  marginPercent?: unknown;
  marginFlatCents?: unknown;
  surchargeAudioPercent?: unknown;
  surchargeUpscalePercent?: unknown;
  currency?: unknown;
  vendorAccountId?: unknown;
};

function toOptionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function toOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

export async function PUT(req: NextRequest) {
  let adminId: string;
  try {
    adminId = await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  void adminId;

  const payload = (await req.json().catch(() => null)) as IncomingRulePayload | null;
  if (!payload) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const rule = await upsertPricingRule({
      id: toOptionalString(payload.id),
      engineId: toOptionalString(payload.engineId),
      resolution: toOptionalString(payload.resolution),
      marginPercent: toOptionalNumber(payload.marginPercent) ?? null,
      marginFlatCents: toOptionalNumber(payload.marginFlatCents) ?? null,
      surchargeAudioPercent: toOptionalNumber(payload.surchargeAudioPercent) ?? null,
      surchargeUpscalePercent: toOptionalNumber(payload.surchargeUpscalePercent) ?? null,
      currency: toOptionalString(payload.currency),
      vendorAccountId: toOptionalString(payload.vendorAccountId),
    });
    return NextResponse.json({ ok: true, rule });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('database not configured')) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 501 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
