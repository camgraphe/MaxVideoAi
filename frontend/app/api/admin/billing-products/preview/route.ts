import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import {
  previewBillingProductChange,
  type BillingProductChangeProposal,
} from '@/server/pricing-admin/billing-product-service';
import { PricingAdminError } from '@/server/pricing-admin/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pickProposal(value: Record<string, unknown>): BillingProductChangeProposal {
  return {
    operation: value.operation,
    productKey: value.productKey,
    label: value.label,
    currency: value.currency,
    unitPriceCents: value.unitPriceCents,
    active: value.active,
    eventId: value.eventId,
  } as BillingProductChangeProposal;
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
      preview: await previewBillingProductChange(pickProposal(payload as Record<string, unknown>)),
    });
  } catch (error) {
    if (error instanceof PricingAdminError) {
      return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 });
  }
}
