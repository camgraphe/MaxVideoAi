import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { getMembershipTiers, upsertMembershipTiers } from '@/lib/membership';

export const runtime = 'nodejs';

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const tiers = await getMembershipTiers();
    return NextResponse.json({ ok: true, tiers });
  } catch (error) {
    console.error('[api/admin/membership-tiers] failed to load tiers', error);
    return NextResponse.json({ ok: false, error: 'Failed to load membership tiers' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let adminId: string;
  try {
    adminId = await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { tiers?: unknown }).tiers)) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const tiersInput = (payload as { tiers: unknown[] }).tiers;
  const updates = tiersInput
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const tier = (entry as { tier?: unknown }).tier;
      if (typeof tier !== 'string' || !tier.trim()) return null;
      return {
        tier: tier.trim().toLowerCase(),
        spendThresholdCents: Math.max(0, Math.round(toNumber((entry as { spendThresholdCents?: unknown }).spendThresholdCents))),
        discountPercent: Math.max(0, toNumber((entry as { discountPercent?: unknown }).discountPercent)),
        updatedBy: adminId,
      };
    })
    .filter((entry): entry is { tier: string; spendThresholdCents: number; discountPercent: number; updatedBy: string } => entry !== null);

  if (!updates.length) {
    return NextResponse.json({ ok: false, error: 'No valid tiers provided' }, { status: 400 });
  }

  try {
    const tiers = await upsertMembershipTiers(updates);
    return NextResponse.json({ ok: true, tiers });
  } catch (error) {
    console.error('[api/admin/membership-tiers] failed to save tiers', error);
    const message = error instanceof Error ? error.message : 'Failed to save membership tiers';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
