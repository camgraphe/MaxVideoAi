import type { NormalizedVideoProviderTask } from '../types';

export type GoogleVertexVeoOutput = {
  bytesBase64Encoded: string | null;
  gcsUri: string | null;
  mimeType: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function extractErrorMessage(raw: unknown): string | null {
  const record = asRecord(raw);
  const error = asRecord(record?.error);
  const message = error?.message ?? record?.message;
  return typeof message === 'string' && message.trim() ? message.trim() : null;
}

export function extractGoogleVertexVeoOutput(raw: unknown): GoogleVertexVeoOutput | null {
  const record = asRecord(raw);
  const response = asRecord(record?.response) ?? record;
  const videos = Array.isArray(response?.videos) ? response.videos : [];
  const firstVideo = videos.map(asRecord).find((video): video is Record<string, unknown> => Boolean(video));
  if (!firstVideo) return null;
  const bytesBase64Encoded =
    typeof firstVideo.bytesBase64Encoded === 'string' && firstVideo.bytesBase64Encoded.length
      ? firstVideo.bytesBase64Encoded
      : null;
  const gcsUri = typeof firstVideo.gcsUri === 'string' && firstVideo.gcsUri.length ? firstVideo.gcsUri : null;
  const mimeType = typeof firstVideo.mimeType === 'string' && firstVideo.mimeType.length ? firstVideo.mimeType : 'video/mp4';
  if (!bytesBase64Encoded && !gcsUri) return null;
  return { bytesBase64Encoded, gcsUri, mimeType };
}

export function normalizeGoogleVertexVeoOperation(raw: unknown, fallbackOperationName?: string | null): NormalizedVideoProviderTask {
  const record = asRecord(raw);
  const operationName =
    (typeof record?.name === 'string' && record.name.trim()) ||
    (typeof fallbackOperationName === 'string' && fallbackOperationName.trim()) ||
    '';
  const errorMessage = extractErrorMessage(raw);
  const done = record?.done === true;
  const output = extractGoogleVertexVeoOutput(raw);
  const raiMediaFilteredCount =
    typeof asRecord(record?.response)?.raiMediaFilteredCount === 'number'
      ? (asRecord(record?.response)?.raiMediaFilteredCount as number)
      : 0;
  const status: NormalizedVideoProviderTask['status'] = errorMessage
    ? 'failed'
    : done && output
      ? 'completed'
      : done && raiMediaFilteredCount > 0
        ? 'failed'
        : done
          ? 'failed'
          : 'running';

  return {
    providerJobId: operationName,
    status,
    rawStatus: done ? 'done' : 'running',
    videoUrl: output?.gcsUri ?? null,
    message:
      errorMessage ??
      (done && !output && raiMediaFilteredCount > 0
        ? 'Google Vertex Veo filtered this render due to safety policy.'
        : done && !output
          ? 'Google Vertex Veo completed without a video output.'
          : null),
    usage: null,
    raw,
  };
}

