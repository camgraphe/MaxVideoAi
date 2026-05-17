import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';
import { ensureBillingSchema } from '@/lib/schema';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { expireAdminCheckoutSession } from '@/server/admin-checkout-sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_API_VERSION = '2023-10-16';

export async function POST(req: NextRequest) {
  let adminUserId: string;
  try {
    adminUserId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }
  if (!ENV.STRIPE_SECRET_KEY) {
    return NextResponse.json({ ok: false, error: 'Stripe unavailable' }, { status: 503 });
  }

  const payload = await req.json().catch(() => null);
  const attemptIdInput = typeof payload?.attemptId === 'number' ? payload.attemptId : Number(payload?.attemptId);
  const attemptId = Math.round(Number.isFinite(attemptIdInput) ? attemptIdInput : Number.NaN);
  const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : null;

  if (!Number.isFinite(attemptId) || attemptId <= 0) {
    return NextResponse.json({ ok: false, error: 'Invalid checkout attempt' }, { status: 400 });
  }

  const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });

  try {
    await ensureBillingSchema();
    const result = await expireAdminCheckoutSession({
      adminUserId,
      attemptId,
      expectedSessionId: sessionId,
      stripe,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to expire Checkout session';
    const status = /not found|Invalid|mismatch|already|unpaid|complete|receipt|cannot/i.test(message) ? 400 : 500;
    console.error('[admin/checkout-sessions] failed to expire Checkout session', error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
