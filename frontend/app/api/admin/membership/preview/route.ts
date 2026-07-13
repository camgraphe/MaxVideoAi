import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { PricingAdminError } from '@/server/pricing-admin/errors';
import {
  previewMembershipChange,
  type MembershipChangeProposal,
} from '@/server/pricing-admin/membership-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pickProposal(payload: Record<string, unknown>): MembershipChangeProposal {
  return {
    operation: payload.operation,
    tiers: payload.tiers,
    eventId: payload.eventId,
  } as MembershipChangeProposal;
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
    return NextResponse.json({
      ok: true,
      preview: await previewMembershipChange(pickProposal(payload as Record<string, unknown>)),
    });
  } catch (error) {
    if (error instanceof PricingAdminError) {
      return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 });
  }
}
