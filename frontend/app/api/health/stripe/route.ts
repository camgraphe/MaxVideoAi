import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { authorizeHealthcheckRequest } from '@/server/ops-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const unauthorized = authorizeHealthcheckRequest(req);
  if (unauthorized) return unauthorized;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return Response.json({ ok: false, error: 'stripe_unavailable' }, { status: 503 });
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
    const prices = await stripe.prices.list({ limit: 1 });
    return Response.json({ ok: true, count: prices.data.length });
  } catch (error) {
    console.error('[health/stripe] probe failed', error);
    return Response.json(
      { ok: false, error: 'stripe_unavailable' },
      { status: 503 }
    );
  }
}
