import { query } from '@/lib/db';
import { deriveJobSurface } from '@/lib/job-surface';
import { extractRenderIds, extractRenderThumbUrls, parseStoredImageRenders } from '@/lib/image-renders';
import { isStablePublicMediaUrl, normalizeMediaUrl } from '@/lib/media';
import type { PricingSnapshot } from '@/types/engines';

export type AgentGenerationResult =
  | {
      surface: 'video';
      videoUrl: string;
      previewUrl: string | null;
      thumbnailUrl: string | null;
      audioUrl: string | null;
    }
  | {
      surface: 'image';
      imageUrls: string[];
      thumbnailUrls: string[];
    };

export type AgentGenerationStatus = {
  jobId: string;
  surface: 'video' | 'image';
  status: 'accepted' | 'running' | 'completed' | 'failed';
  progress: number | null;
  message: string | null;
  priceCents: number | null;
  currency: string | null;
  paymentStatus: string | null;
  result: AgentGenerationResult | null;
  retryAfterSeconds: number | null;
};

export type GenerationStatusRecord = {
  id: number;
  job_id: string;
  user_id: string | null;
  status: string | null;
  progress: number | null;
  provider_job_id: string | null;
  provider: string | null;
  surface: string | null;
  billing_product_key: string | null;
  video_url: string | null;
  preview_video_url: string | null;
  audio_url: string | null;
  thumb_url: string | null;
  preview_frame: string | null;
  engine_id: string;
  engine_label: string;
  duration_sec: number;
  prompt: string;
  created_at: string;
  final_price_cents: number | null;
  pricing_snapshot: PricingSnapshot | null;
  settings_snapshot: unknown;
  currency: string | null;
  payment_status: string | null;
  vendor_account_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  batch_id: string | null;
  group_id: string | null;
  iteration_index: number | null;
  iteration_count: number | null;
  render_ids: unknown;
  hero_render_id: string | null;
  local_key: string | null;
  message: string | null;
  eta_seconds: number | null;
  eta_label: string | null;
  aspect_ratio: string | null;
};

export const GENERATION_STATUS_SELECT = `id, job_id, user_id, status, progress, provider_job_id, provider, surface, billing_product_key, video_url, preview_video_url, audio_url, thumb_url, preview_frame, engine_id, engine_label, duration_sec, prompt, created_at, final_price_cents, pricing_snapshot, settings_snapshot, currency, payment_status, vendor_account_id, stripe_payment_intent_id, stripe_charge_id, batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id, local_key, message, eta_seconds, eta_label, aspect_ratio`;

type GenerationStatusQuery = (
  sql: string,
  params?: ReadonlyArray<unknown>
) => Promise<GenerationStatusRecord[]>;

const ACCEPTED_STATUSES = new Set(['accepted', 'created', 'pending', 'queued', 'submitted', 'waiting']);
const RUNNING_STATUSES = new Set(['in_progress', 'processing', 'running']);
const COMPLETED_STATUSES = new Set(['completed', 'finished', 'success', 'succeeded']);
const FAILED_STATUSES = new Set([
  'aborted',
  'cancelled',
  'canceled',
  'error',
  'errored',
  'expired',
  'failed',
  'missing',
  'not_found',
  'timed_out',
  'timeout',
]);
const SAFE_PAYMENT_STATUSES = new Set([
  'included',
  'paid_direct',
  'paid_stripe',
  'paid_wallet',
  'platform',
  'refunded',
  'refunded_wallet',
]);
const IMAGE_SURFACES = new Set([
  'angle',
  'character',
  'image',
  'storyboard',
  'upscale',
]);
const PRIVATE_MEDIA_PATH_PATTERN =
  /^\/(?:api|admin|app|billing|connect|dashboard|generate|jobs|settings)(?:\/|$)/iu;
const PUBLIC_APP_MEDIA_PATH_PATTERN = /^\/(?:generated|media|uploads)(?:\/|$)/iu;
const DEFAULT_PUBLIC_MEDIA_HOSTS = new Set([
  'cdn.maxvideoai.com',
  'media.maxvideoai.com',
  'storage.maxvideoai.com',
]);

const AGENT_FAILURE_COPY = {
  default:
    'MaxVideoAI could not complete this render. Please retry in a few moments. If this keeps happening, contact support with your request ID.',
  busy: 'The render queue is temporarily busy. Please retry in a few moments.',
  noOutput:
    'The render finished without a usable output. Please retry or contact support with your request ID if it happens again.',
  safety: 'This request was blocked by safety checks. Try rephrasing it with safer, more neutral wording.',
  start: 'MaxVideoAI could not start this render. Please retry in a few moments.',
  storage: 'The render finished, but MaxVideoAI could not prepare the output for download. Please retry.',
  timeout: 'This render exceeded the expected processing window. Please retry in a few moments.',
  unsupported: 'This request is not supported with the selected inputs. Adjust the prompt, media, or settings and try again.',
} as const;

function normalizeAgentSurface(record: GenerationStatusRecord): 'video' | 'image' | null {
  const surface = deriveJobSurface({
    surface: record.surface,
    settingsSnapshot: record.settings_snapshot,
    jobId: record.job_id,
    engineId: record.engine_id,
    videoUrl: record.video_url,
    renderIds: record.render_ids,
  });
  if (surface === 'video' || surface === 'background-removal') return 'video';
  return IMAGE_SURFACES.has(surface) ? 'image' : null;
}

function normalizeAgentStatus(rawStatus: string | null): AgentGenerationStatus['status'] {
  const status = rawStatus?.trim().toLowerCase() ?? '';
  if (COMPLETED_STATUSES.has(status)) return 'completed';
  if (FAILED_STATUSES.has(status)) return 'failed';
  if (RUNNING_STATUSES.has(status)) return 'running';
  if (ACCEPTED_STATUSES.has(status)) return 'accepted';
  return 'accepted';
}

function normalizeProgress(value: number | null, status: AgentGenerationStatus['status']): number | null {
  if (status === 'completed') return 100;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeCurrency(value: string | null): string | null {
  const currency = value?.trim().toUpperCase();
  return currency && /^[A-Z]{3}$/u.test(currency) ? currency : null;
}

function normalizePaymentStatus(value: string | null): string | null {
  const status = value?.trim().toLowerCase();
  return status && SAFE_PAYMENT_STATUSES.has(status) ? status : null;
}

function stableMediaUrl(value: string | null | undefined): string | null {
  const normalized = normalizeMediaUrl(value);
  if (!normalized || !isStablePublicMediaUrl(normalized) || !/^https:\/\//iu.test(normalized)) return null;
  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    if (PRIVATE_MEDIA_PATH_PATTERN.test(parsed.pathname)) return null;
    const configuredBases = [process.env.S3_PUBLIC_BASE_URL]
      .map((candidate) => {
        try {
          return candidate ? new URL(candidate) : null;
        } catch {
          return null;
        }
      })
      .filter((candidate): candidate is URL => Boolean(candidate));
    const configuredStorageMatch = configuredBases.some((base) => {
      if (base.hostname.toLowerCase() !== hostname) return false;
      const basePath = base.pathname.replace(/\/+$/u, '');
      return !basePath || basePath === '/' || parsed.pathname === basePath || parsed.pathname.startsWith(`${basePath}/`);
    });
    if (configuredStorageMatch || DEFAULT_PUBLIC_MEDIA_HOSTS.has(hostname)) return normalized;
    const appHosts = new Set(['maxvideoai.com', 'www.maxvideoai.com']);
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
      if (appUrl) appHosts.add(new URL(appUrl).hostname.toLowerCase());
    } catch {
      // Ignore malformed optional public app configuration.
    }
    return appHosts.has(hostname) && PUBLIC_APP_MEDIA_PATH_PATTERN.test(parsed.pathname) ? normalized : null;
  } catch {
    return null;
  }
}

function buildAgentResult(
  record: GenerationStatusRecord,
  surface: 'video' | 'image',
  status: AgentGenerationStatus['status']
): AgentGenerationResult | null {
  if (status !== 'completed') return null;
  if (surface === 'video') {
    const videoUrl = stableMediaUrl(record.video_url);
    if (!videoUrl) return null;
    return {
      surface,
      videoUrl,
      previewUrl: stableMediaUrl(record.preview_video_url),
      thumbnailUrl: stableMediaUrl(record.thumb_url),
      audioUrl: stableMediaUrl(record.audio_url),
    };
  }

  const parsedRenders = parseStoredImageRenders(record.render_ids);
  const imageUrls = (extractRenderIds(parsedRenders.entries) ?? [])
    .map((url) => stableMediaUrl(url))
    .filter((url): url is string => Boolean(url));
  if (!imageUrls.length) return null;
  const thumbnailUrls = [
    ...(extractRenderThumbUrls(parsedRenders) ?? []),
    record.thumb_url,
  ]
    .map((url) => stableMediaUrl(url))
    .filter((url): url is string => Boolean(url));
  return { surface, imageUrls, thumbnailUrls: Array.from(new Set(thumbnailUrls)) };
}

function buildAgentMessage(
  status: AgentGenerationStatus['status'],
  rawMessage: string | null
): string | null {
  if (status === 'accepted') return 'Generation accepted.';
  if (status === 'running') return 'Generation in progress.';
  if (status === 'failed') {
    const message = rawMessage?.trim().toLowerCase() ?? '';
    if (/responsible ai|sensitive words|content policy|policy violation|safety|moderation|prohibited|blocked/iu.test(message)) {
      return AGENT_FAILURE_COPY.safety;
    }
    if (/unsupported|not supported|invalid request|unprocessable|does not support/iu.test(message)) {
      return AGENT_FAILURE_COPY.unsupported;
    }
    if (/no result|no video|no usable output|returned no|without a usable output/iu.test(message)) {
      return AGENT_FAILURE_COPY.noOutput;
    }
    if (/copy|copied|storage|download|fast-start|faststart/iu.test(message)) {
      return AGENT_FAILURE_COPY.storage;
    }
    if (/timeout|timed out|processing window|expected window|grace period|exceeded/iu.test(message)) {
      return AGENT_FAILURE_COPY.timeout;
    }
    if (/rate limit|temporarily unavailable|temporarily busy|quota|credits exhausted|too many requests|queue is/iu.test(message)) {
      return AGENT_FAILURE_COPY.busy;
    }
    if (/could not start|start failed|request failed|sync failed|missing provider_job_id|status unavailable|not found|expired/iu.test(message)) {
      return AGENT_FAILURE_COPY.start;
    }
    return AGENT_FAILURE_COPY.default;
  }
  return null;
}

export async function readOwnedGenerationRecord(params: {
  userId: string;
  jobId: string;
  queryFn?: GenerationStatusQuery;
}): Promise<GenerationStatusRecord | null> {
  const userId = params.userId.trim();
  const jobId = params.jobId.trim();
  if (!userId || !jobId) return null;
  const queryFn: GenerationStatusQuery = params.queryFn ?? query;
  const rows = await queryFn(
    `SELECT ${GENERATION_STATUS_SELECT}
       FROM app_jobs
      WHERE job_id = $1
        AND user_id = $2
      LIMIT 1`,
    [jobId, userId]
  );
  const record = rows[0];
  if (!record || record.job_id !== jobId || record.user_id !== userId) return null;
  return record;
}

export function mapGenerationStatusRecordToAgent(
  record: GenerationStatusRecord
): AgentGenerationStatus | null {
  const surface = normalizeAgentSurface(record);
  if (!surface) return null;
  const status = normalizeAgentStatus(record.status);
  return {
    jobId: record.job_id,
    surface,
    status,
    progress: normalizeProgress(record.progress, status),
    message: buildAgentMessage(status, record.message),
    priceCents:
      typeof record.final_price_cents === 'number' &&
      Number.isSafeInteger(record.final_price_cents) &&
      record.final_price_cents >= 0
        ? record.final_price_cents
        : null,
    currency: normalizeCurrency(record.currency),
    paymentStatus: normalizePaymentStatus(record.payment_status),
    result: buildAgentResult(record, surface, status),
    retryAfterSeconds: status === 'accepted' || status === 'running' ? 5 : null,
  };
}

export async function getGenerationStatus(params: {
  userId: string;
  jobId: string;
  queryFn?: GenerationStatusQuery;
}): Promise<AgentGenerationStatus | null> {
  const record = await readOwnedGenerationRecord(params);
  return record ? mapGenerationStatusRecordToAgent(record) : null;
}

function buildFallbackSettingsSnapshot(record: GenerationStatusRecord): unknown {
  const surface = deriveJobSurface({
    surface: record.surface,
    settingsSnapshot: record.settings_snapshot,
    jobId: record.job_id,
    engineId: record.engine_id,
    videoUrl: record.video_url,
    renderIds: record.render_ids,
  });
  if (surface !== 'video') {
    const renderIds = extractRenderIds(parseStoredImageRenders(record.render_ids).entries) ?? [];
    return {
      schemaVersion: 1,
      surface,
      engineId: record.engine_id,
      engineLabel: record.engine_label,
      inputMode: 't2i',
      prompt: record.prompt ?? '',
      core: { numImages: renderIds.length || 1, aspectRatio: record.aspect_ratio ?? null, resolution: null },
      refs: { imageUrls: [] },
      meta: { derived: true },
    };
  }
  return {
    schemaVersion: 1,
    surface: 'video',
    engineId: record.engine_id,
    engineLabel: record.engine_label,
    inputMode: 't2v',
    prompt: record.prompt ?? '',
    negativePrompt: null,
    core: {
      durationSec: record.duration_sec ?? null,
      durationOption: null,
      numFrames: null,
      aspectRatio: record.aspect_ratio ?? null,
      resolution: null,
      fps: null,
      iterationCount: null,
    },
    advanced: { cfgScale: null, loop: null },
    refs: {
      imageUrl: null,
      referenceImages: null,
      firstFrameUrl: null,
      lastFrameUrl: null,
      inputs: null,
    },
    meta: { derived: true },
  };
}

export type GenerationStatusWebOverrides = {
  status?: string;
  progress?: number;
  videoUrl?: string | null;
  previewVideoUrl?: string | null;
  audioUrl?: string | null;
  thumbUrl?: string | null;
  renderIds?: string[] | null;
  renderThumbUrls?: string[] | null;
  message?: string | null;
  useFallbackSettingsSnapshot?: boolean;
};

export function mapGenerationStatusRecordToWeb(
  record: GenerationStatusRecord,
  overrides: GenerationStatusWebOverrides = {}
) {
  const parsedRenders = parseStoredImageRenders(record.render_ids);
  const surface = deriveJobSurface({
    surface: record.surface,
    settingsSnapshot: record.settings_snapshot,
    jobId: record.job_id,
    engineId: record.engine_id,
    videoUrl: record.video_url,
    renderIds: record.render_ids,
  });
  const useFallbackSettingsSnapshot = overrides.useFallbackSettingsSnapshot !== false;
  const override = <K extends keyof GenerationStatusWebOverrides>(
    key: K,
    fallback: GenerationStatusWebOverrides[K]
  ): GenerationStatusWebOverrides[K] =>
    Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : fallback;
  return {
    ok: true,
    jobId: record.job_id,
    surface,
    billingProductKey: record.billing_product_key ?? undefined,
    createdAt: record.created_at,
    status: override('status', record.status ?? undefined),
    progress: override('progress', record.progress ?? undefined),
    videoUrl: normalizeMediaUrl(override('videoUrl', record.video_url)) ?? undefined,
    previewVideoUrl: normalizeMediaUrl(override('previewVideoUrl', record.preview_video_url)) ?? undefined,
    audioUrl: normalizeMediaUrl(override('audioUrl', record.audio_url)) ?? undefined,
    thumbUrl: normalizeMediaUrl(override('thumbUrl', record.thumb_url)) ?? undefined,
    aspectRatio: record.aspect_ratio ?? undefined,
    pricing: record.pricing_snapshot ?? undefined,
    settingsSnapshot:
      record.settings_snapshot && typeof record.settings_snapshot === 'object'
        ? record.settings_snapshot
        : useFallbackSettingsSnapshot
          ? buildFallbackSettingsSnapshot(record)
          : undefined,
    finalPriceCents: record.final_price_cents ?? undefined,
    currency: record.currency ?? 'USD',
    paymentStatus: record.payment_status ?? undefined,
    vendorAccountId: record.vendor_account_id ?? undefined,
    stripePaymentIntentId: record.stripe_payment_intent_id ?? undefined,
    stripeChargeId: record.stripe_charge_id ?? undefined,
    batchId: record.batch_id ?? undefined,
    groupId: record.group_id ?? undefined,
    iterationIndex: record.iteration_index ?? undefined,
    iterationCount: record.iteration_count ?? undefined,
    renderIds: override('renderIds', extractRenderIds(parsedRenders.entries) ?? undefined),
    renderThumbUrls: override('renderThumbUrls', extractRenderThumbUrls(parsedRenders) ?? undefined),
    heroRenderId: record.hero_render_id ?? undefined,
    localKey: record.local_key ?? undefined,
    message: override('message', record.message ?? undefined) ?? undefined,
    etaSeconds: record.eta_seconds ?? undefined,
    etaLabel: record.eta_label ?? undefined,
  };
}
