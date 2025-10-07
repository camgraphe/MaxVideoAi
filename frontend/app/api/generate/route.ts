export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getEngineById } from '@/lib/engines';
import { randomUUID } from 'crypto';
import { generateVideo } from '@/lib/fal';
import { computePricingSnapshot, getPlatformFeeCents } from '@/lib/pricing';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';
import { getUserIdFromRequest } from '@/lib/user';
import type { PricingSnapshot } from '@/types/engines';
import { ensureBillingSchema } from '@/lib/schema';

type PaymentMode = 'wallet' | 'direct' | 'platform';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });

  const engine = await getEngineById(String(body.engineId || ''));
  if (!engine) return NextResponse.json({ ok: false, error: 'Unknown engine' }, { status: 400 });

  await ensureBillingSchema();

  const requestedJobId = typeof body.jobId === 'string' && body.jobId.trim() ? String(body.jobId).trim() : null;
  const jobId = requestedJobId ?? `job_${randomUUID()}`;
  const prompt = String(body.prompt || '');
  const durationSec = Number(body.durationSec || 4);
  const ar = String(body.aspectRatio || '16:9');

  const pricing = await computePricingSnapshot({
    engine,
    durationSec,
    resolution: String(body.resolution || engine.resolutions?.[0] || '1080p'),
    addons: body.addons,
    membershipTier: body.membershipTier,
  });
  pricing.meta = {
    ...(pricing.meta ?? {}),
    request: {
      engineId: engine.id,
      engineLabel: engine.label,
      mode: typeof body.mode === 'string' ? body.mode : 't2v',
      durationSec,
      aspectRatio: ar,
      resolution: String(body.resolution || engine.resolutions?.[0] || '1080p'),
      fps: typeof body.fps === 'number' ? body.fps : engine.fps?.[0],
      addons: {
        audio: Boolean(body.addons?.audio),
        upscale4k: Boolean(body.addons?.upscale4k),
      },
    },
  };

  const payment: { mode?: PaymentMode; paymentIntentId?: string | null } =
    typeof body.payment === 'object' && body.payment
      ? { mode: body.payment.mode, paymentIntentId: body.payment.paymentIntentId }
      : {};
  const authenticatedUserId = await getUserIdFromRequest(req);
  const userId = body.userId ?? authenticatedUserId ?? null;
  const paymentMode: PaymentMode = payment.mode ?? (userId ? 'wallet' : 'platform');
  const vendorAccountId = pricing.vendorAccountId ?? engine.vendorAccountId ?? null;
  const applicationFeeCents = getPlatformFeeCents(pricing);

  type PendingReceipt = {
    userId: string;
    amountCents: number;
    currency: string;
    description: string;
    jobId: string;
    snapshot: PricingSnapshot;
    applicationFeeCents: number;
    vendorAccountId: string | null;
    stripePaymentIntentId?: string | null;
    stripeChargeId?: string | null;
  };

  let pendingReceipt: PendingReceipt | null = null;
  let paymentStatus: string = 'platform';
  let stripePaymentIntentId: string | null = null;
  let stripeChargeId: string | null = null;

  if (paymentMode === 'wallet') {
    const walletUserId = userId ? String(userId) : null;
    if (!walletUserId) {
      return NextResponse.json({ ok: false, error: 'Wallet payment requires authentication' }, { status: 401 });
    }

    const balanceRows = await query<{ balance_cents: number }>(
      `SELECT COALESCE(SUM(
          CASE
            WHEN type = 'topup' THEN amount_cents
            WHEN type = 'refund' THEN amount_cents
            WHEN type = 'charge' THEN -amount_cents
            ELSE 0
          END
        ), 0) AS balance_cents
       FROM app_receipts
       WHERE user_id = $1`,
      [walletUserId]
    );
    const balanceCents = Number(balanceRows[0]?.balance_cents ?? 0);
    if (balanceCents < pricing.totalCents) {
      return NextResponse.json(
        {
          ok: false,
          error: 'INSUFFICIENT_WALLET_FUNDS',
          requiredCents: pricing.totalCents - balanceCents,
          balanceCents,
        },
        { status: 402 }
      );
    }

    pendingReceipt = {
      userId: walletUserId,
      amountCents: pricing.totalCents,
      currency: pricing.currency,
      description: `Run ${engine.label} • ${durationSec}s`,
      jobId,
      snapshot: pricing,
      applicationFeeCents,
      vendorAccountId,
    };
    paymentStatus = 'paid_wallet';
  } else if (paymentMode === 'direct') {
    if (!ENV.STRIPE_SECRET_KEY) {
      return NextResponse.json({ ok: false, error: 'Stripe not configured' }, { status: 501 });
    }
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Direct payment requires authentication' }, { status: 401 });
    }
    if (!payment.paymentIntentId) {
      return NextResponse.json({ ok: false, error: 'PaymentIntent required for direct mode' }, { status: 400 });
    }
    if (!vendorAccountId) {
      return NextResponse.json({ ok: false, error: 'Vendor account missing for this engine' }, { status: 400 });
    }

    const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const intent = await stripe.paymentIntents.retrieve(payment.paymentIntentId, { expand: ['latest_charge'] });

    if (intent.status !== 'succeeded' || (intent.amount_received ?? intent.amount) < pricing.totalCents) {
      return NextResponse.json({ ok: false, error: 'Payment not captured yet' }, { status: 402 });
    }
    const intentCurrency = intent.currency?.toUpperCase() ?? pricing.currency;
    if (intentCurrency !== pricing.currency.toUpperCase()) {
      return NextResponse.json({ ok: false, error: 'Payment currency mismatch' }, { status: 409 });
    }
    if (intent.transfer_data?.destination && intent.transfer_data.destination !== vendorAccountId) {
      return NextResponse.json({ ok: false, error: 'Payment vendor mismatch' }, { status: 409 });
    }

    stripePaymentIntentId = intent.id;
    const latestCharge = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id ?? null;
    stripeChargeId = latestCharge;
    const intentJobId = typeof intent.metadata?.job_id === 'string' ? intent.metadata.job_id : null;
    if (intentJobId && intentJobId !== jobId) {
      return NextResponse.json({ ok: false, error: 'Payment job mismatch' }, { status: 409 });
    }

    pendingReceipt = {
      userId: String(userId),
      amountCents: intent.amount_received ?? intent.amount,
      currency: intentCurrency,
      description: `Run ${engine.label} • ${durationSec}s`,
      jobId,
      snapshot: pricing,
      applicationFeeCents: intent.application_fee_amount ?? applicationFeeCents,
      vendorAccountId,
      stripePaymentIntentId,
      stripeChargeId,
    };
    paymentStatus = 'paid_direct';
  } else if (paymentMode === 'platform') {
    paymentStatus = 'platform';
  } else {
    return NextResponse.json({ ok: false, error: 'Unsupported payment mode' }, { status: 400 });
  }

  let generationResult: Awaited<ReturnType<typeof generateVideo>>;
  try {
    generationResult = await generateVideo({
      engineId: engine.id,
      prompt,
      durationSec,
      aspectRatio: ar,
      resolution: body.resolution,
      fps: body.fps,
      mode: body.mode,
      addons: body.addons,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 });
  }

  const thumb = generationResult.thumbUrl;
  const video = generationResult.videoUrl ?? null;
  const videoAsset = generationResult.video ?? null;
  const providerMode = generationResult.provider;
  const status = generationResult.status ?? (video ? 'completed' : 'queued');
  const progress = typeof generationResult.progress === 'number' ? generationResult.progress : video ? 100 : 0;
  const providerJobId = generationResult.providerJobId ?? null;

  await query(
    `INSERT INTO app_jobs (job_id, user_id, engine_id, engine_label, duration_sec, prompt, thumb_url, aspect_ratio, has_audio, can_upscale, preview_frame, video_url, status, progress, provider_job_id, final_price_cents, pricing_snapshot, currency, vendor_account_id, payment_status, stripe_payment_intent_id, stripe_charge_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22)`,
    [
      jobId,
      userId,
      engine.id,
      engine.label,
      durationSec,
      prompt,
      thumb,
      ar,
      Boolean(body.addons?.audio),
      Boolean(engine.upscale4k),
      thumb,
      video,
      status,
      progress,
      providerJobId,
      pricing.totalCents,
      JSON.stringify(pricing),
      pricing.currency,
      vendorAccountId,
      paymentStatus,
      stripePaymentIntentId,
      stripeChargeId,
    ]
  );

  if (pendingReceipt) {
    await query(
      `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, job_id, pricing_snapshot, application_fee_cents, vendor_account_id, stripe_payment_intent_id, stripe_charge_id)
       VALUES ($1,'charge',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`,
      [
        pendingReceipt.userId,
        pendingReceipt.amountCents,
        pendingReceipt.currency,
        pendingReceipt.description,
        pendingReceipt.jobId,
        JSON.stringify(pendingReceipt.snapshot),
        pendingReceipt.applicationFeeCents,
        pendingReceipt.vendorAccountId,
        pendingReceipt.stripePaymentIntentId ?? null,
        pendingReceipt.stripeChargeId ?? null,
      ]
    );
  }

  try {
    await query(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        jobId,
        providerMode,
        providerJobId,
        engine.id,
        status,
        JSON.stringify({
          request: {
            durationSec,
            aspectRatio: ar,
            resolution: body.resolution,
            addons: body.addons,
          },
          pricing: {
            totalCents: pricing.totalCents,
            currency: pricing.currency,
          },
        }),
      ]
    );
  } catch (error) {
    console.warn('[queue-log] failed to insert entry', error);
  }

  if (status === 'failed' && pendingReceipt && paymentMode === 'wallet') {
    try {
      await query(
        `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, job_id, pricing_snapshot, application_fee_cents, vendor_account_id, stripe_payment_intent_id, stripe_charge_id)
         VALUES ($1,'refund',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`,
        [
          pendingReceipt.userId,
          pendingReceipt.amountCents,
          pendingReceipt.currency,
          `Refund ${engine.label} • ${durationSec}s`,
          pendingReceipt.jobId,
          JSON.stringify(pendingReceipt.snapshot),
          0,
          pendingReceipt.vendorAccountId,
          pendingReceipt.stripePaymentIntentId ?? null,
          pendingReceipt.stripeChargeId ?? null,
        ]
      );
      await query(`UPDATE app_jobs SET payment_status = 'refunded_wallet' WHERE job_id = $1`, [jobId]);
    } catch (error) {
      console.warn('[wallet] failed to record refund', error);
    }
  }

  const responsePaymentStatus =
    status === 'failed' && pendingReceipt && paymentMode === 'wallet' ? 'refunded_wallet' : paymentStatus;

  return NextResponse.json({
    ok: true,
    jobId,
    videoUrl: video,
    video: videoAsset,
    thumbUrl: thumb,
    status,
    progress,
    pricing,
    paymentStatus: responsePaymentStatus,
    provider: providerMode,
    providerJobId,
  });
}
