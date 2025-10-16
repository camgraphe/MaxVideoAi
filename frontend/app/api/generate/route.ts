export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { getEngineById } from '@/lib/engines';
import { randomUUID } from 'crypto';
import { generateVideo } from '@/lib/fal';
import { computePricingSnapshot, getPlatformFeeCents } from '@/lib/pricing';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';
import { getUserIdFromRequest } from '@/lib/user';
import type { PricingSnapshot } from '@/types/engines';
import { ensureBillingSchema } from '@/lib/schema';
import { reserveWalletCharge } from '@/lib/wallet';
import { normalizeMediaUrl } from '@/lib/media';
import type { Mode } from '@/types/engines';
import { validateRequest } from './_lib/validate';
import { uploadImageToStorage, isAllowedAssetHost, probeImageUrl, recordUserAsset } from '@/server/storage';

type PaymentMode = 'wallet' | 'direct' | 'platform';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });

  const engine = await getEngineById(String(body.engineId || ''));
  if (!engine) return NextResponse.json({ ok: false, error: 'Unknown engine' }, { status: 400 });

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  try {
    await ensureBillingSchema();
  } catch {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const requestedJobId = typeof body.jobId === 'string' && body.jobId.trim() ? String(body.jobId).trim() : null;
  const jobId = requestedJobId ?? `job_${randomUUID()}`;
  const rawMode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : '';
  const mode: Mode = (['t2v', 'i2v'] as const).includes(rawMode as Mode)
    ? ((rawMode as Mode) ?? engine.modes[0] ?? 't2v')
    : engine.modes.includes('t2v')
      ? 't2v'
      : engine.modes[0];

  const prompt = String(body.prompt || '');
  const durationSec = Number(body.durationSec || 4);
  const rawAspectRatio =
    typeof body.aspectRatio === 'string' && body.aspectRatio.trim().length ? body.aspectRatio.trim() : '16:9';
  const fallbackAspectRatio =
    engine.aspectRatios?.find((value) => value !== 'auto') ?? engine.aspectRatios?.[0] ?? '16:9';
  const aspectRatio = rawAspectRatio === 'auto' ? fallbackAspectRatio : rawAspectRatio;
  const batchId = typeof body.batchId === 'string' && body.batchId.trim().length ? body.batchId.trim() : null;
  const groupId = typeof body.groupId === 'string' && body.groupId.trim().length ? body.groupId.trim() : null;
  const iterationIndex =
    typeof body.iterationIndex === 'number' && Number.isFinite(body.iterationIndex)
      ? Math.max(0, Math.trunc(body.iterationIndex))
      : null;
  const iterationCount =
    typeof body.iterationCount === 'number' && Number.isFinite(body.iterationCount)
      ? Math.max(1, Math.trunc(body.iterationCount))
      : null;
  const renderIds =
    Array.isArray(body.renderIds) && body.renderIds.length
      ? body.renderIds.map((value: unknown) => (typeof value === 'string' ? value : null)).filter(Boolean)
      : null;
  const heroRenderId =
    typeof body.heroRenderId === 'string' && body.heroRenderId.trim().length ? body.heroRenderId.trim() : null;
  const localKey = typeof body.localKey === 'string' && body.localKey.trim().length ? body.localKey.trim() : null;
  const message = typeof body.message === 'string' && body.message.trim().length ? body.message.trim() : null;
  const etaSeconds =
    typeof body.etaSeconds === 'number' && Number.isFinite(body.etaSeconds)
      ? Math.max(0, Math.trunc(body.etaSeconds))
      : null;
  const etaLabel = typeof body.etaLabel === 'string' && body.etaLabel.trim().length ? body.etaLabel.trim() : null;

  const requestedResolution =
    typeof body.resolution === 'string' && body.resolution.trim().length
      ? body.resolution.trim()
      : engine.resolutions?.[0] ?? '1080p';
  const pricingResolution =
    requestedResolution === 'auto'
      ? engine.resolutions.find((value) => value !== 'auto') ?? engine.resolutions[0] ?? '1080p'
      : requestedResolution;
  const effectiveResolution = requestedResolution === 'auto' ? pricingResolution : requestedResolution;

  const rawNumFrames =
    typeof body.numFrames === 'number'
      ? body.numFrames
      : typeof body.num_frames === 'number'
        ? body.num_frames
        : null;
  const numFrames =
    rawNumFrames != null && Number.isFinite(rawNumFrames) && rawNumFrames > 0 ? Math.round(rawNumFrames) : null;

  const pricing = await computePricingSnapshot({
    engine,
    durationSec,
    resolution: pricingResolution,
    addons: body.addons,
    membershipTier: body.membershipTier,
  });
  pricing.meta = {
    ...(pricing.meta ?? {}),
    request: {
      engineId: engine.id,
      engineLabel: engine.label,
      mode,
      durationSec,
      aspectRatio,
      resolution: effectiveResolution,
      effectiveResolution: pricingResolution,
      fps: typeof body.fps === 'number' ? body.fps : engine.fps?.[0],
      addons: {
        audio: Boolean(body.addons?.audio),
        upscale4k: Boolean(body.addons?.upscale4k),
      },
    },
  };
  const pricingSnapshotJson = JSON.stringify(pricing);

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
  let walletChargeReserved = false;

  if (paymentMode === 'wallet') {
    const walletUserId = userId ? String(userId) : null;
    if (!walletUserId) {
      return NextResponse.json({ ok: false, error: 'Wallet payment requires authentication' }, { status: 401 });
    }

    const reserveResult = await reserveWalletCharge({
      userId: walletUserId,
      amountCents: pricing.totalCents,
      currency: pricing.currency,
      description: `Run ${engine.label} • ${durationSec}s`,
      jobId,
      pricingSnapshotJson,
      applicationFeeCents,
      vendorAccountId,
      stripePaymentIntentId: null,
      stripeChargeId: null,
    });

    if (!reserveResult.ok) {
      const balanceCents = reserveResult.balanceCents;
      return NextResponse.json(
        {
          ok: false,
          error: 'INSUFFICIENT_WALLET_FUNDS',
          requiredCents: Math.max(0, pricing.totalCents - balanceCents),
          balanceCents,
        },
        { status: 402 }
      );
    }

    walletChargeReserved = true;

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
  const apiKey =
    typeof body.apiKey === 'string' && body.apiKey.trim().length > 0 ? body.apiKey.trim() : undefined;

  type NormalizedAttachment = {
    name: string;
    type: string;
    size: number;
    kind?: 'image' | 'video';
    slotId?: string;
    label?: string;
    url?: string;
    width?: number | null;
    height?: number | null;
    assetId?: string;
  };

  const rawAttachments = Array.isArray(body.inputs) ? (body.inputs as unknown[]) : [];
  const processedAttachments: NormalizedAttachment[] = [];

  const decodeDataUrl = (value: string): { buffer: Buffer; mime: string } => {
    const match = /^data:([^;,]+);base64,(.+)$/i.exec(value);
    if (!match) {
      throw new Error('Invalid data URL');
    }
    const [, mime, base64] = match;
    return {
      mime,
      buffer: Buffer.from(base64, 'base64'),
    };
  };

  for (const entry of rawAttachments) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Record<string, unknown>;
    const base: NormalizedAttachment = {
      name: typeof candidate.name === 'string' ? candidate.name : 'attachment',
      type: typeof candidate.type === 'string' ? candidate.type : 'application/octet-stream',
      size: typeof candidate.size === 'number' ? candidate.size : 0,
      kind:
        candidate.kind === 'image' || candidate.kind === 'video'
          ? (candidate.kind as 'image' | 'video')
          : undefined,
      slotId: typeof candidate.slotId === 'string' ? candidate.slotId : undefined,
      label: typeof candidate.label === 'string' ? candidate.label : undefined,
    };

    const urlCandidate = typeof candidate.url === 'string' ? candidate.url.trim() : null;
    const dataUrlCandidate = typeof candidate.dataUrl === 'string' ? candidate.dataUrl.trim() : null;
    const width = typeof candidate.width === 'number' ? candidate.width : null;
    const height = typeof candidate.height === 'number' ? candidate.height : null;
    const assetId = typeof candidate.assetId === 'string' ? candidate.assetId : undefined;

    if (urlCandidate) {
      if (!isAllowedAssetHost(urlCandidate)) {
        return NextResponse.json(
          { ok: false, error: 'IMAGE_HOST_NOT_ALLOWED', url: urlCandidate },
          { status: 422 }
        );
      }

      let sizeBytes = base.size;
      let mimeType = base.type;
      if (!sizeBytes || !mimeType || mimeType === 'application/octet-stream') {
        const probe = await probeImageUrl(urlCandidate);
        if (!probe.ok) {
          return NextResponse.json({ ok: false, error: 'IMAGE_UNREACHABLE', url: urlCandidate }, { status: 422 });
        }
        sizeBytes = sizeBytes || probe.size || 0;
        mimeType = mimeType === 'application/octet-stream' && probe.mime ? probe.mime : mimeType;
      }

      processedAttachments.push({
        ...base,
        type: mimeType,
        size: sizeBytes,
        url: urlCandidate,
        width,
        height,
        assetId,
      });
      continue;
    }

    if (dataUrlCandidate && dataUrlCandidate.startsWith('data:')) {
      const { buffer, mime } = decodeDataUrl(dataUrlCandidate);
      let uploadResult;
      try {
        uploadResult = await uploadImageToStorage({
          data: buffer,
          mime,
          userId,
          fileName: base.name,
          prefix: 'inline',
        });
      } catch (error) {
        console.error('[generate] failed to upload inline attachment', error);
        return NextResponse.json({ ok: false, error: 'IMAGE_UPLOAD_FAILED' }, { status: 500 });
      }

      try {
        const assetIdCreated = await recordUserAsset({
          userId,
          url: uploadResult.url,
          mime: uploadResult.mime,
          width: uploadResult.width,
          height: uploadResult.height,
          size: uploadResult.size,
          source: 'inline',
          metadata: { originalName: base.name },
        });

        processedAttachments.push({
          ...base,
          type: uploadResult.mime,
          size: uploadResult.size,
          url: uploadResult.url,
          width: uploadResult.width,
          height: uploadResult.height,
          assetId: assetIdCreated,
        });
      } catch (error) {
        console.error('[generate] failed to record inline asset', error);
      }
      continue;
    }
  }

  const maxUploadedBytes =
    processedAttachments.reduce((max, attachment) => Math.max(max, attachment.size ?? 0), 0) ?? 0;
  const validationPayload: Record<string, unknown> = {
    resolution: effectiveResolution,
    aspect_ratio: aspectRatio,
  };

  if (numFrames != null) {
    validationPayload.num_frames = numFrames;
  } else if (Number.isFinite(durationSec)) {
    validationPayload.duration = durationSec;
  }

  if (mode === 't2v' && body.addons?.audio === true) {
    validationPayload.generate_audio = true;
    validationPayload.audio = true;
  }

  if (maxUploadedBytes > 0) {
    validationPayload._uploadedFileMB = maxUploadedBytes / (1024 * 1024);
  }

  const validationResult = validateRequest(engine.id, mode, validationPayload);
  if (!validationResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: validationResult.error.code,
        field: validationResult.error.field,
        error: validationResult.error.message,
      },
      { status: 400 }
    );
  }

  try {
    generationResult = await generateVideo({
      engineId: engine.id,
      prompt,
      durationSec,
      numFrames,
      aspectRatio,
      resolution: effectiveResolution,
      fps: body.fps,
      mode,
      addons: body.addons,
      apiKey,
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl.trim() : undefined,
      referenceImages: Array.isArray(body.referenceImages)
        ? body.referenceImages
            .map((candidate: unknown) => (typeof candidate === 'string' ? candidate.trim() : null))
            .filter((value: string | null): value is string => typeof value === 'string' && value.length > 0)
        : undefined,
      inputs: processedAttachments,
      idempotencyKey: body.idempotencyKey && typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
    });
  } catch (error) {
    if (walletChargeReserved && pendingReceipt) {
      try {
        await query(
          `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, job_id, pricing_snapshot, application_fee_cents, vendor_account_id, stripe_payment_intent_id, stripe_charge_id, platform_revenue_cents, destination_acct)
           VALUES ($1,'refund',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12)`,
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
            0,
            pendingReceipt.vendorAccountId,
          ]
        );
      } catch (refundError) {
        console.warn('[wallet] failed to roll back reservation after generation error', refundError);
      }
    }

    const rawStatus = (error && typeof error === 'object' && 'status' in error) ? (error as { status?: number }).status : undefined;
    const metadataStatus = (error && typeof error === 'object' && '$metadata' in error)
      ? ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode)
      : undefined;
    const status = rawStatus ?? metadataStatus;

    if (status === 422) {
      const detail =
        error && typeof error === 'object' && 'body' in error
          ? (error as { body?: unknown }).body ?? null
          : null;
      const providerMessage =
        typeof detail === 'string'
          ? detail
          : detail && typeof detail === 'object' && 'detail' in (detail as Record<string, unknown>)
            ? String((detail as Record<string, unknown>).detail)
            : error instanceof Error
              ? error.message
              : 'Fal returned status 422';
      console.error('[generate] fal returned 422', providerMessage);
      return NextResponse.json(
        {
          ok: false,
          error: 'FAL_UNPROCESSABLE_ENTITY',
          detail: detail ?? providerMessage,
          userMessage:
            'The provider rejected this reference image because it conflicts with their safety policies. Please upload a different image.',
          providerMessage,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Generation failed' }, { status: 500 });
  }

  const placeholderThumb =
    aspectRatio === '9:16'
      ? '/assets/frames/thumb-9x16.svg'
      : aspectRatio === '1:1'
        ? '/assets/frames/thumb-1x1.svg'
        : '/assets/frames/thumb-16x9.svg';
  const thumb =
    normalizeMediaUrl(generationResult.thumbUrl) ??
      (typeof generationResult.thumbUrl === 'string' && generationResult.thumbUrl.trim().length
        ? generationResult.thumbUrl
        : null) ??
    placeholderThumb;
  const video = normalizeMediaUrl(generationResult.videoUrl) ?? generationResult.videoUrl ?? null;
  const videoAsset = generationResult.video ?? null;
  const providerMode = generationResult.provider;
  const status = generationResult.status ?? (video ? 'completed' : 'queued');
  const progress = typeof generationResult.progress === 'number' ? generationResult.progress : video ? 100 : 0;
  const providerJobId = generationResult.providerJobId ?? null;

  try {
    await query(
      `INSERT INTO app_jobs (
         job_id,
         user_id,
         engine_id,
         engine_label,
         duration_sec,
         prompt,
         thumb_url,
         aspect_ratio,
         has_audio,
         can_upscale,
         preview_frame,
         batch_id,
         group_id,
         iteration_index,
         iteration_count,
         render_ids,
         hero_render_id,
         local_key,
         message,
         eta_seconds,
         eta_label,
         video_url,
         status,
         progress,
         provider_job_id,
         final_price_cents,
         pricing_snapshot,
         currency,
         vendor_account_id,
         payment_status,
         stripe_payment_intent_id,
         stripe_charge_id
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27::jsonb,$28,$29,$30,$31,$32
       )`,
      [
        jobId,
        userId,
        engine.id,
        engine.label,
        durationSec,
        prompt,
        thumb,
        aspectRatio,
        Boolean(body.addons?.audio),
        Boolean(engine.upscale4k),
        thumb,
        batchId,
        groupId,
        iterationIndex,
        iterationCount,
        renderIds ? JSON.stringify(renderIds) : null,
        heroRenderId,
        localKey,
        message,
        etaSeconds,
        etaLabel,
        video,
        status,
        progress,
        providerJobId,
        pricing.totalCents,
        pricingSnapshotJson,
        pricing.currency,
        vendorAccountId,
        paymentStatus,
        stripePaymentIntentId,
        stripeChargeId,
      ]
    );
  } catch (error) {
    console.error('[api/generate] failed to persist job record', error);
    if (walletChargeReserved && pendingReceipt) {
      try {
        await query(
          `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, job_id, pricing_snapshot, application_fee_cents, vendor_account_id, stripe_payment_intent_id, stripe_charge_id, platform_revenue_cents, destination_acct)
           VALUES ($1,'refund',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12)`,
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
            0,
            pendingReceipt.vendorAccountId,
          ]
        );
      } catch (refundError) {
        console.warn('[wallet] failed to record refund after persistence error', refundError);
      }
    }
    return NextResponse.json({ ok: false, error: 'Failed to persist job record' }, { status: 500 });
  }

  if (pendingReceipt && !walletChargeReserved) {
    try {
      await query(
        `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, job_id, pricing_snapshot, application_fee_cents, vendor_account_id, stripe_payment_intent_id, stripe_charge_id, platform_revenue_cents, destination_acct)
         VALUES ($1,'charge',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12)`,
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
          pendingReceipt.applicationFeeCents,
          pendingReceipt.vendorAccountId,
        ]
      );
    } catch (error) {
      console.error('[api/generate] failed to persist payment receipt', error);
    }
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
            aspectRatio,
            resolution: effectiveResolution,
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
        `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, job_id, pricing_snapshot, application_fee_cents, vendor_account_id, stripe_payment_intent_id, stripe_charge_id, platform_revenue_cents, destination_acct)
         VALUES ($1,'refund',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12)`,
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
          0,
          pendingReceipt.vendorAccountId,
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
    batchId,
    groupId,
    iterationIndex,
    iterationCount,
    renderIds,
    heroRenderId,
    localKey,
    message,
    etaSeconds,
    etaLabel,
  });
}
