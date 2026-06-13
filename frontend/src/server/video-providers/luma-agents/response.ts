import type { NormalizedVideoProviderTask } from '../types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isUrlLike(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function firstUrlLike(value: unknown): string | null {
  const stringValue = cleanString(value);
  if (stringValue && isUrlLike(stringValue)) return stringValue;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstUrlLike(entry);
      if (found) return found;
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) return null;
  for (const key of ['url', 'video_url', 'videoUrl', 'download_url', 'downloadUrl']) {
    const found = firstUrlLike(record[key]);
    if (found) return found;
  }
  for (const entry of Object.values(record)) {
    const found = firstUrlLike(entry);
    if (found) return found;
  }
  return null;
}

function extractVideoUrl(raw: unknown): string | null {
  const record = asRecord(raw);
  const output = record?.output;
  const outputs = Array.isArray(output) ? output : output === undefined || output === null ? [] : [output];
  const videoOutput = outputs
    .map(asRecord)
    .find((entry): entry is Record<string, unknown> => cleanString(entry?.type)?.toLowerCase() === 'video');
  return firstUrlLike(videoOutput) ?? firstUrlLike(output) ?? firstUrlLike(record?.video) ?? firstUrlLike(raw);
}

function normalizeStatus(rawStatus: string | null): NormalizedVideoProviderTask['status'] {
  const normalized = rawStatus?.toLowerCase() ?? '';
  if (normalized === 'completed' || normalized === 'succeeded' || normalized === 'success') return 'completed';
  if (normalized === 'failed' || normalized === 'error') return 'failed';
  if (normalized === 'processing' || normalized === 'running' || normalized === 'dreaming') return 'running';
  return 'queued';
}

function extractFailureMessage(raw: unknown): string | null {
  const record = asRecord(raw);
  const detail = record?.detail;
  const detailRecord = asRecord(detail);
  return (
    cleanString(record?.failure_reason) ??
    cleanString(record?.failure_code) ??
    cleanString(detail) ??
    cleanString(detailRecord?.message) ??
    cleanString(record?.message)
  );
}

export function normalizeLumaAgentsGeneration(raw: unknown, fallbackGenerationId?: string | null): NormalizedVideoProviderTask {
  const record = asRecord(raw);
  const providerJobId = cleanString(record?.id) ?? cleanString(record?.generation_id) ?? fallbackGenerationId ?? '';
  const rawStatus = cleanString(record?.state) ?? cleanString(record?.status);
  const status = normalizeStatus(rawStatus);
  return {
    providerJobId,
    status,
    rawStatus,
    videoUrl: extractVideoUrl(raw),
    message: status === 'failed' ? extractFailureMessage(raw) : null,
    usage: null,
    raw,
  };
}

export async function parseLumaAgentsJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
