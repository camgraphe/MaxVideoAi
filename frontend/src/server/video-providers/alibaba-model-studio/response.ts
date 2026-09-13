import type { NormalizedVideoProviderStatus, NormalizedVideoProviderTask } from '../types';
import { AlibabaModelStudioError } from './errors';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeStatus(rawStatus: string | null): NormalizedVideoProviderStatus {
  switch (rawStatus?.toUpperCase()) {
    case 'RUNNING': return 'running';
    case 'SUCCEEDED': return 'completed';
    case 'FAILED':
    case 'CANCELED': return 'failed';
    case 'PENDING':
    case 'UNKNOWN':
    default: return 'queued';
  }
}

function invalidResponse(message: string, raw: unknown): never {
  throw new AlibabaModelStudioError(message, {
    code: 'ALIBABA_MODEL_STUDIO_INVALID_RESPONSE',
    errorClass: 'invalid_response',
    body: raw,
  });
}

export function normalizeAlibabaTask(raw: unknown, fallbackTaskId?: string): NormalizedVideoProviderTask {
  const root = asRecord(raw);
  const output = asRecord(root?.output);
  if (!root || !output) invalidResponse('Alibaba Model Studio response did not include task output.', raw);
  const providerJobId = cleanString(output.task_id) ?? cleanString(fallbackTaskId);
  if (!providerJobId) invalidResponse('Alibaba Model Studio response did not include a task ID.', raw);
  const rawStatus = cleanString(output.task_status);
  const status = normalizeStatus(rawStatus);
  const videoUrl = cleanString(output.video_url);
  if (status === 'completed' && !videoUrl) {
    invalidResponse('Alibaba Model Studio completed without a video URL.', raw);
  }
  const usage = asRecord(root.usage);
  const inputVideoDuration = finiteNumber(usage?.input_video_duration) ?? 0;
  const outputVideoDuration = finiteNumber(usage?.output_video_duration);
  const aggregateDuration = finiteNumber(usage?.duration);
  const providerCostUnits = aggregateDuration ?? (
    outputVideoDuration === null && inputVideoDuration === 0
      ? null
      : inputVideoDuration + (outputVideoDuration ?? 0)
  );
  return {
    providerJobId,
    status,
    rawStatus,
    videoUrl,
    message: status === 'failed' ? cleanString(output.message) ?? cleanString(root.message) : null,
    errorCode: cleanString(output.code) ?? cleanString(root.code),
    usage: { totalTokens: null, completionTokens: null },
    providerCostUnits,
    raw,
  };
}

export async function parseAlibabaJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 2_000) };
  }
}
