export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { randomUUID } from 'crypto';
import { generateVideo, FalGenerationError } from '@/lib/fal';
import { computePricingSnapshot, getPlatformFeeCents } from '@/lib/pricing';
import { getConfiguredEngine } from '@/server/engines';
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
import { ensureJobThumbnail, isPlaceholderThumbnail } from '@/server/thumbnails';
import { getEngineCaps } from '@/fixtures/engineCaps';
import { getSoraVariantForEngine, isSoraEngineId, parseSoraRequest, type SoraRequest } from '@/lib/sora';
import { ensureUserPreferences } from '@/server/preferences';
import { translateError } from '@/lib/error-messages';
import {
  getLumaRay2DurationInfo,
  getLumaRay2ResolutionInfo,
  isLumaRay2AspectRatio,
  normaliseLumaRay2Loop,
  toLumaRay2DurationLabel,
  LUMA_RAY2_ERROR_UNSUPPORTED,
  type LumaRay2DurationLabel,
} from '@/lib/luma-ray2';

type PaymentMode = 'wallet' | 'direct' | 'platform';

const LUMA_RAY2_TIMEOUT_MS = 180_000;

class FalTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FalTimeoutError';
  }
}

function withFalTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new FalTimeoutError(`Fal request timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }) as Promise<T>;
}

const FAL_ERROR_FIELDS = [
  'error_message',
  'errorMessage',
  'message',
  'detail',
  'error',
  'reason',
  'status_message',
  'statusMessage',
  'status_reason',
  'statusReason',
  'status_detail',
  'statusDetail',
  'status_description',
  'statusDescription',
  'description',
  'failure',
  'failureReason',
  'cause',
];

function normalizeFalErrorValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) return null;
    if (/^(error|failed|null|undefined)$/i.test(trimmed)) return null;
    return trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Error) {
    return normalizeFalErrorValue(value.message);
  }
  return null;
}

function extractFalProviderMessage(payload: unknown): string | null {
  if (!payload || (typeof payload !== 'object' && typeof payload !== 'string')) {
    return normalizeFalErrorValue(payload);
  }

  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length) {
    const current = stack.pop();
    const directText = normalizeFalErrorValue(current);
    if (directText) return directText;
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const record = current as Record<string, unknown>;
    for (const key of FAL_ERROR_FIELDS) {
      if (key in record) {
        const candidate = normalizeFalErrorValue(record[key]);
        if (candidate) return candidate;
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      } else {
        const candidate = normalizeFalErrorValue(value);
        if (candidate) return candidate;
      }
    }
  }

  return null;
}

function condenseFalErrorMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  const condensed = message.replace(/\s+/g, ' ').trim();
  if (!condensed.length) return null;
  return condensed.length > 400 ? `${condensed.slice(0, 400)}...` : condensed;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });

  const engine = await getConfiguredEngine(String(body.engineId || ''));
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
  const isLumaRay2 = engine.id === 'lumaRay2';
  const rawDurationOption =
    typeof body.durationOption === 'number' || typeof body.durationOption === 'string' ? body.durationOption : null;
  let durationSec = Number(body.durationSec || 4);
  const lumaDurationInfo = isLumaRay2 ? getLumaRay2DurationInfo(rawDurationOption ?? durationSec) : null;
  if (isLumaRay2 && !lumaDurationInfo) {
    return NextResponse.json({ ok: false, error: LUMA_RAY2_ERROR_UNSUPPORTED }, { status: 400 });
  }
  if (lumaDurationInfo) {
    durationSec = lumaDurationInfo.seconds;
  }
  const capability = getEngineCaps(engine.id, mode);
  const supportsAspectRatio = capability ? Boolean(capability.aspectRatio && capability.aspectRatio.length) : true;
  const rawAspectRatio =
    supportsAspectRatio && typeof body.aspectRatio === 'string' && body.aspectRatio.trim().length
      ? body.aspectRatio.trim()
      : null;
  const fallbackAspectRatio = supportsAspectRatio
    ? engine.aspectRatios?.find((value) => value !== 'auto') ?? engine.aspectRatios?.[0] ?? '16:9'
    : null;
  let aspectRatio =
    rawAspectRatio && fallbackAspectRatio
      ? rawAspectRatio === 'auto'
        ? fallbackAspectRatio
        : rawAspectRatio
      : rawAspectRatio ?? fallbackAspectRatio ?? null;
  if (isLumaRay2) {
    if (aspectRatio && !isLumaRay2AspectRatio(aspectRatio)) {
      return NextResponse.json({ ok: false, error: LUMA_RAY2_ERROR_UNSUPPORTED }, { status: 400 });
    }
    if (!aspectRatio) {
      aspectRatio = '16:9';
    }
  }
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

  let requestedResolution =
    typeof body.resolution === 'string' && body.resolution.trim().length
      ? body.resolution.trim()
      : engine.resolutions?.[0] ?? '1080p';
  let pricingResolution =
    requestedResolution === 'auto'
      ? engine.resolutions.find((value) => value !== 'auto') ?? engine.resolutions[0] ?? '1080p'
      : requestedResolution;
  let effectiveResolution = requestedResolution === 'auto' ? pricingResolution : requestedResolution;
  let lumaResolutionInfo = isLumaRay2 ? getLumaRay2ResolutionInfo(requestedResolution) : null;
  if (isLumaRay2) {
    if (requestedResolution === 'auto') {
      requestedResolution = '540p';
      lumaResolutionInfo = getLumaRay2ResolutionInfo(requestedResolution);
    }
    if (!lumaResolutionInfo) {
      return NextResponse.json({ ok: false, error: LUMA_RAY2_ERROR_UNSUPPORTED }, { status: 400 });
    }
    pricingResolution = lumaResolutionInfo.value;
    effectiveResolution = lumaResolutionInfo.value;
    requestedResolution = lumaResolutionInfo.value;
  }

  const rawNumFrames =
    typeof body.numFrames === 'number'
      ? body.numFrames
      : typeof body.num_frames === 'number'
        ? body.num_frames
        : null;
  const numFrames =
    rawNumFrames != null && Number.isFinite(rawNumFrames) && rawNumFrames > 0 ? Math.round(rawNumFrames) : null;

  const loopValue = isLumaRay2 ? normaliseLumaRay2Loop(body.loop) : undefined;
  const loop = isLumaRay2 ? loopValue === true : false;

  let soraRequest: SoraRequest | null = null;
  if (isSoraEngineId(engine.id)) {
    const variant = getSoraVariantForEngine();
    const fallbackAspect = mode === 'i2v' ? 'auto' : '16:9';
    const candidate: Record<string, unknown> = {
      variant,
      mode,
      prompt,
      resolution: requestedResolution === 'auto' && mode === 't2v' ? engine.resolutions[0] ?? '720p' : requestedResolution,
      aspect_ratio: rawAspectRatio ?? fallbackAspect,
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
        return NextResponse.json({ ok: false, error: 'Image URL is required for Sora image-to-video' }, { status: 400 });
      }
      candidate.image_url = imageUrl;
    }

    try {
      soraRequest = parseSoraRequest(candidate);
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid Sora payload',
          details: error instanceof Error ? error.message : undefined,
        },
        { status: 400 }
      );
    }

    durationSec = soraRequest.duration;
    requestedResolution = soraRequest.resolution;
    const fallbackResolution =
      engine.resolutions.find((value) => value !== 'auto') ?? engine.resolutions[0] ?? '720p';
    pricingResolution = soraRequest.resolution === 'auto' ? fallbackResolution : soraRequest.resolution;
    effectiveResolution = soraRequest.resolution === 'auto' ? fallbackResolution : soraRequest.resolution;
    const fallbackAspectNormalized =
      engine.aspectRatios?.find((value) => value !== 'auto') ?? engine.aspectRatios?.[0] ?? '16:9';
    aspectRatio =
      soraRequest.mode === 'i2v' && soraRequest.aspect_ratio === 'auto'
        ? fallbackAspectNormalized
        : soraRequest.aspect_ratio === 'auto'
          ? fallbackAspectNormalized
          : soraRequest.aspect_ratio;
  }

  const pricing = await computePricingSnapshot({
    engine,
    durationSec,
    resolution: pricingResolution,
    membershipTier: body.membershipTier,
    loop: isLumaRay2 ? loop : undefined,
    durationOption: lumaDurationInfo?.label ?? rawDurationOption ?? null,
  });
  const rawDurationLabel: LumaRay2DurationLabel | undefined =
    typeof rawDurationOption === 'string' && ['5s', '9s'].includes(rawDurationOption)
      ? (rawDurationOption as LumaRay2DurationLabel)
      : undefined;
  const durationLabel =
    lumaDurationInfo?.label ?? toLumaRay2DurationLabel(durationSec, rawDurationLabel) ?? undefined;
  const requestMeta: Record<string, unknown> = {
    engineId: engine.id,
    engineLabel: engine.label,
    mode,
    durationSec,
    variant: soraRequest?.variant,
    aspectRatio: aspectRatio ?? 'source',
    resolution: effectiveResolution,
    effectiveResolution: pricingResolution,
  };
  if (durationLabel) {
    requestMeta.durationLabel = durationLabel;
  }
  if (isLumaRay2) {
    requestMeta.loop = loop;
  }

  pricing.meta = {
    ...(pricing.meta ?? {}),
    request: requestMeta,
  };
  const costBreakdownUsd = (pricing.meta?.cost_breakdown_usd as Record<string, unknown> | undefined) ?? null;
  const pricingSnapshotJson = JSON.stringify(pricing);
  const costBreakdownJson = costBreakdownUsd ? JSON.stringify(costBreakdownUsd) : null;

  const payment: { mode?: PaymentMode; paymentIntentId?: string | null } =
    typeof body.payment === 'object' && body.payment
      ? { mode: body.payment.mode, paymentIntentId: body.payment.paymentIntentId }
      : {};
  const explicitUserId = typeof body.userId === 'string' && body.userId.trim().length ? body.userId.trim() : null;
  const authenticatedUserId = await getUserIdFromRequest(req);
  const userId = explicitUserId ?? authenticatedUserId ?? null;
  const paymentMode: PaymentMode = payment.mode ?? (userId ? 'wallet' : 'platform');
  const vendorAccountId = pricing.vendorAccountId ?? engine.vendorAccountId ?? null;
  const applicationFeeCents = getPlatformFeeCents(pricing);
  let defaultAllowIndex = true;
  if (userId) {
    try {
      const prefs = await ensureUserPreferences(String(userId));
      defaultAllowIndex = prefs.defaultAllowIndex;
    } catch (error) {
      console.warn('[api/generate] unable to read user preferences for indexing', error);
    }
  }
  const requestedVisibility =
    typeof body.visibility === 'string' && body.visibility.trim().length
      ? body.visibility.trim().toLowerCase()
      : null;
  const visibility: 'public' | 'private' = requestedVisibility === 'public' ? 'public' : 'private';
  const requestedIndexable =
    typeof body.indexable === 'boolean'
      ? body.indexable
      : typeof body.allowIndex === 'boolean'
        ? body.allowIndex
        : undefined;
  const indexable = requestedIndexable ?? defaultAllowIndex;

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

async function recordRefundReceipt(
  receipt: PendingReceipt,
  description: string,
  stripeRefundId: string | null
): Promise<void> {
  if (!receipt.jobId) return;
  try {
    const existing = await query<{ id: string }>(
      `SELECT id FROM app_receipts WHERE job_id = $1 AND type = 'refund' LIMIT 1`,
      [receipt.jobId]
    );
    if (existing.length) return;
  } catch (error) {
    console.warn('[receipts] failed to check existing refund', error);
    return;
  }

  try {
    await query(
      `INSERT INTO app_receipts (
         user_id,
         type,
         amount_cents,
         currency,
         description,
         job_id,
         pricing_snapshot,
         application_fee_cents,
         vendor_account_id,
         stripe_payment_intent_id,
         stripe_charge_id,
         stripe_refund_id,
         platform_revenue_cents,
         destination_acct
       )
       VALUES (
         $1,'refund',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13
       )`,
      [
        receipt.userId,
        receipt.amountCents,
        receipt.currency,
        description,
        receipt.jobId,
        JSON.stringify(receipt.snapshot),
        0,
        receipt.vendorAccountId,
        receipt.stripePaymentIntentId ?? null,
        receipt.stripeChargeId ?? null,
        stripeRefundId ?? null,
        0,
        receipt.vendorAccountId,
      ]
    );
  } catch (error) {
    console.warn('[receipts] failed to record refund', error);
  }
}

async function issueStripeRefund(receipt: PendingReceipt): Promise<string | null> {
  const refundReference = receipt.stripePaymentIntentId ?? receipt.stripeChargeId;
  if (!refundReference) return null;
  if (!ENV.STRIPE_SECRET_KEY) {
    console.warn('[stripe] unable to refund: STRIPE_SECRET_KEY missing');
    return null;
  }
  try {
    const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const params = receipt.stripePaymentIntentId
      ? { payment_intent: receipt.stripePaymentIntentId }
      : { charge: receipt.stripeChargeId! };
    const idempotencyKey = receipt.jobId ? `job-refund-${receipt.jobId}` : undefined;
    const refund = await stripe.refunds.create(
      params,
      idempotencyKey ? { idempotencyKey } : undefined
    );
    return refund?.id ?? null;
  } catch (error) {
    console.warn('[stripe] refund failed', error);
    return null;
  }
}

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
      description: `Run ${engine.label} - ${durationSec}s`,
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
      description: `Run ${engine.label} - ${durationSec}s`,
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
      description: `Run ${engine.label} - ${durationSec}s`,
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

  let generationResult: Awaited<ReturnType<typeof generateVideo>> | null = null;
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
  const initialImageUrl =
    soraRequest?.mode === 'i2v'
      ? soraRequest.image_url
      : typeof body.imageUrl === 'string' && body.imageUrl.trim().length
        ? body.imageUrl.trim()
        : undefined;
  const validationPayload: Record<string, unknown> = {
    resolution: effectiveResolution,
  };
  if (aspectRatio) {
    validationPayload.aspect_ratio = aspectRatio;
  }

  if (numFrames != null) {
    validationPayload.num_frames = numFrames;
  } else if (lumaDurationInfo) {
    validationPayload.duration = lumaDurationInfo.label;
  } else if (Number.isFinite(durationSec)) {
    validationPayload.duration = durationSec;
  }

  if (maxUploadedBytes > 0) {
    validationPayload._uploadedFileMB = maxUploadedBytes / (1024 * 1024);
  }

  if (isLumaRay2 && mode === 'i2v') {
    if (!initialImageUrl) {
      return NextResponse.json({ ok: false, error: 'Image URL is required for Luma Ray 2 image-to-video' }, { status: 400 });
    }
    validationPayload.image_url = initialImageUrl;
  }

  const validationResult = validateRequest(engine.id, mode, validationPayload);
  if (!validationResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: validationResult.error.code ?? 'ENGINE_CONSTRAINT',
        message: validationResult.error.message,
        field: validationResult.error.field,
        allowed: validationResult.error.allowed,
        value: validationResult.error.value,
      },
      { status: 400 }
    );
  }

  const placeholderThumb =
    aspectRatio === '9:16'
      ? '/assets/frames/thumb-9x16.svg'
      : aspectRatio === '1:1'
        ? '/assets/frames/thumb-1x1.svg'
        : '/assets/frames/thumb-16x9.svg';

  const referenceImagesInput = Array.isArray(body.referenceImages)
    ? body.referenceImages
    : Array.isArray(body.reference_images)
      ? body.reference_images
      : null;
  const normalizedReferenceImages = Array.isArray(referenceImagesInput)
    ? referenceImagesInput
        .map((value: unknown) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value): value is string => value.length > 0)
    : undefined;

  const falInputs =
    processedAttachments.length > 0
      ? processedAttachments.map((attachment) => ({
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          kind: attachment.kind,
          slotId: attachment.slotId,
          label: attachment.label,
          url: attachment.url,
          width: attachment.width ?? undefined,
          height: attachment.height ?? undefined,
          assetId: attachment.assetId,
        }))
      : undefined;

  const falDurationOption = lumaDurationInfo?.label ?? rawDurationLabel ?? rawDurationOption ?? null;
  const falPayload: Parameters<typeof generateVideo>[0] = {
    engineId: engine.id,
    prompt,
    durationSec,
    durationOption: falDurationOption,
    numFrames,
    aspectRatio: aspectRatio ?? undefined,
    resolution: effectiveResolution,
    mode,
    apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
    idempotencyKey: jobId,
    imageUrl: initialImageUrl,
    referenceImages: normalizedReferenceImages,
    inputs: falInputs,
    soraRequest: soraRequest ?? undefined,
    jobId,
    localKey,
    loop: isLumaRay2 ? loop : undefined,
  };
  if (typeof body.fps === 'number' && Number.isFinite(body.fps) && body.fps > 0) {
    falPayload.fps = body.fps;
  }

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
         cost_breakdown_usd,
         currency,
         vendor_account_id,
         payment_status,
         stripe_payment_intent_id,
         stripe_charge_id,
         visibility,
         indexable,
         provisional
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27::jsonb,$28::jsonb,$29,$30,$31,$32,$33,$34,$35,$36
       )`,
      [
        jobId,
        userId,
        engine.id,
        engine.label,
        durationSec,
        prompt,
        placeholderThumb,
        aspectRatio,
        false,
        Boolean(engine.upscale4k),
        placeholderThumb,
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
        null,
        'pending',
        0,
        null,
        pricing.totalCents,
        pricingSnapshotJson,
        costBreakdownJson,
        pricing.currency,
        vendorAccountId,
        paymentStatus,
        stripePaymentIntentId,
        stripeChargeId,
        visibility,
        indexable,
        true,
      ]
    );
  } catch (error) {
    console.error('[api/generate] failed to persist provisional job record', error);
    if (walletChargeReserved && pendingReceipt) {
      try {
        await query(
          `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, job_id, pricing_snapshot, application_fee_cents, vendor_account_id, stripe_payment_intent_id, stripe_charge_id, platform_revenue_cents, destination_acct)
           VALUES ($1,'refund',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12)`,
          [
            pendingReceipt.userId,
            pendingReceipt.amountCents,
            pendingReceipt.currency,
            `Refund ${engine.label} - ${durationSec}s`,
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
        console.warn('[wallet] failed to record refund after provisional persistence error', refundError);
      }
    }
    return NextResponse.json({ ok: false, error: 'Failed to persist job record' }, { status: 500 });
  }

  try {
    const maxAttempts = isLumaRay2 ? 2 : 1;
    let attempt = 0;
    let lastError: unknown;
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const promise = generateVideo({ ...falPayload });
        generationResult = isLumaRay2
          ? await withFalTimeout(promise, LUMA_RAY2_TIMEOUT_MS)
          : await promise;
        break;
      } catch (error) {
        if (isLumaRay2 && error instanceof FalTimeoutError && attempt < maxAttempts) {
          console.warn('[fal] lumaRay2 timeout', { jobId, attempt });
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    if (!generationResult) {
      throw lastError ?? new Error('Fal generation failed');
    }
  } catch (error) {
    const rawStatus =
      error && typeof error === 'object' && 'status' in error ? (error as { status?: number }).status : undefined;
    const metadataStatus =
      error && typeof error === 'object' && '$metadata' in error
        ? ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode)
        : undefined;
    const status = rawStatus ?? metadataStatus;
    const detail =
      error && typeof error === 'object' && 'body' in error ? (error as { body?: unknown }).body ?? null : null;
    const providerMessageRaw =
      extractFalProviderMessage(detail) ??
      (error instanceof FalGenerationError && error.body ? extractFalProviderMessage(error.body) : null) ??
      (error && typeof error === 'object' && 'response' in error
        ? extractFalProviderMessage((error as { response?: unknown }).response)
        : null) ??
      extractFalProviderMessage(error) ??
      (error instanceof Error ? error.message : null);
    const providerMessage = condenseFalErrorMessage(providerMessageRaw);
    const effectiveProviderMessage =
      providerMessage && providerMessage.toLowerCase() === 'fal request failed' ? null : providerMessage;
    const isTimeoutError = error instanceof FalTimeoutError;
    const isQuotaError =
      status === 429 ||
      (typeof providerMessage === 'string' && providerMessage.toLowerCase().includes('quota'));
    const fallbackMessage = isTimeoutError
      ? 'Generation timed out'
      : isQuotaError
        ? 'Provider is rate limiting'
        : 'Fal request failed';
    const rawErrorCode =
      typeof (error as { code?: string } | undefined)?.code === 'string'
        ? (error as { code?: string }).code
        : null;
    const translation = translateError({
      code: isTimeoutError ? 'PROVIDER_BUSY' : isQuotaError ? 'RATE_LIMITED' : rawErrorCode,
      status,
      message: effectiveProviderMessage ?? providerMessage ?? fallbackMessage,
      providerMessage: effectiveProviderMessage ?? providerMessage ?? null,
    });
    const failureMessage = translation.message;
    const errorCode = translation.code;
    const providerJobId =
      error instanceof FalGenerationError && error.providerJobId
        ? error.providerJobId
        : typeof (error as { providerJobId?: string } | undefined)?.providerJobId === 'string'
          ? (error as { providerJobId?: string }).providerJobId!
          : batchId ?? null;
    const paymentStatusOverride =
      pendingReceipt && paymentMode === 'wallet'
        ? 'refunded_wallet'
        : pendingReceipt && paymentMode !== 'wallet'
          ? 'refunded'
          : null;
    const baseRefundDescription = `Refund ${engine.label} - ${durationSec}s`;
    const refundNote = effectiveProviderMessage ? `Fal error: ${effectiveProviderMessage}` : null;
    const refundDescription = refundNote ? `${baseRefundDescription} - ${refundNote}` : baseRefundDescription;

    if (error instanceof FalGenerationError) {
      (error as { code?: string }).code = errorCode;
      (error as { userMessage?: string }).userMessage = failureMessage;
    }

    console.error(
      '[api/generate] Fal generation failed',
      {
        jobId,
        engineId: engine.id,
        status,
        providerJobId,
        providerMessage: effectiveProviderMessage ?? providerMessage ?? null,
        detail: detail ?? null,
      },
      error
    );

    try {
      await query(
        `UPDATE app_jobs
         SET status = 'failed',
             progress = 0,
             message = $2,
             provisional = FALSE,
             provider_job_id = COALESCE($3, provider_job_id),
             payment_status = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE payment_status END,
             updated_at = NOW()
         WHERE job_id = $1`,
        [jobId, failureMessage, providerJobId, paymentStatusOverride]
      );
    } catch (updateError) {
      console.error('[api/generate] failed to update provisional job after Fal error', updateError);
    }

    if (pendingReceipt) {
      if (walletChargeReserved) {
        await recordRefundReceipt(pendingReceipt, refundDescription, null);
      } else {
        const refundId = await issueStripeRefund(pendingReceipt);
        await recordRefundReceipt(pendingReceipt, refundDescription, refundId);
      }
    }

    if (status === 422) {
      console.error('[generate] fal returned 422', providerMessage ?? '<no-provider-message>');
      const constraintTranslation = translateError({
        code: (detail && typeof detail === 'object' && 'code' in (detail as Record<string, unknown>))
          ? String((detail as Record<string, unknown>).code)
          : 'ENGINE_CONSTRAINT',
        status,
        message: effectiveProviderMessage ?? providerMessage ?? null,
        providerMessage: effectiveProviderMessage ?? providerMessage ?? null,
      });
      const userMessage = isLumaRay2
        ? LUMA_RAY2_ERROR_UNSUPPORTED
        : constraintTranslation.message ?? 'Valeur non supportee pour ce moteur.';
      return NextResponse.json(
        {
          ok: false,
          error: constraintTranslation.code ?? 'FAL_UNPROCESSABLE_ENTITY',
          message: userMessage,
          providerMessage: effectiveProviderMessage ?? providerMessage ?? null,
          detail: detail ?? providerMessage,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: errorCode,
        message: failureMessage,
        providerMessage: effectiveProviderMessage ?? providerMessage ?? null,
        detail,
      },
      { status: isTimeoutError ? 504 : isQuotaError ? 429 : status ?? 500 }
    );
  }

  if (!generationResult) {
    throw new Error('Fal generation did not return a result.');
  }

  let thumb =
    normalizeMediaUrl(generationResult.thumbUrl) ??
      (typeof generationResult.thumbUrl === 'string' && generationResult.thumbUrl.trim().length
        ? generationResult.thumbUrl
        : null) ??
    placeholderThumb;
  let previewFrame = thumb;
  const video = normalizeMediaUrl(generationResult.videoUrl) ?? generationResult.videoUrl ?? null;
  const videoAsset = generationResult.video ?? null;
  const providerMode = generationResult.provider;
  const status = generationResult.status ?? (video ? 'completed' : 'queued');
  const progress = typeof generationResult.progress === 'number' ? generationResult.progress : video ? 100 : 0;
  const providerJobId = generationResult.providerJobId ?? batchId ?? null;
  if (isLumaRay2) {
    console.info('[fal] lumaRay2 generation', {
      jobId,
      providerJobId,
      status,
      videoUrl: video,
    });
  }

  const sourceVideoUrl =
    (typeof generationResult.video?.url === 'string' && generationResult.video.url.length
      ? generationResult.video.url
      : typeof generationResult.videoUrl === 'string' && generationResult.videoUrl.length
        ? generationResult.videoUrl
        : null) ?? null;
  const isSourceAbsolute = Boolean(sourceVideoUrl && /^https?:\/\//i.test(sourceVideoUrl));
  if (sourceVideoUrl && isSourceAbsolute && isPlaceholderThumbnail(thumb)) {
    const generatedThumb = await ensureJobThumbnail({
      jobId,
      userId,
      videoUrl: sourceVideoUrl,
      aspectRatio: aspectRatio ?? undefined,
      existingThumbUrl: thumb,
    });
    if (generatedThumb) {
      thumb = generatedThumb;
      previewFrame = generatedThumb;
      if (videoAsset) {
        videoAsset.thumbnailUrl = generatedThumb;
      }
    }
  }

  try {
    await query(
      `UPDATE app_jobs
       SET thumb_url = $2,
           aspect_ratio = $3,
           preview_frame = $4,
           eta_seconds = $5,
           eta_label = $6,
           video_url = $7,
           status = $8,
           progress = $9,
           provider_job_id = COALESCE($10, provider_job_id),
           final_price_cents = $11,
           pricing_snapshot = $12::jsonb,
           cost_breakdown_usd = $13::jsonb,
           currency = $14,
           vendor_account_id = $15,
           payment_status = $16,
           stripe_payment_intent_id = $17,
           stripe_charge_id = $18,
           visibility = $19,
           indexable = $20,
           message = $21,
           provisional = FALSE,
           updated_at = NOW()
       WHERE job_id = $1`,
      [
        jobId,
        thumb,
        aspectRatio,
        previewFrame,
        etaSeconds,
        etaLabel,
        video,
        status,
        progress,
        providerJobId,
        pricing.totalCents,
        pricingSnapshotJson,
        costBreakdownJson,
        pricing.currency,
        vendorAccountId,
        paymentStatus,
        stripePaymentIntentId,
        stripeChargeId,
        visibility,
        indexable,
        message,
      ]
    );
  } catch (error) {
    console.error('[api/generate] failed to update job record', error);
    if (walletChargeReserved && pendingReceipt) {
      try {
        await query(
          `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, job_id, pricing_snapshot, application_fee_cents, vendor_account_id, stripe_payment_intent_id, stripe_charge_id, platform_revenue_cents, destination_acct)
           VALUES ($1,'refund',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12)`,
          [
            pendingReceipt.userId,
            pendingReceipt.amountCents,
            pendingReceipt.currency,
            `Refund ${engine.label} - ${durationSec}s`,
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
    return NextResponse.json({ ok: false, error: 'Failed to update job record' }, { status: 500 });
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
            durationLabel,
            aspectRatio,
            resolution: effectiveResolution,
            loop: isLumaRay2 ? loop : undefined,
          },
          pricing: {
            totalCents: pricing.totalCents,
            currency: pricing.currency,
            cost_breakdown_usd: costBreakdownUsd,
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
          `Refund ${engine.label} - ${durationSec}s`,
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
