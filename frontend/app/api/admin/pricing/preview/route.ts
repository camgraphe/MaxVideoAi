import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { PricingAdminError } from '@/server/pricing-admin/errors';
import {
  previewPricingPolicyChange,
  type PricingPolicyChangeProposal,
} from '@/server/pricing-admin/policy-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pickProposal(payload: Record<string, unknown>): PricingPolicyChangeProposal {
  return {
    operation: payload.operation,
    targetId: payload.targetId,
    eventId: payload.eventId,
    rule: payload.rule,
  } as PricingPolicyChangeProposal;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }
  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }
  try {
    const preview = await previewPricingPolicyChange(pickProposal(payload as Record<string, unknown>));
    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    if (error instanceof PricingAdminError) {
      return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 });
  }
}
