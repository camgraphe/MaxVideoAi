import type { NormalizedVideoProviderTask } from '../types';

export type GoogleVertexOmniVideoOutput = {
  uri: string | null;
  data: string | null;
  mimeType: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function extractErrorMessage(raw: unknown): string | null {
  const record = asRecord(raw);
  const error = asRecord(record?.error);
  return cleanString(error?.message) ?? cleanString(record?.message);
}

function extractUsage(raw: unknown): NormalizedVideoProviderTask['usage'] {
  const usage = asRecord(asRecord(raw)?.usage);
  if (!usage) return null;
  const totalTokens = typeof usage.total_tokens === 'number' ? usage.total_tokens : null;
  const completionTokens =
    typeof usage.total_output_tokens === 'number'
      ? usage.total_output_tokens
      : typeof usage.output_tokens === 'number'
        ? usage.output_tokens
        : null;
  if (totalTokens === null && completionTokens === null) return null;
  return { totalTokens, completionTokens };
}

function contentBlocks(raw: unknown): Record<string, unknown>[] {
  const record = asRecord(raw);
  const candidates: unknown[] = [];
  const outputVideo = asRecord(record?.output_video) ?? asRecord(record?.outputVideo);
  if (outputVideo) {
    candidates.push({ type: 'video', ...outputVideo });
  }
  if (Array.isArray(record?.steps)) {
    for (const step of record.steps) {
      const stepRecord = asRecord(step);
      if (Array.isArray(stepRecord?.content)) {
        candidates.push(...stepRecord.content);
      }
    }
  }
  for (const key of ['output', 'outputs', 'response']) {
    const value = record?.[key];
    if (Array.isArray(value)) candidates.push(...value);
    const valueRecord = asRecord(value);
    if (Array.isArray(valueRecord?.content)) candidates.push(...valueRecord.content);
    if (Array.isArray(valueRecord?.videos)) candidates.push(...valueRecord.videos);
  }
  return candidates.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item));
}

export function extractGoogleVertexOmniVideoOutput(raw: unknown): GoogleVertexOmniVideoOutput | null {
  const video = contentBlocks(raw).find((block) => block.type === 'video' || block.mime_type === 'video/mp4');
  if (!video) return null;
  const uri = cleanString(video.uri) ?? cleanString(video.url) ?? cleanString(video.video_url);
  const data = cleanString(video.data);
  const mimeType = cleanString(video.mime_type) ?? cleanString(video.mimeType) ?? 'video/mp4';
  if (!uri && !data) return null;
  return { uri, data, mimeType };
}

export function normalizeGoogleVertexOmniInteraction(
  raw: unknown,
  fallbackInteractionId?: string | null
): NormalizedVideoProviderTask {
  const record = asRecord(raw);
  const providerJobId = cleanString(record?.id) ?? cleanString(record?.name) ?? cleanString(fallbackInteractionId) ?? '';
  const rawStatus = cleanString(record?.status);
  const errorMessage = extractErrorMessage(raw);
  const output = extractGoogleVertexOmniVideoOutput(raw);

  const status: NormalizedVideoProviderTask['status'] = errorMessage
    ? 'failed'
    : rawStatus === 'failed' || rawStatus === 'cancelled' || rawStatus === 'incomplete'
      ? 'failed'
      : rawStatus === 'completed' && output
        ? 'completed'
        : rawStatus === 'completed'
          ? 'failed'
          : rawStatus === 'queued'
            ? 'queued'
            : 'running';

  return {
    providerJobId,
    status,
    rawStatus,
    videoUrl: output?.uri ?? null,
    message:
      errorMessage ??
      (rawStatus === 'completed' && !output ? 'Gemini Omni Flash completed without a video output.' : null),
    usage: extractUsage(raw),
    raw,
  };
}
