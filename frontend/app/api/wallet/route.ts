import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';
import { computePricingSnapshot, getPlatformFeeCents, getVendorShareCents } from '@/lib/pricing';
import { randomUUID } from 'crypto';
import { ensureBillingSchema } from '@/lib/schema';
import { applyMockWalletTopUp, getMockWalletBalance } from '@/lib/wallet';
import { getConfiguredEngine } from '@/server/engines';
import { getSoraVariantForEngine, isSoraEngineId, parseSoraRequest, type SoraRequest } from '@/lib/sora';

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let useMock = false;
  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[wallet] falling back to mock ledger (schema init failed)', error);
    useMock = true;
  }

  if (useMock || !process.env.DATABASE_URL) {
    const balanceCents = getMockWalletBalance(userId);
    return NextResponse.json({ balance: balanceCents / 100, currency: 'USD', mock: true });
  }

  try {
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
  } catch (error) {
    console.warn('[wallet] query failed, using mock ledger', error);
    const balanceCents = getMockWalletBalance(userId);
    return NextResponse.json({ balance: balanceCents / 100, currency: 'USD', mock: true });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let useMock = false;
  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[wallet] using mock ledger for top-up (schema init failed)', error);
    useMock = true;
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const amountCents = Math.max(1000, Number(body.amountCents ?? 0));

  if (useMock || !ENV.STRIPE_SECRET_KEY || !process.env.DATABASE_URL) {
    const balanceCents = applyMockWalletTopUp(userId, amountCents);
    return NextResponse.json({ ok: true, balanceCents, currency: 'USD', mock: true });
  }

  const stripe = new Stripe(ENV.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

  if (body.mode === 'direct') {
    const engineId = String(body.engineId || '');
    const engine = await getConfiguredEngine(engineId);
    if (!engine) {
      return NextResponse.json({ error: 'Unknown engine' }, { status: 400 });
    }

    let durationSec = Number(body.durationSec ?? engine.maxDurationSec ?? 4);
    let resolution = String(body.resolution || engine.resolutions?.[0] || '1080p');
    const rawMode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : 't2v';
    const mode: 't2v' | 'i2v' = rawMode === 'i2v' ? 'i2v' : 't2v';
    let soraRequest: SoraRequest | null = null;

    if (isSoraEngineId(engine.id)) {
      const variant = getSoraVariantForEngine();
      const candidate: Record<string, unknown> = {
        variant,
        mode,
        prompt: typeof body.prompt === 'string' && body.prompt.trim().length ? body.prompt : '',
        resolution,
        aspect_ratio: typeof body.aspectRatio === 'string' && body.aspectRatio.trim().length ? body.aspectRatio.trim() : 'auto',
        duration: durationSec,
        api_key: typeof body.apiKey === 'string' && body.apiKey.trim().length ? body.apiKey.trim() : undefined,
      };
      if (mode === 'i2v') {
        const imageUrl =
          typeof body.imageUrl === 'string' && body.imageUrl.trim().length
            ? body.imageUrl.trim()
            : typeof body.image_url === 'string' && body.image_url.trim().length
              ? body.image_url.trim()
              : undefined;
        if (!imageUrl) {
          return NextResponse.json({ error: 'Image URL is required for Sora image-to-video' }, { status: 400 });
        }
        candidate.image_url = imageUrl;
      }

      try {
        soraRequest = parseSoraRequest(candidate);
      } catch (error) {
        return NextResponse.json(
          {
            error: 'Invalid Sora payload',
            details: error instanceof Error ? error.message : undefined,
          },
          { status: 400 }
        );
      }

      durationSec = soraRequest.duration;
      const fallbackResolution = engine.resolutions.find((value) => value !== 'auto') ?? engine.resolutions[0] ?? '720p';
      resolution = soraRequest.resolution === 'auto' ? fallbackResolution : soraRequest.resolution;
    }

    const pricing = await computePricingSnapshot({
      engine,
      durationSec,
      resolution,
      membershipTier: body.membershipTier,
    });

    const destinationAccountId =
      pricing.vendorAccountId ??
      ENV.COGS_VAULT_ACCOUNT_ID ??
      process.env.COGS_VAULT_ACCOUNT_ID;

    if (!destinationAccountId) {
      return NextResponse.json({ error: 'No destination account configured' }, { status: 503 });
    }

    const applicationFeeCents = getPlatformFeeCents(pricing);
    const vendorShareCents = getVendorShareCents(pricing);
    const jobId = typeof body.jobId === 'string' && body.jobId.trim() ? String(body.jobId).trim() : `job_${randomUUID()}`;
    const metadata: Record<string, string> = {
      kind: 'run',
      user_id: userId,
      engine_id: engine.id,
      job_id: jobId,
      engine_label: engine.label,
      duration_sec: String(durationSec),
      resolution,
      pricing_total_cents: String(pricing.totalCents),
      pricing_platform_fee_cents: String(applicationFeeCents),
      pricing_vendor_share_cents: String(vendorShareCents),
      pricing_currency: pricing.currency,
    };

    if (soraRequest) {
      metadata.variant = soraRequest.variant;
      metadata.mode = soraRequest.mode;
    }

    if (pricing.meta?.ruleId) {
      metadata.rule_id = String(pricing.meta.ruleId);
    }
    const pricingSnapshotJson = JSON.stringify(pricing);
    if (pricingSnapshotJson.length <= 450) {
      metadata.pricing_snapshot = pricingSnapshotJson;
    }
    metadata.destination_account_id = destinationAccountId;
    metadata.vendor_share_cents = String(vendorShareCents);
    if (pricing.vendorAccountId) {
      metadata.vendor_account_id = pricing.vendorAccountId;
    }

    try {
      const intent = await stripe.paymentIntents.create({
        amount: pricing.totalCents,
        currency: pricing.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        application_fee_amount: applicationFeeCents,
        transfer_data: {
          destination: destinationAccountId,
        },
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

  try {
    // Create a one-off Checkout Session for top-up
    const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const destinationAccountId = ENV.COGS_VAULT_ACCOUNT_ID ?? process.env.COGS_VAULT_ACCOUNT_ID;

    if (!destinationAccountId) {
      return NextResponse.json({ error: 'COGS vault account not configured' }, { status: 503 });
    }

    const platformFeeCents = Math.round(amountCents * 0.3);
    const vendorShareCents = Math.max(0, amountCents - platformFeeCents);
    const sessionMetadata = {
      kind: 'topup',
      user_id: userId,
      destination_account_id: destinationAccountId,
      platform_fee_cents: String(platformFeeCents),
      vendor_share_cents: String(vendorShareCents),
    };
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
      payment_intent_data: {
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: destinationAccountId,
        },
        metadata: sessionMetadata,
      },
      metadata: sessionMetadata,
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stripe error creating checkout session';
    console.error('POST /api/wallet error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
