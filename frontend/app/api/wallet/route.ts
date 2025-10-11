import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';
import { getEngineById } from '@/lib/engines';
import { computePricingSnapshot, getPlatformFeeCents, getVendorShareCents } from '@/lib/pricing';
import { randomUUID } from 'crypto';
import { ensureBillingSchema } from '@/lib/schema';

export async function GET(req: NextRequest) {
  await ensureBillingSchema();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await query<{ type: string; amount_cents: number }>(
    `SELECT type, amount_cents FROM app_receipts WHERE user_id = $1`,
    [userId]
  );

  let topups = 0;
  let charges = 0;
  let refunds = 0;
  for (const r of rows) {
    if (r.type === 'topup') topups += r.amount_cents;
    if (r.type === 'charge') charges += r.amount_cents;
    if (r.type === 'refund') refunds += r.amount_cents;
  }

  const balanceCents = Math.max(0, topups + refunds - charges);
  return NextResponse.json({ balance: balanceCents / 100, currency: 'USD' });
}

export async function POST(req: NextRequest) {
  await ensureBillingSchema();

  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!ENV.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 501 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const stripe = new Stripe(ENV.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

  if (body.mode === 'direct') {
    const engineId = String(body.engineId || '');
    const engine = await getEngineById(engineId);
    if (!engine) {
      return NextResponse.json({ error: 'Unknown engine' }, { status: 400 });
    }

    const durationSec = Number(body.durationSec ?? engine.maxDurationSec ?? 4);
    const resolution = String(body.resolution || engine.resolutions?.[0] || '1080p');
    const pricing = await computePricingSnapshot({
      engine,
      durationSec,
      resolution,
      addons: body.addons,
      membershipTier: body.membershipTier,
    });

    if (!pricing.vendorAccountId) {
      return NextResponse.json({ error: 'Engine not configured for direct payments' }, { status: 409 });
    }

    const applicationFeeCents = getPlatformFeeCents(pricing);
    const vendorShareCents = getVendorShareCents(pricing);
    const jobId = typeof body.jobId === 'string' && body.jobId.trim() ? String(body.jobId).trim() : `job_${randomUUID()}`;
    const addons = typeof body.addons === 'object' && body.addons
      ? { audio: body.addons.audio, upscale4k: body.addons.upscale4k }
      : { audio: false, upscale4k: false };

    const metadata: Record<string, string> = {
      kind: 'run',
      user_id: userId,
      engine_id: engine.id,
      job_id: jobId,
      engine_label: engine.label,
      duration_sec: String(durationSec),
      resolution,
      addons_audio: addons.audio ? '1' : '0',
      addons_upscale: addons.upscale4k ? '1' : '0',
      pricing_total_cents: String(pricing.totalCents),
      pricing_platform_fee_cents: String(applicationFeeCents),
      pricing_vendor_share_cents: String(vendorShareCents),
      pricing_currency: pricing.currency,
    };

    if (pricing.meta?.ruleId) {
      metadata.rule_id = String(pricing.meta.ruleId);
    }
    const pricingSnapshotJson = JSON.stringify(pricing);
    if (pricingSnapshotJson.length <= 450) {
      metadata.pricing_snapshot = pricingSnapshotJson;
    }
    if (pricing.vendorAccountId) {
      metadata.vendor_account_id = pricing.vendorAccountId;
    }

    try {
      const intent = await stripe.paymentIntents.create({
        amount: pricing.totalCents,
        currency: pricing.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        transfer_data: {
          destination: pricing.vendorAccountId,
          amount: vendorShareCents,
        },
        application_fee_amount: applicationFeeCents,
        metadata,
      });

      return NextResponse.json({
        ok: true,
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret,
        amountCents: pricing.totalCents,
        currency: pricing.currency,
        applicationFeeCents,
        vendorShareCents,
        vendorAccountId: pricing.vendorAccountId,
        jobId,
        pricing,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stripe error creating PaymentIntent';
      console.error('POST /api/wallet direct error:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const amountCents = Math.max(100, Number(body.amountCents ?? 0));

  try {
    // Create a one-off Checkout Session for top-up
    const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: `${origin}/billing?status=success`,
      cancel_url: `${origin}/billing?status=cancelled`,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Wallet top-up' },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: 'topup',
        user_id: userId,
      },
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stripe error creating checkout session';
    console.error('POST /api/wallet error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
