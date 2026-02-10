export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { randomUUID } from 'crypto';
import { generateVideo, FalGenerationError } from '@/lib/fal';
import { computePricingSnapshot, getPlatformFeeCents } from '@/lib/pricing';
import { getConfiguredEngine } from '@/server/engines';
import Stripe from 'stripe';
import { ENV, isConnectPayments, receiptsPriceOnlyEnabled } from '@/lib/env';
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
import { translateError, type ErrorTranslationInput } from '@/lib/error-messages';
import {
  getLumaRay2DurationInfo,
  getLumaRay2ResolutionInfo,
  isLumaRay2AspectRatio,
  normaliseLumaRay2Loop,
  toLumaRay2DurationLabel,
  LUMA_RAY2_ERROR_UNSUPPORTED,
  type LumaRay2DurationLabel,
} from '@/lib/luma-ray2';
import { ensureUserPreferredCurrency, getUserPreferredCurrency, resolveCurrency } from '@/lib/currency';
import type { Currency } from '@/lib/currency';
import { convertCents } from '@/lib/exchange';
import { applyEngineVariantPricing, buildEngineAddonInput } from '@/lib/pricing-addons';
import { recordGenerateMetric } from '@/server/generate-metrics';
import { createSupabaseRouteClient } from '@/lib/supabase-ssr';

const DISPLAY_CURRENCY = 'USD';
const DISPLAY_CURRENCY_LOWER = 'usd';

type PaymentMode = 'wallet' | 'direct' | 'platform';
type VideoMode = Extract<Mode, 't2v' | 'i2v' | 'i2i'>;

const LUMA_RAY2_TIMEOUT_MS = 180_000;
const FAL_RETRY_DELAYS_MS = [5_000, 15_000, 30_000];
const FAL_HARD_TIMEOUT_MS = 400_000;
const FAL_PROGRESS_FLOOR = 10;

const TRANSIENT_FAL_STATUS_CODES = new Set([404, 408, 409, 410, 412, 425, 500, 502, 503, 504, 522, 524, 598]);
const CONSTRAINT_ERROR_CODES = new Set([
  'engine_constraint',
  'invalid_input',
  'input_invalid',
  'validation_error',
  'unsupported',
  'payload_invalid',
  'flagged_content',
  'content_flagged',
  'policy_violation',
  'policy_denied',
  'safety_violation',
  'safety',
]);

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

function isVideoMode(value: unknown): value is VideoMode {
  return value === 't2v' || value === 'i2v';
}

async function resolveUserId(): Promise<string | null> {
  try {
    const supabase = createSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      return user.id;
    }
  } catch {
    // swallow helper errors
  }
  return null;
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

function buildReceiptSnapshot(pricing: PricingSnapshot): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {
    totalCents: pricing.totalCents,
    currency: pricing.currency,
  };

  const discountCandidate = (pricing as unknown as { discount?: { amountCents?: number; percentApplied?: number; label?: string } }).discount;
  if (discountCandidate && typeof discountCandidate.amountCents === 'number' && discountCandidate.amountCents > 0) {
    snapshot.discount = {
      amountCents: discountCandidate.amountCents,
      percentApplied: discountCandidate.percentApplied ?? null,
      label: discountCandidate.label ?? null,
    };
  }

  const taxesCandidate = (pricing as unknown as { taxes?: Array<{ amountCents?: number; label?: string }> }).taxes;
  if (Array.isArray(taxesCandidate)) {
    const taxes = taxesCandidate
      .filter((tax) => tax && typeof tax.amountCents === 'number' && tax.amountCents > 0)
      .map((tax) => ({
        amountCents: tax.amountCents!,
        label: tax.label ?? null,
      }));
    if (taxes.length) {
      snapshot.taxes = taxes;
    }
  }

  return snapshot;
}

function condenseFalErrorMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  const condensed = message.replace(/\s+/g, ' ').trim();
  if (!condensed.length) return null;
  return condensed.length > 400 ? `${condensed.slice(0, 400)}...` : condensed;
}

function isConstraintDetail(detail: unknown): boolean {
  if (!detail) return false;
  if (typeof detail === 'string') {
    const normalized = detail.trim().toLowerCase();
    if (!normalized.length) return false;
    return /support|only|must|should|allowed|invalid|exceed|limit|policy|prohibit|safety|flagged|duration/.test(normalized);
  }
  if (Array.isArray(detail)) {
    return (detail as unknown[]).some((entry) => isConstraintDetail(entry));
  }
  if (typeof detail !== 'object') return false;
  const record = detail as Record<string, unknown>;
  const codes: Array<unknown> = [
    record.code,
    record.error_code,
    record.errorCode,
    record.status_code,
    record.statusCode,
  ];
  for (const candidate of codes) {
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.trim().toLowerCase();
    if (CONSTRAINT_ERROR_CODES.has(normalized)) {
      return true;
    }
  }
  if (Array.isArray(record.errors) && record.errors.length) return true;
  if ('field' in record || 'allowed' in record || 'allowed_values' in record) return true;
  return false;
}

function isSafetyMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('content could not be processed') ||
    normalized.includes('flagged by a content checker') ||
    normalized.includes('policy violation') ||
    normalized.includes('safety system') ||
    normalized.includes('not allowed') ||
    normalized.includes('violates') ||
    normalized.includes('prohibited')
  );
}

function isConstraintMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  if (!normalized.length) return false;
  return (
    normalized.includes('not supported') ||
    normalized.includes('unsupported') ||
    normalized.includes('only supported') ||
    normalized.includes('only support') ||
    normalized.includes('must be') ||
    normalized.includes('should be') ||
    normalized.includes('must provide') ||
    normalized.includes('allowed values') ||
    normalized.includes('invalid value') ||
    normalized.includes('duration') ||
    normalized.includes('exceeds')
  );
}

type FalErrorMetadata = {
  error: unknown;
  status?: number | null;
  detail?: unknown;
  providerMessage?: string | null;
  providerJobId?: string | null;
  attempt?: number;
  maxAttempts?: number;
};

function shouldDeferFalError(meta: FalErrorMetadata): boolean {
  if (!(meta.error instanceof FalGenerationError)) {
    return false;
  }

  const providerJobId = meta.providerJobId ?? meta.error.providerJobId ?? null;
  if (!providerJobId) return false;

  const status = typeof meta.status === 'number' ? meta.status : meta.error.status;
  if (status === 429 || status === 401 || status === 403) {
    return false;
  }

  const fallbackProviderMessage =
    meta.providerMessage ?? (meta.error instanceof Error ? meta.error.message : null);
  const message = condenseFalErrorMessage(normalizeFalErrorValue(fallbackProviderMessage));
  if (isSafetyMessage(message)) {
    return false;
  }

  if (status === 422) {
    if (isConstraintDetail(meta.detail) || isConstraintMessage(message)) {
      return false;
    }
    if (message && /timeout|timed out|try again|queued|in progress|pending|not ready|still processing|rate limited/i.test(message)) {
      return true;
    }
    return false;
  }

  if (typeof status === 'number' && (TRANSIENT_FAL_STATUS_CODES.has(status) || status === 422 || status === 404)) {
    return true;
  }

  if (message) {
    return /timeout|timed out|try again|queued|in progress|pending|not ready|still processing|rate limited/i.test(
      message
    );
  }

  return false;
}

async function markJobAwaitingFal(params: {
  jobId: string;
  engineId: string;
  providerJobId: string | null;
  message: string | null;
  statusLabel: string;
  attempt: number;
  context?: Record<string, unknown>;
  progressFloor?: number;
}): Promise<void> {
  const progressFloor = params.progressFloor ?? FAL_PROGRESS_FLOOR;
  const message = params.message ? condenseFalErrorMessage(params.message) : null;
  try {
    await query(
      `UPDATE app_jobs
       SET status = 'running',
           progress = GREATEST(progress, $2),
           message = CASE WHEN $3 IS NOT NULL THEN $3::text ELSE message END,
           provider_job_id = COALESCE($4, provider_job_id),
           provisional = FALSE,
           updated_at = NOW()
       WHERE job_id = $1`,
      [params.jobId, progressFloor, message, params.providerJobId]
    );
  } catch (error) {
    console.warn('[api/generate] failed to mark job awaiting Fal', { jobId: params.jobId }, error);
  }

  if (!params.providerJobId) {
    return;
  }

  try {
    await query(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        params.jobId,
        'fal',
        params.providerJobId,
        params.engineId,
        params.statusLabel,
        JSON.stringify({
          attempt: params.attempt,
          at: new Date().toISOString(),
          message,
          context: params.context ?? null,
        }),
      ]
    );
  } catch (error) {
    console.warn('[queue-log] failed to record transient Fal event', error);
  }
}

export async function POST(req: NextRequest) {
  const requestStartedAt = Date.now();
  const metricState: {
    engineId: string | null;
    engineLabel: string | null;
    mode: Mode | null;
    userId: string | null;
    jobId: string | null;
    durationSec: number | null;
    resolution: string | null;
  } = {
    engineId: null,
    engineLabel: null,
    mode: null,
    userId: null,
    jobId: null,
    durationSec: null,
    resolution: null,
  };
  const logMetric = (
    status: 'accepted' | 'rejected' | 'completed' | 'failed',
    options?: { errorCode?: string; meta?: Record<string, unknown>; durationMs?: number; jobId?: string | null }
  ) => {
    if (!metricState.engineId) return;
    const durationMs = options?.durationMs ?? Date.now() - requestStartedAt;
    const meta = {
      durationSec: metricState.durationSec,
      resolution: metricState.resolution,
      ...(options?.meta ?? {}),
    };
    void recordGenerateMetric({
      jobId: options?.jobId ?? metricState.jobId,
      userId: metricState.userId,
      engineId: metricState.engineId,
      engineLabel: metricState.engineLabel ?? undefined,
      mode: metricState.mode ?? undefined,
      status,
      durationMs,
      errorCode: options?.errorCode,
      meta,
    });
  };

  const body = await req
    .json()
    .catch((error) => {
      console.error('[api/generate] invalid JSON', error);
      return null;
    });
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });

  const engine = await getConfiguredEngine(String(body.engineId || ''));
  if (!engine) return NextResponse.json({ ok: false, error: 'Unknown engine' }, { status: 400 });
  metricState.engineId = engine.id;
  metricState.engineLabel = engine.label;

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
  metricState.jobId = jobId;
  const rawMode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : '';
  const mode: Mode = isVideoMode(rawMode)
    ? rawMode
    : engine.modes.includes('t2v')
      ? 't2v'
      : engine.modes[0] ?? 't2v';
  metricState.mode = mode;

  const prompt = String(body.prompt || '');
  const multiPromptRaw = Array.isArray(body.multiPrompt) ? body.multiPrompt : null;
  const multiPrompt = multiPromptRaw
    ? multiPromptRaw
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const record = entry as Record<string, unknown>;
          const promptValue = typeof record.prompt === 'string' ? record.prompt.trim() : '';
          const durationValue =
            typeof record.duration === 'number'
              ? Math.round(record.duration)
              : typeof record.duration === 'string'
                ? Math.round(Number(record.duration.replace(/[^\d.]/g, '')))
                : 0;
          if (!promptValue) return null;
          return { prompt: promptValue, duration: durationValue };
        })
        .filter((entry): entry is { prompt: string; duration: number } => Boolean(entry))
    : null;
  const multiPromptTotalSec = multiPrompt ? multiPrompt.reduce((sum, entry) => sum + (entry.duration || 0), 0) : 0;
  let audioEnabled =
    typeof body.audio === 'boolean'
      ? body.audio
      : typeof body.generate_audio === 'boolean'
        ? body.generate_audio
        : undefined;
  const isLumaRay2 = engine.id === 'lumaRay2';
  const rawDurationOption =
    typeof body.durationOption === 'number' || typeof body.durationOption === 'string' ? body.durationOption : null;
  let durationSec = Number(body.durationSec || 4);
  if (multiPromptTotalSec > 0) {
    durationSec = multiPromptTotalSec;
  }
  const lumaDurationInfo = isLumaRay2 ? getLumaRay2DurationInfo(rawDurationOption ?? durationSec) : null;
  if (isLumaRay2 && !lumaDurationInfo) {
    logMetric('rejected', {
      errorCode: 'LUMA_DURATION_UNSUPPORTED',
      meta: { durationOption: rawDurationOption, durationSec: body.durationSec },
    });
    return NextResponse.json({ ok: false, error: LUMA_RAY2_ERROR_UNSUPPORTED }, { status: 400 });
  }
  if (lumaDurationInfo) {
    durationSec = lumaDurationInfo.seconds;
  }
  const shotTypeRaw = typeof body.shotType === 'string' ? body.shotType.trim().toLowerCase() : '';
  const shotType = shotTypeRaw === 'intelligent' ? 'intelligent' : shotTypeRaw === 'customize' ? 'customize' : null;
  const seedRaw = body.seed;
  const seed =
    typeof seedRaw === 'number' && Number.isFinite(seedRaw)
      ? Math.trunc(seedRaw)
      : typeof seedRaw === 'string' && seedRaw.trim().length
        ? Number.isFinite(Number(seedRaw))
          ? Math.trunc(Number(seedRaw))
          : null
        : null;
  const cameraFixed = typeof body.cameraFixed === 'boolean' ? body.cameraFixed : null;
  const safetyChecker = typeof body.safetyChecker === 'boolean' ? body.safetyChecker : null;
  const voiceIdsRaw = Array.isArray(body.voiceIds)
    ? body.voiceIds
    : typeof body.voiceIds === 'string'
      ? body.voiceIds.split(',')
      : null;
  const voiceIds = voiceIdsRaw
    ? voiceIdsRaw
        .map((value: unknown) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value): value is string => value.length > 0)
    : [];
  const voiceControl = Boolean(body.voiceControl) || voiceIds.length > 0;
  if (voiceControl) {
    audioEnabled = true;
  }
  const elementsRaw = Array.isArray(body.elements) ? body.elements : null;
  const elements = elementsRaw
    ? elementsRaw
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const record = entry as Record<string, unknown>;
          const frontalImageUrl =
            typeof record.frontalImageUrl === 'string' && record.frontalImageUrl.trim().length
              ? record.frontalImageUrl.trim()
              : null;
          const referenceImageUrls = Array.isArray(record.referenceImageUrls)
            ? record.referenceImageUrls
                .map((value: unknown) => (typeof value === 'string' ? value.trim() : ''))
                .filter((value): value is string => value.length > 0)
            : [];
          const videoUrl =
            typeof record.videoUrl === 'string' && record.videoUrl.trim().length ? record.videoUrl.trim() : null;
          if (!frontalImageUrl && referenceImageUrls.length === 0 && !videoUrl) return null;
          return {
            frontalImageUrl: frontalImageUrl ?? undefined,
            referenceImageUrls: referenceImageUrls.length ? referenceImageUrls : undefined,
            videoUrl: videoUrl ?? undefined,
          };
        })
        .filter(
          (entry): entry is { frontalImageUrl?: string; referenceImageUrls?: string[]; videoUrl?: string } => Boolean(entry)
        )
    : null;
  const endImageUrl =
    typeof body.endImageUrl === 'string' && body.endImageUrl.trim().length ? body.endImageUrl.trim() : null;
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
      logMetric('rejected', {
        errorCode: 'LUMA_ASPECT_UNSUPPORTED',
        meta: { aspectRatio },
      });
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
  if (engine.id === 'ltx-2-fast' && durationSec > 10) {
    // Fal requirement: 12–20s clips must run at 1080p/25fps on LTX-2 Fast.
    requestedResolution = '1080p';
    pricingResolution = '1080p';
    effectiveResolution = '1080p';
  }
  metricState.durationSec = durationSec;
  metricState.resolution = effectiveResolution;

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
    const variant = getSoraVariantForEngine(engine.id);
    const fallbackAspect = mode === 'i2v' ? 'auto' : '16:9';
    const soraDefaultResolution =
      engine.resolutions.find((value) => value !== 'auto') ?? engine.resolutions[0] ?? '720p';
    const candidate: Record<string, unknown> = {
      variant,
      mode,
      prompt,
      resolution: requestedResolution === 'auto' && mode === 't2v' ? soraDefaultResolution : requestedResolution,
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
        logMetric('rejected', {
          errorCode: 'IMAGE_URL_REQUIRED',
          meta: { engineId: engine.id, mode },
        });
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
    metricState.durationSec = durationSec;
    metricState.resolution = effectiveResolution;
  }

  const payment: { mode?: PaymentMode; paymentIntentId?: string | null } =
    typeof body.payment === 'object' && body.payment
      ? { mode: body.payment.mode, paymentIntentId: body.payment.paymentIntentId }
      : {};
  const explicitUserId = typeof body.userId === 'string' && body.userId.trim().length ? body.userId.trim() : null;
  const authenticatedUserId = await resolveUserId();
  const userId = explicitUserId ?? authenticatedUserId ?? null;
  if (userId) {
    metricState.userId = userId;
  }
  const localKey = typeof body.localKey === 'string' && body.localKey.trim().length ? body.localKey.trim() : null;
  if (localKey && userId) {
    const existingJobs = await query<{
      job_id: string;
      status: string | null;
      video_url: string | null;
      thumb_url: string | null;
      provider_job_id: string | null;
      progress: number | null;
      message: string | null;
      batch_id: string | null;
      group_id: string | null;
      iteration_index: number | null;
      iteration_count: number | null;
      render_ids: unknown;
      hero_render_id: string | null;
    }>(
      `
        SELECT job_id, status, video_url, thumb_url, provider_job_id, progress, message,
               batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id
          FROM app_jobs
         WHERE user_id = $1
           AND local_key = $2
           AND created_at > NOW() - INTERVAL '30 minutes'
         ORDER BY created_at DESC
         LIMIT 1
      `,
      [userId, localKey]
    );
    const existing = existingJobs[0];
    if (existing) {
      return NextResponse.json({
        ok: true,
        jobId: existing.job_id,
        status: existing.status ?? 'pending',
        videoUrl: existing.video_url,
        thumbUrl: existing.thumb_url,
        providerJobId: existing.provider_job_id,
        progress: existing.progress ?? 0,
        message: existing.message,
        batchId: existing.batch_id,
        groupId: existing.group_id,
        iterationIndex: existing.iteration_index,
        iterationCount: existing.iteration_count,
        renderIds: existing.render_ids,
        heroRenderId: existing.hero_render_id,
        localKey,
      });
    }
  }
  const paymentMode: PaymentMode = payment.mode ?? (userId ? 'wallet' : 'platform');
  const connectMode = isConnectPayments();

  let preferredCurrency: Currency | null = null;
  if (userId) {
    preferredCurrency = await getUserPreferredCurrency(String(userId));
  }
  const currencyResolution = resolveCurrency(req, preferredCurrency ? { preferred_currency: preferredCurrency } : undefined);
  const resolvedCurrencyLower = currencyResolution.currency;
  const resolvedCurrencyUpper = resolvedCurrencyLower.toUpperCase();

  const pricingEngine = applyEngineVariantPricing(engine, mode);
  const pricingAddons = buildEngineAddonInput(pricingEngine, {
    audioEnabled,
    voiceControl,
  });
  const pricing = await computePricingSnapshot({
    engine: pricingEngine,
    durationSec,
    resolution: pricingResolution,
    membershipTier: body.membershipTier,
    loop: isLumaRay2 ? loop : undefined,
    durationOption: lumaDurationInfo?.label ?? rawDurationOption ?? null,
    currency: 'USD',
    addons: pricingAddons,
  });
  const { cents: settlementAmountCents, rate: settlementFxRate, source: settlementFxSource } = await convertCents(
    pricing.totalCents,
    DISPLAY_CURRENCY_LOWER,
    resolvedCurrencyLower
  );
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
    currency_source: currencyResolution.source,
    currency_country: currencyResolution.country ?? null,
    display_currency: DISPLAY_CURRENCY,
    settlement_currency: resolvedCurrencyUpper,
    settlement_amount_cents: settlementAmountCents,
    settlement_fx_rate: settlementFxRate,
    settlement_fx_source: settlementFxSource,
  };
  const priceOnlyReceipts = receiptsPriceOnlyEnabled();
  const costBreakdownUsd = (pricing.meta?.cost_breakdown_usd as Record<string, unknown> | undefined) ?? null;
  const receiptSnapshot = priceOnlyReceipts ? buildReceiptSnapshot(pricing) : pricing;
  const pricingSnapshotJson = JSON.stringify(receiptSnapshot);
  const costBreakdownJson = !priceOnlyReceipts && costBreakdownUsd ? JSON.stringify(costBreakdownUsd) : null;

  const vendorAccountId = connectMode ? pricing.vendorAccountId ?? engine.vendorAccountId ?? null : null;
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
  snapshot: unknown;
  applicationFeeCents: number | null;
  vendorAccountId: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
};

async function recordRefundReceipt(
  receipt: PendingReceipt,
  description: string,
  stripeRefundId: string | null
): Promise<void> {
  const priceOnly = receiptsPriceOnlyEnabled();
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
       )
       ON CONFLICT DO NOTHING`,
      [
        receipt.userId,
        receipt.amountCents,
        receipt.currency,
        description,
        receipt.jobId,
        JSON.stringify(receipt.snapshot),
        priceOnly ? null : 0,
        priceOnly ? null : receipt.vendorAccountId,
        receipt.stripePaymentIntentId ?? null,
        receipt.stripeChargeId ?? null,
        stripeRefundId ?? null,
        priceOnly ? null : 0,
        priceOnly ? null : receipt.vendorAccountId,
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

async function rollbackPendingPayment(params: {
  pendingReceipt: PendingReceipt | null;
  walletChargeReserved: boolean;
  refundDescription: string;
}): Promise<void> {
  const { pendingReceipt, walletChargeReserved, refundDescription } = params;
  if (!pendingReceipt) return;
  try {
    if (walletChargeReserved) {
      await recordRefundReceipt(pendingReceipt, refundDescription, null);
      return;
    }
    const refundId = await issueStripeRefund(pendingReceipt);
    await recordRefundReceipt(pendingReceipt, refundDescription, refundId);
  } catch (error) {
    console.warn('[payments] failed to rollback pending payment', error);
  }
}

  let pendingReceipt: PendingReceipt | null = null;
  let paymentStatus: string = 'platform';
  let stripePaymentIntentId: string | null = null;
  let stripeChargeId: string | null = null;
  let walletChargeReserved = false;

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
  const firstFrameUrl =
    processedAttachments.find((attachment) => attachment.slotId === 'first_frame_url')?.url?.trim() ?? undefined;
  const lastFrameUrl =
    processedAttachments.find((attachment) => attachment.slotId === 'last_frame_url')?.url?.trim() ?? undefined;
  const videoUrls = processedAttachments
    .filter((attachment) => attachment.kind === 'video' && typeof attachment.url === 'string')
    .map((attachment) => attachment.url!.trim())
    .filter((url, index, self) => url.length > 0 && self.indexOf(url) === index);
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
  if (typeof audioEnabled === 'boolean') {
    validationPayload.generate_audio = audioEnabled;
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

  if (firstFrameUrl) {
    validationPayload.first_frame_url = firstFrameUrl;
  }
  if (lastFrameUrl) {
    validationPayload.last_frame_url = lastFrameUrl;
  }
  if (videoUrls.length) {
    validationPayload.video_urls = videoUrls;
  }

  const needsImage = mode === 'i2v' || mode === 'i2i';
  const needsVideo = mode === 'r2v';
  if (isLumaRay2 && mode === 'i2v') {
    if (!initialImageUrl) {
      logMetric('rejected', {
        errorCode: 'IMAGE_URL_REQUIRED',
        meta: { engineId: engine.id, mode },
      });
      return NextResponse.json({ ok: false, error: 'Image URL is required for Luma Ray 2 image-to-video' }, { status: 400 });
    }
    validationPayload.image_url = initialImageUrl;
  } else if (needsImage) {
    if (!initialImageUrl && !firstFrameUrl && !lastFrameUrl) {
      logMetric('rejected', {
        errorCode: 'IMAGE_URL_REQUIRED',
        meta: { engineId: engine.id, mode },
      });
      return NextResponse.json({ ok: false, error: 'Image URL is required for this engine mode' }, { status: 400 });
    }
    if (initialImageUrl) {
      validationPayload.image_url = initialImageUrl;
    }
  } else if (needsVideo) {
    if (!videoUrls.length) {
      logMetric('rejected', {
        errorCode: 'VIDEO_URL_REQUIRED',
        meta: { engineId: engine.id, mode },
      });
      return NextResponse.json({ ok: false, error: 'Video URLs are required for this engine mode' }, { status: 400 });
    }
  }

  const validationResult = validateRequest(engine.id, mode, validationPayload);
  if (!validationResult.ok) {
    logMetric('rejected', {
      errorCode: validationResult.error.code ?? 'ENGINE_CONSTRAINT',
      meta: {
        field: validationResult.error.field,
        allowed: validationResult.error.allowed,
        value: validationResult.error.value,
      },
    });
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

  if (paymentMode === 'wallet') {
    const walletUserId = userId ? String(userId) : null;
    if (!walletUserId) {
      logMetric('rejected', {
        errorCode: 'WALLET_AUTH_REQUIRED',
        meta: { paymentMode },
      });
      return NextResponse.json({ ok: false, error: 'Wallet payment requires authentication' }, { status: 401 });
    }

    const reserveResult = await reserveWalletCharge({
      userId: walletUserId,
      amountCents: pricing.totalCents,
      currency: DISPLAY_CURRENCY,
      description: `Run ${engine.label} - ${durationSec}s`,
      jobId,
      pricingSnapshotJson,
      applicationFeeCents: priceOnlyReceipts ? null : applicationFeeCents,
      vendorAccountId,
      stripePaymentIntentId: null,
      stripeChargeId: null,
    });

    if (!reserveResult.ok) {
      if (reserveResult.errorCode === 'currency_mismatch') {
        const lockedCurrency = (reserveResult.preferredCurrency ?? resolvedCurrencyLower).toUpperCase();
        console.warn('[wallet] currency mismatch during reserve', {
          userId: walletUserId,
          expected: lockedCurrency,
          requested: resolvedCurrencyUpper,
        });
        logMetric('rejected', {
          errorCode: 'WALLET_CURRENCY_MISMATCH',
          meta: { lockedCurrency },
        });
        return NextResponse.json(
          {
            ok: false,
            error: `Wallet currency locked to ${lockedCurrency}. Contact support to request a change.`,
          },
          { status: 409 }
        );
      }
      const balanceCents = reserveResult.balanceCents;
      logMetric('rejected', {
        errorCode: 'INSUFFICIENT_WALLET_FUNDS',
        meta: { balanceCents },
      });
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

    if (!preferredCurrency) {
      await ensureUserPreferredCurrency(walletUserId, resolvedCurrencyLower);
      preferredCurrency = resolvedCurrencyLower;
    }

    pendingReceipt = {
      userId: walletUserId,
      amountCents: pricing.totalCents,
      currency: DISPLAY_CURRENCY,
      description: `Run ${engine.label} - ${durationSec}s`,
      jobId,
      snapshot: receiptSnapshot,
      applicationFeeCents: priceOnlyReceipts ? null : applicationFeeCents,
      vendorAccountId,
    };
    paymentStatus = 'paid_wallet';
  } else if (paymentMode === 'direct') {
    if (!ENV.STRIPE_SECRET_KEY) {
      logMetric('rejected', { errorCode: 'STRIPE_NOT_CONFIGURED', meta: { paymentMode } });
      return NextResponse.json({ ok: false, error: 'Stripe not configured' }, { status: 501 });
    }
    if (!userId) {
      logMetric('rejected', { errorCode: 'DIRECT_AUTH_REQUIRED', meta: { paymentMode } });
      return NextResponse.json({ ok: false, error: 'Direct payment requires authentication' }, { status: 401 });
    }
    if (!payment.paymentIntentId) {
      logMetric('rejected', { errorCode: 'PAYMENT_INTENT_MISSING', meta: { paymentMode } });
      return NextResponse.json({ ok: false, error: 'PaymentIntent required for direct mode' }, { status: 400 });
    }
    if (connectMode && !vendorAccountId) {
      logMetric('rejected', { errorCode: 'VENDOR_ACCOUNT_MISSING', meta: { paymentMode } });
      return NextResponse.json({ ok: false, error: 'Vendor account missing for this engine' }, { status: 400 });
    }

    const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const intent = await stripe.paymentIntents.retrieve(payment.paymentIntentId, { expand: ['latest_charge'] });

    const receivedSettlementCents = intent.amount_received ?? intent.amount ?? 0;
    const metadataSettlementCents = intent.metadata?.settlement_amount_cents
      ? Number(intent.metadata.settlement_amount_cents)
      : null;
    const expectedSettlementCents = metadataSettlementCents && metadataSettlementCents > 0
      ? metadataSettlementCents
      : (await convertCents(pricing.totalCents, DISPLAY_CURRENCY_LOWER, resolvedCurrencyLower)).cents;
    if (intent.status !== 'succeeded' || receivedSettlementCents < expectedSettlementCents) {
      logMetric('rejected', {
        errorCode: 'PAYMENT_NOT_CAPTURED',
        meta: { paymentIntentId: intent.id },
      });
      return NextResponse.json({ ok: false, error: 'Payment not captured yet' }, { status: 402 });
    }
    const intentCurrency = intent.currency?.toUpperCase() ?? resolvedCurrencyUpper;
    if (intentCurrency !== resolvedCurrencyUpper) {
      console.warn('[payments] payment intent currency mismatch', {
        expected: resolvedCurrencyUpper,
        received: intentCurrency,
        userId,
        paymentIntentId: intent.id,
      });
      logMetric('rejected', {
        errorCode: 'PAYMENT_CURRENCY_MISMATCH',
        meta: { expected: resolvedCurrencyUpper, received: intentCurrency },
      });
      return NextResponse.json(
        {
          ok: false,
          error: `Wallet currency locked to ${resolvedCurrencyUpper}. Contact support to request a change.`,
        },
        { status: 409 }
      );
    }
    if (connectMode && intent.transfer_data?.destination && intent.transfer_data.destination !== vendorAccountId) {
      return NextResponse.json({ ok: false, error: 'Payment vendor mismatch' }, { status: 409 });
    }

    if (!preferredCurrency) {
      await ensureUserPreferredCurrency(String(userId), resolvedCurrencyLower);
      preferredCurrency = resolvedCurrencyLower;
    }

    stripePaymentIntentId = intent.id;
    const latestCharge = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id ?? null;
    stripeChargeId = latestCharge;
    const intentJobId = typeof intent.metadata?.job_id === 'string' ? intent.metadata.job_id : null;
    if (intentJobId && intentJobId !== jobId) {
      return NextResponse.json({ ok: false, error: 'Payment job mismatch' }, { status: 409 });
    }

    const metadataWalletAmountCents = intent.metadata?.wallet_amount_cents
      ? Number(intent.metadata.wallet_amount_cents)
      : pricing.totalCents;

    pendingReceipt = {
      userId: String(userId),
      amountCents: metadataWalletAmountCents,
      currency: DISPLAY_CURRENCY,
      description: `Run ${engine.label} - ${durationSec}s`,
      jobId,
      snapshot: receiptSnapshot,
      applicationFeeCents: priceOnlyReceipts
        ? null
        : connectMode
            ? Number(intent.metadata?.platform_fee_cents_usd ?? applicationFeeCents)
            : null,
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
  const falInputSummary = {
    primaryImageUrl: initialImageUrl ?? null,
    referenceImageCount: Array.isArray(normalizedReferenceImages) ? normalizedReferenceImages.length : 0,
    referenceVideoCount: videoUrls.length,
    hasFirstFrame: Boolean(firstFrameUrl),
    hasLastFrame: Boolean(lastFrameUrl),
    inputSlots:
      falInputs?.map((attachment) => ({
        slotId: attachment.slotId ?? null,
        kind: attachment.kind ?? null,
        hasUrl: Boolean(attachment.url),
      })) ?? [],
  };

  const falDurationOption = lumaDurationInfo?.label ?? rawDurationLabel ?? rawDurationOption ?? null;
  const isLtx2FastLong = engine.id === 'ltx-2-fast' && durationSec > 10;
  let clampedFps =
    typeof body.fps === 'number' && Number.isFinite(body.fps) && body.fps > 0 ? Math.trunc(body.fps) : undefined;
  if (isLtx2FastLong) {
    clampedFps = 25;
  }
  const falPayload: Parameters<typeof generateVideo>[0] = {
    engineId: engine.id,
    prompt: prompt,
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
    multiPrompt: multiPrompt ?? undefined,
    shotType: mode === 'i2v' ? 'customize' : shotType ?? undefined,
    seed: typeof seed === 'number' ? seed : undefined,
    cameraFixed: typeof cameraFixed === 'boolean' ? cameraFixed : undefined,
    safetyChecker: typeof safetyChecker === 'boolean' ? safetyChecker : undefined,
    voiceIds: voiceIds.length ? voiceIds : undefined,
    elements: elements ?? undefined,
    endImageUrl: endImageUrl ?? undefined,
  };
  if (typeof audioEnabled === 'boolean') {
    falPayload.audio = audioEnabled;
  }
  if (typeof clampedFps === 'number') {
    falPayload.fps = clampedFps;
  }
  if (typeof body.cfgScale === 'number' && Number.isFinite(body.cfgScale)) {
    falPayload.cfgScale = body.cfgScale;
  }

  const negativePrompt =
    typeof body.negativePrompt === 'string' && body.negativePrompt.trim().length ? body.negativePrompt.trim() : null;
  const membershipTier =
    typeof body.membershipTier === 'string' && body.membershipTier.trim().length ? body.membershipTier.trim() : null;
  const settingsSnapshotJson = JSON.stringify({
    schemaVersion: 1,
    surface: 'video',
    engineId: engine.id,
    engineLabel: engine.label,
    inputMode: mode,
    prompt,
    negativePrompt,
    core: {
      durationSec,
      durationOption: falDurationOption,
      numFrames: numFrames ?? null,
      aspectRatio,
      resolution: effectiveResolution,
      fps: typeof clampedFps === 'number' ? clampedFps : typeof body.fps === 'number' ? Math.trunc(body.fps) : null,
      iterationCount: iterationCount ?? null,
      audio: typeof audioEnabled === 'boolean' ? audioEnabled : null,
    },
    advanced: {
      cfgScale: typeof body.cfgScale === 'number' && Number.isFinite(body.cfgScale) ? body.cfgScale : null,
      loop: isLumaRay2 ? Boolean(loop) : null,
      shotType: shotType ?? null,
      seed: typeof seed === 'number' ? seed : null,
      cameraFixed: typeof cameraFixed === 'boolean' ? cameraFixed : null,
      safetyChecker: typeof safetyChecker === 'boolean' ? safetyChecker : null,
      voiceIds: voiceIds.length ? voiceIds : null,
      voiceControl: voiceControl ? true : null,
      multiPrompt: multiPrompt ?? null,
    },
    refs: {
      imageUrl: initialImageUrl ?? null,
      referenceImages: normalizedReferenceImages ?? null,
      videoUrls: videoUrls.length ? videoUrls : null,
      firstFrameUrl: firstFrameUrl ?? null,
      lastFrameUrl: lastFrameUrl ?? null,
      endImageUrl: endImageUrl ?? null,
      elements: elements ?? null,
      inputs: falInputs ?? null,
    },
    meta: {
      memberTier: membershipTier,
    },
  });

  let lastProviderJobId: string | null = null;
  const persistProviderJobId = async (requestId: string) => {
    if (!requestId || lastProviderJobId === requestId) return;
    lastProviderJobId = requestId;
    try {
      await query(
        `UPDATE app_jobs
         SET provider_job_id = $2, updated_at = NOW()
         WHERE job_id = $1
           AND (provider_job_id IS NULL OR provider_job_id <> $2)`,
        [jobId, requestId]
      );
    } catch (error) {
      console.warn('[api/generate] failed to persist provider_job_id', { jobId, requestId }, error);
    }
    try {
      await query(
        `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [
          jobId,
          'fal',
          requestId,
          engine.id,
          'enqueue',
          JSON.stringify({
            at: new Date().toISOString(),
            engineId: engine.id,
            promptLength: prompt.length,
            inputSummary: falInputSummary,
          }),
        ]
      );
    } catch (error) {
      console.warn('[queue-log] failed to record enqueue event', { jobId, requestId }, error);
    }
  };

  let jobInserted = false;
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
         settings_snapshot,
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
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27::jsonb,$28::jsonb,$29::jsonb,$30,$31,$32,$33,$34,$35,$36,$37
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
        settingsSnapshotJson,
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
    jobInserted = true;
    logMetric('accepted', {
      jobId,
      durationMs: Date.now() - requestStartedAt,
      meta: { paymentMode, inputSummary: falInputSummary },
    });
  } catch (error) {
    console.error('[api/generate] failed to persist provisional job record', error);
    logMetric('failed', {
      errorCode: 'JOB_PERSIST_FAILED',
      meta: { stage: 'persist_provisional' },
    });
    if (pendingReceipt && !jobInserted) {
      await rollbackPendingPayment({
        pendingReceipt,
        walletChargeReserved,
        refundDescription: `Refund ${engine.label} - ${durationSec}s`,
      });
    }
    return NextResponse.json({ ok: false, error: 'Failed to persist job record' }, { status: 500 });
  }

  try {
    const promise = generateVideo(
      { ...falPayload },
      {
        onRequestId: (requestId) => {
          console.info('[fal] request id received', { jobId, engineId: engine.id, requestId });
          persistProviderJobId(requestId);
        },
        onQueueUpdate: (status) => {
          if (!status) return;
          const requestId =
            (status as { request_id?: string }).request_id ?? lastProviderJobId ?? null;
          if (requestId) {
            lastProviderJobId = requestId;
          }
        },
      }
    );
    generationResult = await withFalTimeout(
      promise,
      isLumaRay2 ? LUMA_RAY2_TIMEOUT_MS : FAL_HARD_TIMEOUT_MS
    );
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
    const providerJobId: string | null =
      error instanceof FalGenerationError && error.providerJobId
        ? error.providerJobId
        : typeof (error as { providerJobId?: string } | undefined)?.providerJobId === 'string'
          ? (error as { providerJobId?: string }).providerJobId!
          : lastProviderJobId ?? batchId ?? null;
  const paymentStatusOverride =
      pendingReceipt && paymentMode === 'wallet'
        ? 'refunded_wallet'
        : pendingReceipt && paymentMode !== 'wallet'
          ? 'refunded'
          : null;
    const baseRefundDescription = `Refund ${engine.label} - ${durationSec}s`;
    const refundNote = failureMessage ?? null;
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

    const deferable =
      !isQuotaError &&
      shouldDeferFalError({
        error,
        status,
        detail,
        providerMessage: effectiveProviderMessage ?? providerMessage ?? fallbackMessage,
        providerJobId,
      });

    if (isTimeoutError) {
      const progressFloor = Math.min(95, FAL_PROGRESS_FLOOR + FAL_RETRY_DELAYS_MS.length * 5);
      const waitingMessage =
        effectiveProviderMessage && effectiveProviderMessage !== fallbackMessage
          ? `Still processing: ${effectiveProviderMessage}. Your request is in progress; we will update you shortly.`
          : 'Rendering in progress; awaiting provider after timeout. We will refresh as soon as the next status arrives.';

      if (providerJobId) {
        await markJobAwaitingFal({
          jobId,
          engineId: engine.id,
          providerJobId,
          message: waitingMessage,
          statusLabel: 'deferred',
          attempt: FAL_RETRY_DELAYS_MS.length + 1,
          context: {
            status,
            deferred: true,
            timeout: true,
          },
          progressFloor,
        });
      } else {
        await query(
          `UPDATE app_jobs
             SET status = 'running',
                 progress = $2,
                 message = $3,
                 provisional = FALSE,
                 updated_at = NOW()
           WHERE job_id = $1`,
          [jobId, progressFloor, waitingMessage]
        ).catch((updateError) => {
          console.error('[api/generate] failed to mark timeout job awaiting provider', updateError);
        });
      }

      return NextResponse.json(
        {
          ok: true,
          jobId,
          status: 'running',
          progress: progressFloor,
          providerJobId,
          deferred: true,
          message: waitingMessage,
        },
        { status: 202 }
      );
    }

    if (deferable && providerJobId) {
      const progressFloor = Math.min(95, FAL_PROGRESS_FLOOR + FAL_RETRY_DELAYS_MS.length * 5);
      const waitingMessage =
        effectiveProviderMessage && effectiveProviderMessage !== fallbackMessage
          ? `Still processing: ${effectiveProviderMessage}. Your request is in progress; we will update you shortly.`
          : 'Rendering in progress; next update imminent. No action needed while we wait for the next status update.';

      await markJobAwaitingFal({
        jobId,
        engineId: engine.id,
        providerJobId,
        message: waitingMessage,
        statusLabel: 'deferred',
        attempt: FAL_RETRY_DELAYS_MS.length + 1,
        context: {
          status,
          deferred: true,
        },
        progressFloor,
      });

      return NextResponse.json(
        {
          ok: true,
          jobId,
          status: 'running',
          progress: progressFloor,
          providerJobId,
          deferred: true,
          message: waitingMessage,
        },
        { status: 202 }
      );
    }

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

    if (pendingReceipt && !isTimeoutError) {
      if (walletChargeReserved) {
        await recordRefundReceipt(pendingReceipt, refundDescription, null);
      } else {
        const refundId = await issueStripeRefund(pendingReceipt);
        await recordRefundReceipt(pendingReceipt, refundDescription, refundId);
      }
    }

    if (status === 422) {
      console.error('[generate] fal returned 422', providerMessage ?? '<no-provider-message>');

      let translatedErrorCode: string | null = null;
      let translatedMessage: string | null = null;
      let translatedProviderMessage: string | null = null;

      const resolveTranslation = (input: ErrorTranslationInput) => {
        const translation = translateError(input);
        translatedErrorCode = translation.code;
        translatedMessage = translation.message;
        translatedProviderMessage = translation.providerMessage ?? translation.originalMessage ?? null;
      };

      if (detail && Array.isArray(detail) && detail.length) {
        const firstDetail = detail[0] as Record<string, unknown>;
        const detailCode = typeof firstDetail.type === 'string' ? firstDetail.type : undefined;
        const detailMessage = typeof firstDetail.msg === 'string' ? firstDetail.msg : undefined;
        resolveTranslation({
          code: detailCode ?? 'FAL_UNPROCESSABLE_ENTITY',
          status,
          message: detailMessage ?? effectiveProviderMessage ?? providerMessage ?? null,
          providerMessage: detailMessage ?? effectiveProviderMessage ?? providerMessage ?? null,
        });
      } else if (detail && typeof detail === 'object' && detail !== null) {
        const detailRecord = detail as Record<string, unknown>;
        const detailCode = typeof detailRecord.code === 'string' ? detailRecord.code : undefined;
        const detailMessage = typeof detailRecord.message === 'string' ? detailRecord.message : undefined;
        resolveTranslation({
          code: detailCode ?? 'FAL_UNPROCESSABLE_ENTITY',
          status,
          message: detailMessage ?? effectiveProviderMessage ?? providerMessage ?? null,
          providerMessage: detailMessage ?? effectiveProviderMessage ?? providerMessage ?? null,
        });
      } else {
        resolveTranslation({
          code: 'FAL_UNPROCESSABLE_ENTITY',
          status,
          message: effectiveProviderMessage ?? providerMessage ?? null,
          providerMessage: effectiveProviderMessage ?? providerMessage ?? null,
        });
      }

      const userMessage = isLumaRay2
        ? LUMA_RAY2_ERROR_UNSUPPORTED
        : translatedMessage ?? 'This request cannot be processed for this engine. Please adjust your inputs and try again.';

      logMetric('failed', {
        errorCode: translatedErrorCode ?? 'FAL_UNPROCESSABLE_ENTITY',
        meta: { stage: 'provider_422', providerJobId },
      });
      return NextResponse.json(
        {
          ok: false,
          error: translatedErrorCode ?? 'FAL_UNPROCESSABLE_ENTITY',
          message: userMessage,
          providerMessage: translatedProviderMessage ?? effectiveProviderMessage ?? providerMessage ?? null,
          detail: detail ?? providerMessage,
        },
        { status: 422 }
      );
    }

    logMetric('failed', {
      errorCode,
      meta: {
        stage: 'provider_error',
        providerJobId,
        providerStatus: status ?? metadataStatus ?? null,
      },
    });
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

  // Safety net: if Fal didn’t return a provider job id and we have no video result, treat as failed and refund.
  if (!providerJobId && !video) {
    const failureMessage = 'We could not start your render. Please retry.';
    console.error('[api/generate] missing provider_job_id and no result', { jobId, engineId: engine.id, generationResult });
    logMetric('failed', {
      errorCode: 'FAL_NO_PROVIDER_JOB_ID',
      meta: { stage: 'provider_missing_id' },
    });
    try {
      await query(
        `UPDATE app_jobs
         SET status = 'failed',
             progress = 0,
             message = $2,
             provisional = FALSE,
             updated_at = NOW()
         WHERE job_id = $1`,
        [jobId, failureMessage]
      );
    } catch (updateError) {
      console.error('[api/generate] failed to mark job as failed after missing provider_job_id', updateError);
    }

    if (pendingReceipt) {
      const refundDescription = `Refund ${engine.label} - ${durationSec}s - missing provider_job_id`;
      if (walletChargeReserved) {
        await recordRefundReceipt(pendingReceipt, refundDescription, null);
      } else {
        const refundId = await issueStripeRefund(pendingReceipt);
        await recordRefundReceipt(pendingReceipt, refundDescription, refundId);
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'FAL_NO_PROVIDER_JOB_ID',
        message: failureMessage,
      },
      { status: 502 }
    );
  }

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
    if (pendingReceipt) {
      await rollbackPendingPayment({
        pendingReceipt,
        walletChargeReserved,
        refundDescription: `Refund ${engine.label} - ${durationSec}s`,
      });
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
          pendingReceipt.applicationFeeCents ?? null,
          pendingReceipt.vendorAccountId,
          pendingReceipt.stripePaymentIntentId ?? null,
          pendingReceipt.stripeChargeId ?? null,
          pendingReceipt.applicationFeeCents ?? null,
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
          inputSummary: falInputSummary,
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
         VALUES ($1,'refund',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12)
         ON CONFLICT DO NOTHING`,
        [
          pendingReceipt.userId,
          pendingReceipt.amountCents,
          pendingReceipt.currency,
          `Refund ${engine.label} - ${durationSec}s`,
          pendingReceipt.jobId,
          JSON.stringify(pendingReceipt.snapshot),
          priceOnlyReceipts ? null : 0,
          priceOnlyReceipts ? null : pendingReceipt.vendorAccountId,
          pendingReceipt.stripePaymentIntentId ?? null,
          pendingReceipt.stripeChargeId ?? null,
          priceOnlyReceipts ? null : 0,
          priceOnlyReceipts ? null : pendingReceipt.vendorAccountId,
        ]
      );
      await query(`UPDATE app_jobs SET payment_status = 'refunded_wallet' WHERE job_id = $1`, [jobId]);
    } catch (error) {
      console.warn('[wallet] failed to record refund', error);
    }
  }

  const responsePaymentStatus =
    status === 'failed' && pendingReceipt && paymentMode === 'wallet' ? 'refunded_wallet' : paymentStatus;

  logMetric(status === 'failed' ? 'failed' : 'completed', {
    jobId,
    meta: {
      providerJobId,
      provider: providerMode,
      paymentStatus: responsePaymentStatus,
      inputSummary: falInputSummary,
    },
  });

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
