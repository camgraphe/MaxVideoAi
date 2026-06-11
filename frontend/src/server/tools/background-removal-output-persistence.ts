import { isStorageConfigured, recordUserAsset, uploadFileBuffer } from '@/server/storage';
import { createUploadVideoThumbnail } from '@/server/upload-thumbnails';
import type {
  BackgroundRemovalEngineId,
  BackgroundRemovalOutputCodec,
  BackgroundRemovalToolOutput,
} from '@/types/tools-background-removal';
import { formatBackgroundRemovalVideoMime } from './background-removal-request-utils';

function resolveOutputFetchTimeoutMs(durationSec?: number | null): number {
  const seconds =
    typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0 ? Math.ceil(durationSec) : 1;
  return Math.min(10 * 60_000, Math.max(60_000, seconds * 4_000));
}

function outputCodecExtension(codec: BackgroundRemovalOutputCodec): string {
  if (codec === 'gif') return 'gif';
  if (codec.startsWith('webm_')) return 'webm';
  if (codec.startsWith('mov_')) return 'mov';
  if (codec.startsWith('mkv_')) return 'mkv';
  if (codec.startsWith('avi_')) return 'avi';
  return 'mp4';
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
    const mime =
      typeof output.mimeType === 'string' && (output.mimeType.startsWith('video/') || output.mimeType === 'image/gif')
        ? output.mimeType
        : mimeHeader.startsWith('video/') || mimeHeader === 'image/gif'
          ? mimeHeader
          : formatBackgroundRemovalVideoMime(outputCodec);
    const extension = outputCodecExtension(outputCodec);
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
