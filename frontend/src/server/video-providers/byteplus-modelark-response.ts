import type { NormalizedVideoProviderTask, NormalizedVideoProviderUsage } from '@/server/video-providers/types';
import { SEEDANCE_OUTPUT_COPYRIGHT_RESTRICTED } from '@/lib/video-failure-codes';

export type BytePlusTaskResponse = Record<string, unknown>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function firstString(value: unknown, keys: string[]): string | null {
  if (!isRecord(value)) return null;
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim().length) {
      return candidate.trim();
    }
  }
  return null;
}

function firstRecord(value: unknown, keys: string[]): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  for (const key of keys) {
    const candidate = value[key];
    if (isRecord(candidate)) return candidate;
  }
  return null;
}

function extractUsage(value: unknown): NormalizedVideoProviderUsage | null {
  const content = firstRecord(value, ['content', 'result', 'output', 'data']);
  const usage = firstRecord(value, ['usage']) ?? firstRecord(content, ['usage']);
  if (!usage) return null;
  const totalRaw = usage.total_tokens ?? usage.totalTokens;
  const completionRaw = usage.completion_tokens ?? usage.completionTokens;
  const totalTokens = typeof totalRaw === 'number' && Number.isFinite(totalRaw) ? totalRaw : null;
  const completionTokens = typeof completionRaw === 'number' && Number.isFinite(completionRaw) ? completionRaw : null;
  return totalTokens == null && completionTokens == null ? null : { totalTokens, completionTokens };
}

function extractVideoUrl(value: unknown): string | null {
  const content = firstRecord(value, ['content', 'result', 'output', 'data']);
  const direct = firstString(value, ['video_url', 'videoUrl', 'url']);
  if (direct) return direct;
  const contentDirect = firstString(content, ['video_url', 'videoUrl', 'url']);
  if (contentDirect) return contentDirect;
  const video = firstRecord(content, ['video']) ?? firstRecord(value, ['video']);
  return firstString(video, ['url', 'video_url', 'videoUrl']);
}

function extractErrorMessage(value: unknown): string | null {
  const error = firstRecord(value, ['error']);
  return (
    firstString(error, ['message', 'msg', 'detail']) ??
    firstString(value, ['message', 'error_message', 'errorMessage']) ??
    null
  );
}

function extractErrorCode(value: unknown): string | null {
  const error = firstRecord(value, ['error']);
  return firstString(error, ['code', 'error_code', 'errorCode']) ?? firstString(value, ['code', 'error_code', 'errorCode']);
}

export function normalizeBytePlusTask(task: unknown): NormalizedVideoProviderTask {
  const root = firstRecord(task, ['data', 'task']) ?? task;
  const providerJobId = firstString(root, ['id', 'task_id', 'taskId']) ?? '';
  const rawStatus = firstString(root, ['status', 'state'])?.toLowerCase() ?? null;
  const status =
    rawStatus === 'succeeded' || rawStatus === 'success'
      ? 'completed'
      : rawStatus === 'failed' || rawStatus === 'expired' || rawStatus === 'cancelled' || rawStatus === 'canceled'
        ? 'failed'
        : rawStatus === 'running' || rawStatus === 'processing' || rawStatus === 'in_progress'
          ? 'running'
          : 'queued';

  return {
    providerJobId,
    status,
    rawStatus,
    videoUrl: extractVideoUrl(root) ?? extractVideoUrl(task),
    message: extractErrorMessage(root) ?? extractErrorMessage(task),
    errorCode: extractErrorCode(root) ?? extractErrorCode(task),
    usage: extractUsage(root) ?? extractUsage(task),
    raw: task,
  };
}

export function scrubBytePlusError(error: unknown): string {
  const nestedError = isRecord(error) && isRecord(error.error) ? error.error : null;
  const raw =
    error instanceof Error
      ? error.message
      : isRecord(error) && typeof error.message === 'string'
        ? error.message
        : nestedError && typeof nestedError.message === 'string'
          ? nestedError.message
          : typeof error === 'string'
            ? error
            : 'BytePlus ModelArk request failed.';
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/ark-[A-Za-z0-9._~+/=-]+/gi, '[redacted-api-key]')
    .replace(/([?&](?:X-Amz-Signature|Signature|Expires|X-Amz-Credential)=)[^&\s]+/gi, '$1[redacted]');
}

const SEEDANCE_START_FAILURE_MESSAGE =
  'Seedance could not start this render. Check that reference images do not show recognizable people, reduce reference complexity, then retry.';
const SEEDANCE_TASK_FAILURE_MESSAGE =
  'Seedance started this render but did not deliver a video. Retry with a simpler prompt or fewer reference assets.';
const SEEDANCE_COPYRIGHT_FAILURE_MESSAGE =
  'Seedance stopped this render after it started because its output checks detected possible copyright-restricted content. Change recognizable characters, brands, logos, franchise references, or source media before trying again.';

function isBytePlusCopyrightFailure(providerMessage: string, providerErrorCode?: string | null): boolean {
  const normalizedMessage = providerMessage.toLowerCase();
  const normalizedCode = providerErrorCode?.toLowerCase() ?? '';
  return (
    normalizedMessage.includes('copyright') ||
    normalizedMessage.includes('copyright restriction') ||
    normalizedCode === 'outputvideosensitivecontentdetected.policyviolation'
  );
}

function getBytePlusUserSafeFailureMessage(
  providerMessage: string,
  fallbackMessage: string,
  providerErrorCode?: string | null
): string {
  const normalized = providerMessage.toLowerCase();
  if (isBytePlusCopyrightFailure(providerMessage, providerErrorCode)) {
    return SEEDANCE_COPYRIGHT_FAILURE_MESSAGE;
  }
  if (
    normalized.includes('real person') ||
    normalized.includes('private information') ||
    normalized.includes('private content') ||
    normalized.includes('recognizable') ||
    normalized.includes('recognisable') ||
    normalized.includes('identifiable') ||
    normalized.includes('sensitive') ||
    normalized.includes('policy')
  ) {
    return 'Seedance blocked a reference image because it may contain a recognizable person or private content. Use a non-identifiable, stylized, or generated reference image and try again.';
  }
  if (
    normalized.includes('quota') ||
    normalized.includes('resource pack') ||
    normalized.includes('credits exhausted') ||
    normalized.includes('too many requests') ||
    normalized.includes('rate limit') ||
    normalized.includes('temporarily unavailable')
  ) {
    return 'The render queue is temporarily busy. Please retry in a few moments.';
  }
  if (
    normalized.includes('invalid request') ||
    normalized.includes('unsupported') ||
    normalized.includes('not supported') ||
    normalized.includes('does not support') ||
    normalized.includes('unprocessable') ||
    normalized.includes('aspect ratio') ||
    normalized.includes('resolution') ||
    normalized.includes('duration')
  ) {
    return 'The selected Seedance prompt, media, or settings were not accepted. Adjust the reference media or settings and try again.';
  }
  return fallbackMessage;
}

export function getBytePlusUserSafeErrorMessage(providerMessage: string): string {
  return getBytePlusUserSafeFailureMessage(providerMessage, SEEDANCE_START_FAILURE_MESSAGE);
}

export function getBytePlusUserSafeTaskFailureMessage(
  providerMessage: string | null | undefined,
  providerErrorCode?: string | null
): string {
  return getBytePlusUserSafeFailureMessage(providerMessage ?? '', SEEDANCE_TASK_FAILURE_MESSAGE, providerErrorCode);
}

export function getBytePlusTaskFailureCode(
  providerMessage: string | null | undefined,
  providerErrorCode?: string | null
): string | null {
  return isBytePlusCopyrightFailure(providerMessage ?? '', providerErrorCode)
    ? SEEDANCE_OUTPUT_COPYRIGHT_RESTRICTED
    : null;
}

export async function parseJsonResponse(response: Response): Promise<BytePlusTaskResponse> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : { value: parsed };
  } catch {
    return { message: text };
  }
}
