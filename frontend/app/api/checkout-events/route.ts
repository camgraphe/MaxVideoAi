import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import {
  normalizeCheckoutInteractionEventPayload,
  recordCheckoutInteractionEvent,
} from '@/server/checkout-events';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const payload = normalizeCheckoutInteractionEventPayload(body);
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Invalid checkout event' }, { status: 400 });
  }

  try {
    await ensureBillingSchema();
    await recordCheckoutInteractionEvent({
      ...payload,
      userId,
    });
  } catch (error) {
    console.warn('[checkout-events] failed to record checkout interaction', error);
    return NextResponse.json({ ok: false, error: 'Unable to record checkout event' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
