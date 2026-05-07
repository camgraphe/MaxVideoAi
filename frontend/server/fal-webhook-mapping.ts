import { getFalEngineById } from '@/config/falEngines';
import { listUpscaleToolEngines } from '@/config/tools-upscale-engines';
import { resolveEngineIdFromModelSlug } from '@/lib/fal-catalog';
import { normalizeMediaUrl } from '@/lib/media';

export function fallbackThumbnail(aspectRatio?: string | null): string {
  const normalized = aspectRatio?.trim().toLowerCase();
  if (normalized === '9:16') return '/assets/frames/thumb-9x16.svg';
  if (normalized === '1:1') return '/assets/frames/thumb-1x1.svg';
  return '/assets/frames/thumb-16x9.svg';
}

export type FalWebhookPayload = {
  request_id?: string;
  requestId?: string;
  status?: string;
  response?: unknown;
  data?: unknown;
  result?: unknown;
  error?: unknown;
  auto_refund_eligible?: boolean;
  autoRefundEligible?: boolean;
  failure_origin?: string;
  failureOrigin?: string;
};

export type WebhookIdentifiers = {
  jobId?: string | null;
  localKey?: string | null;
};

const COMPLETED_STATUSES = new Set(['COMPLETED', 'FINISHED', 'SUCCESS']);
const FAILED_STATUSES = new Set(['FAILED', 'ERROR', 'CANCELLED', 'CANCELED', 'ABORTED']);
const RUNNING_STATUSES = new Set(['RUNNING', 'IN_PROGRESS', 'PROCESSING']);
const QUEUED_STATUSES = new Set(['QUEUED', 'IN_QUEUE', 'PENDING']);

const PROVIDER_ENGINE_MAP: Record<string, string> = {
  openai: 'sora-2',
  'openai-sora': 'sora-2',
  'sora-2': 'sora-2',
  'sora-2-pro': 'sora-2-pro',
  'openai-sora-2-pro': 'sora-2-pro',
  'sora-pro': 'sora-2-pro',
  sora: 'sora-2',
  pika: 'pika-text-to-video',
  'pika-labs': 'pika-text-to-video',
  'pika-2.2': 'pika-text-to-video',
  'google-veo': 'veo-3-1-fast',
  google: 'veo-3-1-fast',
  veo: 'veo-3-1-fast',
  luma: 'luma-dream-machine',
  'luma-dream-machine': 'luma-dream-machine',
};

const UPSCALE_TOOL_ENGINE_BY_ID = new Map<string, { mediaType: 'image' | 'video' }>(
  listUpscaleToolEngines().map((engine) => [engine.id, { mediaType: engine.mediaType }])
);

const COMMON_ASPECT_RATIOS: Array<{ label: string; value: number }> = [
  { label: '21:9', value: 21 / 9 },
  { label: '16:9', value: 16 / 9 },
  { label: '5:3', value: 5 / 3 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '1:1', value: 1 },
  { label: '3:4', value: 3 / 4 },
  { label: '2:3', value: 2 / 3 },
  { label: '4:5', value: 4 / 5 },
  { label: '9:16', value: 9 / 16 },
];

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

export function formatAspectRatioLabel(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  const ratio = width / height;
  let closest: { label: string; diff: number } | null = null;
  for (const entry of COMMON_ASPECT_RATIOS) {
    const diff = Math.abs(ratio - entry.value);
    if (!closest || diff < closest.diff) {
      closest = { label: entry.label, diff };
    }
  }
  if (closest && closest.diff <= 0.03) {
    return closest.label;
  }
  const divisor = gcd(width, height);
  const simplifiedWidth = Math.max(1, Math.round(width / divisor));
  const simplifiedHeight = Math.max(1, Math.round(height / divisor));
  return `${simplifiedWidth}:${simplifiedHeight}`;
}

function extractStringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length) return trimmed;
    }
  }
  return null;
}

export function extractIdentifiersFromPayload(payload: unknown): WebhookIdentifiers {
  const identifiers: WebhookIdentifiers = {};
  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length && (!identifiers.jobId || !identifiers.localKey)) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const record = current as Record<string, unknown>;
    if (!identifiers.jobId) {
      const candidate = extractStringField(record, ['app_job_id', 'job_id', 'jobId', 'id']);
      if (candidate && candidate.startsWith('job_')) {
        identifiers.jobId = candidate;
      } else if (!identifiers.jobId && record === current) {
        const requestIdCandidate = extractStringField(record, ['request_id']);
        if (requestIdCandidate && requestIdCandidate.startsWith('job_')) {
          identifiers.jobId = requestIdCandidate;
        }
      }
    }
    if (!identifiers.localKey) {
      const candidate = extractStringField(record, ['app_local_key', 'local_key', 'localKey']);
      if (candidate) {
        identifiers.localKey = candidate;
      }
    }

    const metadata = record.metadata;
    if (metadata && typeof metadata === 'object') {
      stack.push(metadata);
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return identifiers;
}

export async function inferEngineFromPayload(
  payload: FalWebhookPayload
): Promise<{ engineId: string; engineLabel: string | null }> {
  const modelSlug =
    findFirstString(payload, ['model', 'model_slug', 'modelId', 'model_id', 'fal_model_id', 'falModelId', 'endpoint']) ??
    null;
  if (modelSlug) {
    const engineId = (await resolveEngineIdFromModelSlug(modelSlug)) ?? null;
    if (engineId) {
      const engine = getFalEngineById(engineId);
      const engineLabel =
        engine?.marketingName ??
        (typeof (engine as { label?: string } | undefined)?.label === 'string' ? (engine as { label?: string }).label : null) ??
        engineId;
      return { engineId, engineLabel };
    }
  }

  const provider = findFirstString(payload, ['provider', 'vendor', 'source'])?.toLowerCase() ?? null;
  if (provider && PROVIDER_ENGINE_MAP[provider]) {
    const engineId = PROVIDER_ENGINE_MAP[provider];
    const engine = getFalEngineById(engineId);
    const engineLabel =
      engine?.marketingName ??
      (typeof (engine as { label?: string } | undefined)?.label === 'string' ? (engine as { label?: string }).label : null) ??
      engineId;
    return { engineId, engineLabel };
  }

  const requestEngine = findFirstString(payload, ['engine_id', 'engineId', 'engine']) ?? null;
  if (requestEngine && requestEngine !== 'fal-unknown') {
    const normalized = requestEngine.trim();
    const engineId =
      PROVIDER_ENGINE_MAP[normalized.toLowerCase()] ??
      (await resolveEngineIdFromModelSlug(normalized)) ??
      normalized;
    const engine = getFalEngineById(engineId);
    const engineLabel =
      engine?.marketingName ??
      (typeof (engine as { label?: string } | undefined)?.label === 'string' ? (engine as { label?: string }).label : null) ??
      engineId;
    return { engineId, engineLabel };
  }

  return { engineId: 'fal-unknown', engineLabel: null };
}

export function findFirstString(payload: unknown, keys: string[]): string | null {
  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const record = current as Record<string, unknown>;
    const candidate = extractStringField(record, keys);
    if (candidate) return candidate;

    const metadata = record.metadata;
    if (metadata && typeof metadata === 'object') {
      stack.push(metadata);
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return null;
}

export function extractMediaUrls(payload: unknown): { videoUrl?: string | null; thumbUrl?: string | null } {
  if (!payload || typeof payload !== 'object') return {};

  const candidates: unknown[] = [];

  const pushCandidate = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => pushCandidate(entry));
    } else {
      candidates.push(value);
    }
  };

  const container = payload as Record<string, unknown>;
  pushCandidate(container.video);
  pushCandidate(container.videos);
  pushCandidate(container.assets);
  pushCandidate(container.response);
  pushCandidate(container.output);
  pushCandidate(container.result);

  const flatten = candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return candidate;
    const record = candidate as Record<string, unknown>;
    const nested: unknown[] = [];
    if (record.video) nested.push(record.video);
    if (record.videos) nested.push(record.videos);
    if (record.assets) nested.push(record.assets);
    if (record.response) nested.push(record.response);
    if (record.output) nested.push(record.output);
    return [candidate, ...nested];
  });

  let videoUrl: string | null | undefined;
  let thumbUrl: string | null | undefined;

  for (const candidate of flatten) {
    if (typeof candidate === 'string' && !videoUrl) {
      videoUrl = candidate;
      continue;
    }
    if (candidate && typeof candidate === 'object') {
      const record = candidate as Record<string, unknown>;
      if (!videoUrl) {
        videoUrl =
          (typeof record.url === 'string' && record.url) ||
          (typeof record.video_url === 'string' && record.video_url) ||
          (typeof record.path === 'string' && record.path) ||
          null;
      }
      if (!thumbUrl) {
        thumbUrl =
          (typeof record.thumbnail === 'string' && record.thumbnail) ||
          (typeof record.thumb_url === 'string' && record.thumb_url) ||
          (typeof record.poster === 'string' && record.poster) ||
          (typeof record.preview === 'string' && record.preview) ||
          null;
      }
    }
    if (videoUrl && thumbUrl) break;
  }

  return { videoUrl, thumbUrl };
}

export function normalizeRenderIdList(value: unknown): string[] {
  const collect = (entries: unknown[]): string[] =>
    entries
      .map((entry) => {
        if (typeof entry === 'string' && entry.trim().length) {
          return normalizeMediaUrl(entry) ?? entry;
        }
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          if (typeof record.url === 'string' && record.url.trim().length) {
            return normalizeMediaUrl(record.url) ?? record.url;
          }
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry));

  if (Array.isArray(value)) {
    return collect(value);
  }
  if (typeof value === 'string' && value.trim().length) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return collect(parsed);
      }
    } catch {
      return [];
    }
  }
  return [];
}

export function extractImageUrlsFromPayload(payload: unknown): string[] {
  if (!payload) return [];
  const urls = new Set<string>();
  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    if (typeof current === 'string') {
      if (/^https?:\/\//i.test(current)) {
        urls.add(normalizeMediaUrl(current) ?? current);
      }
      continue;
    }

    if (Array.isArray(current)) {
      current.forEach((entry) => stack.push(entry));
      continue;
    }

    if (typeof current === 'object') {
      const record = current as Record<string, unknown>;
      if (Array.isArray(record.images)) {
        record.images.forEach((entry) => stack.push(entry));
      }
      const directUrl =
        (typeof record.url === 'string' && record.url.trim().length ? record.url : null) ||
        (typeof record.image_url === 'string' && record.image_url.trim().length ? record.image_url : null) ||
        (typeof record.thumbnail === 'string' && record.thumbnail.trim().length ? record.thumbnail : null);
      if (directUrl) {
        urls.add(normalizeMediaUrl(directUrl) ?? directUrl);
      }
      for (const value of Object.values(record)) {
        if (value && (typeof value === 'object' || typeof value === 'string')) {
          stack.push(value);
        }
      }
    }
  }

  return Array.from(urls);
}

const ERROR_MESSAGE_KEYS = [
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

function normalizeErrorText(value: unknown): string | null {
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
    return normalizeErrorText(value.message);
  }
  return null;
}

function findFirstErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return normalizeErrorText(payload);
  }

  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') {
      const text = normalizeErrorText(current);
      if (text) return text;
      continue;
    }
    if (visited.has(current)) continue;
    visited.add(current);

    const record = current as Record<string, unknown>;
    for (const key of ERROR_MESSAGE_KEYS) {
      if (key in record) {
        const candidate = normalizeErrorText(record[key]);
        if (candidate) return candidate;
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      } else {
        const text = normalizeErrorText(value);
        if (text) return text;
      }
    }
  }

  return null;
}

export function extractFalErrorMessage(payload: FalWebhookPayload, additionalContext?: unknown): string | null {
  const direct = normalizeErrorText(payload.error);
  if (direct) return direct;

  const nestedSources: unknown[] = [];
  if (payload.error && typeof payload.error === 'object') {
    nestedSources.push(payload.error);
  }
  if (payload.result) nestedSources.push(payload.result);
  if (payload.response) nestedSources.push(payload.response);
  if (payload.data) nestedSources.push(payload.data);
  if (additionalContext && typeof additionalContext === 'object') {
    nestedSources.push(additionalContext);
  }

  for (const source of nestedSources) {
    const candidate = findFirstErrorMessage(source);
    if (candidate) return candidate;
  }

  const fallback = findFirstErrorMessage(payload);
  if (fallback) return fallback;

  return null;
}

export function normalizeStatus(
  status: string | undefined,
  previousStatus: string,
  previousProgress: number
): { status: string; progress: number } {
  if (!status) {
    return { status: previousStatus, progress: previousProgress };
  }
  const normalized = status.toUpperCase();
  if (COMPLETED_STATUSES.has(normalized)) {
    return { status: 'completed', progress: 100 };
  }
  if (FAILED_STATUSES.has(normalized)) {
    return { status: 'failed', progress: previousProgress };
  }
  if (RUNNING_STATUSES.has(normalized)) {
    return {
      status: 'running',
      progress: Math.max(previousProgress, 25),
    };
  }
  if (QUEUED_STATUSES.has(normalized)) {
    return { status: 'queued', progress: Math.max(previousProgress, 5) };
  }
  return { status: previousStatus, progress: previousProgress };
}

export function getUpscaleToolMediaType(engineId: string): 'image' | 'video' | null {
  return UPSCALE_TOOL_ENGINE_BY_ID.get(engineId)?.mediaType ?? null;
}

export function isCompletedFalStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return COMPLETED_STATUSES.has(status.toUpperCase());
}

export function isFailedFalStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return FAILED_STATUSES.has(status.toUpperCase());
}
