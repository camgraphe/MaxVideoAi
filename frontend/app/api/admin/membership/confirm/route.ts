import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { PricingAdminError } from '@/server/pricing-admin/errors';
import {
  confirmMembershipChange,
  type MembershipChangeProposal,
} from '@/server/pricing-admin/membership-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pickProposal(value: unknown): MembershipChangeProposal {
  const proposal = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    operation: proposal.operation,
    targetId: proposal.targetId,
    tiers: proposal.tiers,
    eventId: proposal.eventId,
  } as MembershipChangeProposal;
}

export async function POST(req: NextRequest) {
  let actorId: string;
  try {
    actorId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }
  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }
  const body = payload as Record<string, unknown>;
  try {
    return NextResponse.json({
      ok: true,
      confirmation: await confirmMembershipChange(
        pickProposal(body.proposal),
        typeof body.previewFingerprint === 'string' ? body.previewFingerprint : '',
        actorId
      ),
    });
  } catch (error) {
    if (error instanceof PricingAdminError) {
      return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 });
  }
}
