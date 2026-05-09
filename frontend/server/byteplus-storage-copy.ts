import { isRecord } from './byteplus-record-utils';

const BYTEPLUS_OUTPUT_COPY_WINDOW_MS = 3 * 60 * 60_000;
const DEFAULT_PROVIDER_VIDEO_COPY_MAX_ATTEMPTS = 6;
const BYTEPLUS_STORAGE_COPY_RETRY_DELAYS_MS = [2, 5, 15, 45, 90].map((minutes) => minutes * 60_000);

export type BytePlusStorageCopyState = {
  attempts: number;
  firstFailedAt: string | null;
  lastFailedAt: string | null;
  lastProviderStatus?: string | null;
  lastReason?: string | null;
  nextRetryAt?: string | null;
};

export function resolveBytePlusStorageCopyMaxAttempts(raw = process.env.PROVIDER_VIDEO_COPY_MAX_ATTEMPTS ?? process.env.BYTEPLUS_STORAGE_COPY_MAX_ATTEMPTS): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : DEFAULT_PROVIDER_VIDEO_COPY_MAX_ATTEMPTS;
}

export function getBytePlusStorageCopyState(settingsSnapshot: unknown): BytePlusStorageCopyState {
  const settings = isRecord(settingsSnapshot) ? settingsSnapshot : {};
  const raw = isRecord(settings.byteplusStorageCopy) ? settings.byteplusStorageCopy : {};
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

export function buildNextBytePlusStorageCopyState(
  settingsSnapshot: unknown,
  params: { nowIso?: string; providerStatus?: string | null; reason?: string | null; maxAttempts?: number } = {}
): BytePlusStorageCopyState {
  const previous = getBytePlusStorageCopyState(settingsSnapshot);
  const nowIso = params.nowIso ?? new Date().toISOString();
  const attempts = previous.attempts + 1;
  const maxAttempts = params.maxAttempts ?? resolveBytePlusStorageCopyMaxAttempts();
  const retryDelayMs = attempts < maxAttempts ? BYTEPLUS_STORAGE_COPY_RETRY_DELAYS_MS[attempts - 1] : null;
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

export function isBytePlusStorageCopyRetryDue(
  state: Pick<BytePlusStorageCopyState, 'nextRetryAt'>,
  nowMs = Date.now()
): boolean {
  if (!state.nextRetryAt) return true;
  const nextRetryAtMs = Date.parse(state.nextRetryAt);
  if (!Number.isFinite(nextRetryAtMs)) return true;
  return nowMs >= nextRetryAtMs;
}

export function shouldRetryBytePlusStorageCopy(params: {
  state: Pick<BytePlusStorageCopyState, 'attempts'>;
  createdAt: string;
  nowMs?: number;
  maxAttempts?: number;
  copyWindowMs?: number;
}): boolean {
  const maxAttempts = params.maxAttempts ?? resolveBytePlusStorageCopyMaxAttempts();
  if (params.state.attempts >= maxAttempts) return false;
  const createdAtMs = Date.parse(params.createdAt);
  if (!Number.isFinite(createdAtMs)) return true;
  const copyWindowMs = params.copyWindowMs ?? BYTEPLUS_OUTPUT_COPY_WINDOW_MS;
  return (params.nowMs ?? Date.now()) - createdAtMs < copyWindowMs;
}
