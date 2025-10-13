import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function GET() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return Response.json({ ok: false, error: 'STRIPE_SECRET_KEY missing' }, { status: 500 });
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
    const prices = await stripe.prices.list({ limit: 1 });
    return Response.json({ ok: true, count: prices.data.length });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
