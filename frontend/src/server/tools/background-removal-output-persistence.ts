import { getBackgroundRemovalOutputExtension } from '@/lib/tools-background-removal';
import { isStorageConfigured, recordUserAsset, uploadFileBuffer } from '@/server/storage';
import { createUploadVideoThumbnail } from '@/server/upload-thumbnails';
import type {
  BackgroundRemovalEngineId,
  BackgroundRemovalOutputCodec,
  BackgroundRemovalToolOutput,
} from '@/types/tools-background-removal';
import { formatBackgroundRemovalVideoMime } from './background-removal-request-utils';

export const BACKGROUND_REMOVAL_PRORES_RETENTION_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function buildBackgroundRemovalOutputRetentionMetadata(
  outputCodec: BackgroundRemovalOutputCodec | 'mov_proresks',
  now = new Date()
): { premiumFormat: boolean; retentionDays: number | null; expiresAt: string | null } {
  if (outputCodec !== 'mov_proresks') {
    return {
      premiumFormat: false,
      retentionDays: null,
      expiresAt: null,
    };
  }

  return {
    premiumFormat: true,
    retentionDays: BACKGROUND_REMOVAL_PRORES_RETENTION_DAYS,
    expiresAt: new Date(now.getTime() + BACKGROUND_REMOVAL_PRORES_RETENTION_DAYS * MS_PER_DAY).toISOString(),
  };
}

function resolveOutputFetchTimeoutMs(durationSec?: number | null): number {
  const seconds =
    typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0 ? Math.ceil(durationSec) : 1;
  return Math.min(10 * 60_000, Math.max(60_000, seconds * 4_000));
}

export async function persistBackgroundRemovalOutput(params: {
  output: BackgroundRemovalToolOutput;
  userId: string;
  jobId: string;
  providerJobId?: string | null;
  engineId: BackgroundRemovalEngineId;
  engineLabel: string;
  outputCodec: BackgroundRemovalOutputCodec;
  durationSec?: number | null;
}): Promise<BackgroundRemovalToolOutput> {
  const { output, userId, jobId, providerJobId, engineId, engineLabel, outputCodec, durationSec } = params;
  if (!isStorageConfigured() || !output.url) return output;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), resolveOutputFetchTimeoutMs(durationSec));
    let response: Response;
    try {
      response = await fetch(output.url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`fetch failed (${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error('empty output');

    const mimeHeader = response.headers.get('content-type') ?? '';
    const codecMime = formatBackgroundRemovalVideoMime(outputCodec);
    const mime =
      mimeHeader.startsWith('video/') || mimeHeader === 'image/gif'
        ? mimeHeader
        : typeof output.mimeType === 'string' && output.mimeType === codecMime
          ? output.mimeType
          : codecMime;
    const extension = getBackgroundRemovalOutputExtension(outputCodec);
    const retention = buildBackgroundRemovalOutputRetentionMetadata(outputCodec);
    const upload = await uploadFileBuffer({
      data: buffer,
      mime,
      userId,
      prefix: 'background-removal',
      fileName: `background-removal-${engineId}.${extension}`,
    });
    const thumbUrl =
      mime === 'image/gif'
        ? null
        : await createUploadVideoThumbnail({
            data: buffer,
            userId,
            fileName: `background-removal-${engineId}`,
          }).catch(() => null);
    const assetId = await recordUserAsset({
      userId,
      url: upload.url,
      mime,
      width: output.width ?? null,
      height: output.height ?? null,
      size: buffer.length,
      source: 'background-removal',
      metadata: {
        originUrl: output.url,
        jobId,
        providerJobId: providerJobId ?? null,
        tool: 'background-removal',
        engineId,
        engineLabel,
        thumbUrl,
        outputCodec,
        premiumFormat: retention.premiumFormat,
        retentionDays: retention.retentionDays,
        expiresAt: retention.expiresAt,
      },
    });

    return {
      ...output,
      url: upload.url,
      thumbUrl: thumbUrl ?? output.thumbUrl ?? null,
      mimeType: mime,
      originUrl: output.url,
      assetId,
      source: 'background-removal',
      persisted: true,
    };
  } catch (error) {
    console.warn('[tools/background-removal] failed to persist output', {
      engineId,
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return output;
  }
}
