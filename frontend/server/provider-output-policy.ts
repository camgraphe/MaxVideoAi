export const PROVIDER_VIDEO_COPY_FAILURE_MESSAGE =
  'The provider finished this render, but the video could not be copied to MaxVideoAI storage. Please retry.';
export const PROVIDER_VIDEO_COPY_RETRY_MESSAGE =
  'Generated video is ready. Copying it to MaxVideoAI storage.';
const DEFAULT_PROVIDER_VIDEO_COPY_MAX_ATTEMPTS = 6;
const DEFAULT_PROVIDER_VIDEO_COPY_WINDOW_MS = 3 * 60 * 60_000;
const PROVIDER_VIDEO_COPY_RETRY_DELAYS_MS = [2, 5, 15, 45, 90].map((minutes) => minutes * 60_000);

export type ProviderMediaLog = {
  present: boolean;
  host: string | null;
  managedStorage: boolean;
};

export type ProviderVideoCopyState = {
  attempts: number;
  firstFailedAt: string | null;
  lastFailedAt: string | null;
  lastProviderStatus?: string | null;
  lastReason?: string | null;
  nextRetryAt?: string | null;
};

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true' || value?.trim() === '1';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function requireFalProviderVideoCopy(): boolean {
  return enabled(process.env.REQUIRE_PROVIDER_VIDEO_COPY_FOR_FAL);
}

export function isManagedStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim();
    if (publicBase) {
      try {
        const base = new URL(publicBase);
        if (parsed.host === base.host) return true;
      } catch {
        // Ignore invalid env and fall through to bucket host matching.
      }
    }

    const bucket = process.env.S3_BUCKET?.trim();
    if (!bucket) return false;
    const region = process.env.S3_REGION?.trim();
    const regionalHost = region ? `${bucket}.s3.${region}.amazonaws.com` : `${bucket}.s3.amazonaws.com`;
    return parsed.host === regionalHost;
  } catch {
    return false;
  }
}

export function shouldFailVideoJobOnProviderCopyMiss(params: {
  provider: string | null | undefined;
  sourceUrl: string | null | undefined;
  copiedUrl: string | null | undefined;
  currentJobStatus?: string | null | undefined;
}): boolean {
  if (params.provider !== 'fal') return false;
  if (!requireFalProviderVideoCopy()) return false;
  if (params.currentJobStatus?.trim().toLowerCase() === 'completed') return false;
  if (!params.sourceUrl || !/^https?:\/\//i.test(params.sourceUrl)) return false;
  if (params.copiedUrl) return false;
  return !isManagedStorageUrl(params.sourceUrl);
}

export function resolveProviderVideoCopyMaxAttempts(
  raw = process.env.PROVIDER_VIDEO_COPY_MAX_ATTEMPTS
): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, 50)
    : DEFAULT_PROVIDER_VIDEO_COPY_MAX_ATTEMPTS;
}

export function getProviderVideoCopyState(settingsSnapshot: unknown): ProviderVideoCopyState {
  const settings = isRecord(settingsSnapshot) ? settingsSnapshot : {};
  const raw = isRecord(settings.providerVideoCopy) ? settings.providerVideoCopy : {};
  const attempts = Number(raw.attempts);
  return {
    attempts: Number.isFinite(attempts) && attempts > 0 ? Math.floor(attempts) : 0,
    firstFailedAt: typeof raw.firstFailedAt === 'string' && raw.firstFailedAt.length ? raw.firstFailedAt : null,
    lastFailedAt: typeof raw.lastFailedAt === 'string' && raw.lastFailedAt.length ? raw.lastFailedAt : null,
    lastProviderStatus: typeof raw.lastProviderStatus === 'string' ? raw.lastProviderStatus : null,
    lastReason: typeof raw.lastReason === 'string' ? raw.lastReason : null,
    nextRetryAt: typeof raw.nextRetryAt === 'string' && raw.nextRetryAt.length ? raw.nextRetryAt : null,
  };
}

export function buildNextProviderVideoCopyState(
  settingsSnapshot: unknown,
  params: { nowIso?: string; providerStatus?: string | null; reason?: string | null; maxAttempts?: number } = {}
): ProviderVideoCopyState {
  const previous = getProviderVideoCopyState(settingsSnapshot);
  const nowIso = params.nowIso ?? new Date().toISOString();
  const attempts = previous.attempts + 1;
  const maxAttempts = params.maxAttempts ?? resolveProviderVideoCopyMaxAttempts();
  const retryDelayMs = attempts < maxAttempts ? PROVIDER_VIDEO_COPY_RETRY_DELAYS_MS[attempts - 1] : null;
  const nowMs = Date.parse(nowIso);
  return {
    attempts,
    firstFailedAt: previous.firstFailedAt ?? nowIso,
    lastFailedAt: nowIso,
    lastProviderStatus: params.providerStatus ?? previous.lastProviderStatus ?? null,
    lastReason: params.reason ?? previous.lastReason ?? null,
    nextRetryAt:
      retryDelayMs !== null && Number.isFinite(nowMs) ? new Date(nowMs + retryDelayMs).toISOString() : null,
  };
}

export function isProviderVideoCopyRetryDue(
  state: Pick<ProviderVideoCopyState, 'nextRetryAt'>,
  nowMs = Date.now()
): boolean {
  if (!state.nextRetryAt) return true;
  const nextRetryAtMs = Date.parse(state.nextRetryAt);
  if (!Number.isFinite(nextRetryAtMs)) return true;
  return nowMs >= nextRetryAtMs;
}

export function shouldRetryProviderVideoCopy(params: {
  state: Pick<ProviderVideoCopyState, 'attempts'>;
  createdAt: string;
  nowMs?: number;
  maxAttempts?: number;
  copyWindowMs?: number;
}): boolean {
  const maxAttempts = params.maxAttempts ?? resolveProviderVideoCopyMaxAttempts();
  if (params.state.attempts >= maxAttempts) return false;
  const createdAtMs = Date.parse(params.createdAt);
  if (!Number.isFinite(createdAtMs)) return true;
  const copyWindowMs = params.copyWindowMs ?? DEFAULT_PROVIDER_VIDEO_COPY_WINDOW_MS;
  return (params.nowMs ?? Date.now()) - createdAtMs < copyWindowMs;
}

export function buildSafeProviderMediaLog(url: string | null | undefined): ProviderMediaLog {
  if (!url) {
    return { present: false, host: null, managedStorage: false };
  }
  try {
    const parsed = new URL(url);
    return {
      present: true,
      host: parsed.host,
      managedStorage: isManagedStorageUrl(url),
    };
  } catch {
    return { present: true, host: null, managedStorage: false };
  }
}
