import type { NormalizedVideoProviderTask, NormalizedVideoProviderUsage } from '@/server/video-providers/types';

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

export function getBytePlusUserSafeErrorMessage(providerMessage: string): string {
  const normalized = providerMessage.toLowerCase();
  if (
    normalized.includes('real person') ||
    normalized.includes('private information') ||
    normalized.includes('sensitive') ||
    normalized.includes('policy')
  ) {
    return 'One of the input images was blocked by safety checks. Try an image without identifiable people or private content.';
  }
  return 'The render could not start. Please retry later.';
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
