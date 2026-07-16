import { deriveJobSurface } from '@/lib/job-surface';
import { extractRenderIds, extractRenderThumbUrls, parseStoredImageRenders } from '@/lib/image-renders';
import { isStablePublicMediaUrl, normalizeMediaUrl } from '@/lib/media';

import type {
  AgentGenerationResult,
  AgentGenerationStatus,
  GenerationStatusRecord,
} from './generation-status';

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
  'provider_polling_stalled',
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
const IMAGE_SURFACES = new Set(['angle', 'character', 'image', 'storyboard', 'upscale']);
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
  pollingStalled: 'This render needs manual review. Contact MaxVideoAI support with your request ID before retrying.',
} as const;

function normalizeAgentSurface(record: GenerationStatusRecord): 'video' | 'image' | null {
  const surface = deriveJobSurface({
    surface: record.surface,
    settingsSnapshot: record.settings_snapshot,
    jobId: record.job_id,
    engineId: record.engine_id,
    videoUrl: record.video_url,
    renderIds: Array.isArray(record.render_ids) ? record.render_ids : null,
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
    if (
      parsed.protocol !== 'https:' ||
      parsed.username.length > 0 ||
      parsed.password.length > 0 ||
      parsed.hash.length > 0 ||
      (parsed.port.length > 0 && parsed.port !== '443')
    ) {
      return null;
    }
    if (PRIVATE_MEDIA_PATH_PATTERN.test(parsed.pathname)) return null;
    const assetBases = (process.env.ASSET_HOST_ALLOWLIST ?? '')
      .split(',')
      .map((candidate) => candidate.trim())
      .filter(Boolean)
      .map((candidate) => (/^https?:\/\//iu.test(candidate) ? candidate : `https://${candidate}`));
    const configuredBases = [
      process.env.S3_PUBLIC_BASE_URL,
      process.env.TEST_VIDEO_BASE_URL,
      ...assetBases,
    ]
      .map((candidate) => {
        try {
          const base = candidate ? new URL(candidate) : null;
          if (
            !base ||
            base.protocol !== 'https:' ||
            base.username.length > 0 ||
            base.password.length > 0 ||
            base.hash.length > 0 ||
            (base.port.length > 0 && base.port !== '443')
          ) {
            return null;
          }
          return base;
        } catch {
          return null;
        }
      })
      .filter((candidate): candidate is URL => Boolean(candidate));
    const configuredStorageMatch = configuredBases.some((base) => {
      if (base.origin !== parsed.origin) return false;
      const basePath = base.pathname.replace(/\/+$/u, '');
      return !basePath || basePath === '/' || parsed.pathname === basePath || parsed.pathname.startsWith(`${basePath}/`);
    });
    const fixedOrigins = new Set(
      Array.from(DEFAULT_PUBLIC_MEDIA_HOSTS, (hostname) => `https://${hostname}`)
    );
    if (configuredStorageMatch || fixedOrigins.has(parsed.origin)) return normalized;
    const appOrigins = [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_APP_URL]
      .map((candidate) => {
        try {
          const base = candidate ? new URL(candidate) : null;
          return base?.protocol === 'https:' && (!base.port || base.port === '443') ? base.origin : null;
        } catch {
          return null;
        }
      })
      .filter((origin): origin is string => Boolean(origin));
    return appOrigins.includes(parsed.origin) && PUBLIC_APP_MEDIA_PATH_PATTERN.test(parsed.pathname)
      ? normalized
      : null;
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
  rawMessage: string | null,
  rawStatus: string | null
): string | null {
  if (status === 'accepted') return 'Generation accepted.';
  if (status === 'running') return 'Generation in progress.';
  if (status === 'failed') {
    if (rawStatus?.trim().toLowerCase() === 'provider_polling_stalled') {
      return AGENT_FAILURE_COPY.pollingStalled;
    }
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
    message: buildAgentMessage(status, record.message, record.status),
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
