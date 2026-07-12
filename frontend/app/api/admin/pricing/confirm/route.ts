import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { PricingAdminError } from '@/server/pricing-admin/errors';
import {
  confirmPricingPolicyChange,
  type PricingPolicyChangeProposal,
} from '@/server/pricing-admin/policy-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pickProposal(payload: Record<string, unknown>): PricingPolicyChangeProposal {
  const raw = payload.proposal;
  const proposal = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    operation: proposal.operation,
    targetId: proposal.targetId,
    eventId: proposal.eventId,
    rule: proposal.rule,
  } as PricingPolicyChangeProposal;
}

export async function POST(req: NextRequest) {
  let adminUserId: string;
  try {
    adminUserId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }
  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }
  const body = payload as Record<string, unknown>;
  try {
    const confirmation = await confirmPricingPolicyChange(
      pickProposal(body),
      typeof body.previewFingerprint === 'string' ? body.previewFingerprint : '',
      adminUserId
    );
    return NextResponse.json({ ok: true, confirmation });
  } catch (error) {
    if (error instanceof PricingAdminError) {
      return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 });
  }
}
