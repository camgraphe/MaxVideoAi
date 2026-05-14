import type { NormalizedVideoProviderTask, NormalizedVideoProviderUsage } from '../types';
import { computeKlingDirectProviderCostUsd } from './cost';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function firstString(value: unknown, keys: string[]): string | null {
  if (!isRecord(value)) return null;
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) {
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

function firstNumber(value: unknown, keys: string[]): number | null {
  if (!isRecord(value)) return null;
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function extractVideoUrl(value: unknown): string | null {
  const result = firstRecord(value, ['task_result', 'result', 'data']);
  const videos = isRecord(result) && Array.isArray(result.videos) ? result.videos : null;
  const firstVideo = videos?.find(isRecord) ?? null;
  return firstString(firstVideo, ['url', 'video_url', 'videoUrl']) ?? firstString(result, ['url', 'video_url', 'videoUrl']);
}

function normalizeStatus(rawStatus: string | null): NormalizedVideoProviderTask['status'] {
  const normalized = rawStatus?.toLowerCase() ?? '';
  if (normalized === 'succeed' || normalized === 'succeeded' || normalized === 'success') return 'completed';
  if (normalized === 'failed' || normalized === 'fail' || normalized === 'error') return 'failed';
  if (normalized === 'processing' || normalized === 'running') return 'running';
  return 'queued';
}

function extractUsage(): NormalizedVideoProviderUsage | null {
  return null;
}

export function normalizeKlingDirectTask(raw: unknown, fallbackTaskId?: string | null): NormalizedVideoProviderTask {
  const data = firstRecord(raw, ['data']) ?? raw;
  const providerJobId = firstString(data, ['task_id', 'taskId', 'id']) ?? fallbackTaskId ?? '';
  const rawStatus = firstString(data, ['task_status', 'taskStatus', 'status'])?.toLowerCase() ?? null;
  const providerCostUnits = firstNumber(data, ['final_unit_deduction', 'finalUnitDeduction']);

  return {
    providerJobId,
    status: normalizeStatus(rawStatus),
    rawStatus,
    videoUrl: extractVideoUrl(data) ?? extractVideoUrl(raw),
    message:
      firstString(data, ['task_status_msg', 'taskStatusMsg', 'message', 'msg']) ??
      firstString(raw, ['message', 'msg']),
    usage: extractUsage(),
    providerCostUnits,
    providerCostUsd: computeKlingDirectProviderCostUsd(providerCostUnits),
    raw,
  };
}

export async function parseKlingJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : { value: parsed };
  } catch {
    return { message: text };
  }
}
