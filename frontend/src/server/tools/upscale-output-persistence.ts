import { resolveUpscaleOutputFetchTimeoutMs } from '@/lib/tools-upscale';
import { isStorageConfigured, recordUserAsset, uploadFileBuffer, uploadImageToStorage } from '@/server/storage';
import type { UpscaleMediaType, UpscaleOutputFormat, UpscaleToolEngineId, UpscaleToolOutput } from '@/types/tools-upscale';
import { formatToImageMime, formatToVideoMime } from './upscale-request-utils';

export async function persistUpscaleOutput(params: {
  output: UpscaleToolOutput;
  mediaType: UpscaleMediaType;
  userId: string;
  jobId: string;
  providerJobId?: string | null;
  engineId: UpscaleToolEngineId;
  engineLabel: string;
  outputFormat: UpscaleOutputFormat;
  durationSec?: number | null;
}): Promise<UpscaleToolOutput> {
  const { output, mediaType, userId, jobId, providerJobId, engineId, engineLabel, outputFormat, durationSec } = params;
  if (!isStorageConfigured() || !output.url) return output;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      resolveUpscaleOutputFetchTimeoutMs({ mediaType, durationSec })
    );
    let response: Response;
    try {
      response = await fetch(output.url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`fetch failed (${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error('empty output');

    if (mediaType === 'image') {
      const mimeHeader = response.headers.get('content-type') ?? '';
      const mime =
        typeof output.mimeType === 'string' && output.mimeType.startsWith('image/')
          ? output.mimeType
          : mimeHeader.startsWith('image/')
            ? mimeHeader
            : formatToImageMime(outputFormat);
      const upload = await uploadImageToStorage({
        data: buffer,
        mime,
        userId,
        prefix: 'upscale',
        fileName: `upscale-${engineId}.${mime.split('/')[1] || 'png'}`,
      });
      const assetId = await recordUserAsset({
        userId,
        url: upload.url,
        mime: upload.mime,
        width: upload.width ?? output.width ?? null,
        height: upload.height ?? output.height ?? null,
        size: upload.size,
        source: 'upscale',
        metadata: {
          originUrl: output.url,
          jobId,
          providerJobId: providerJobId ?? null,
          tool: 'upscale',
          engineId,
          engineLabel,
        },
      });
      return {
        ...output,
        url: upload.url,
        width: upload.width ?? output.width ?? null,
        height: upload.height ?? output.height ?? null,
        mimeType: upload.mime,
        originUrl: output.url,
        assetId,
        source: 'upscale',
        persisted: true,
      };
    }

    const mimeHeader = response.headers.get('content-type') ?? '';
    const mime =
      typeof output.mimeType === 'string' && (output.mimeType.startsWith('video/') || output.mimeType === 'image/gif')
        ? output.mimeType
        : mimeHeader.startsWith('video/') || mimeHeader === 'image/gif'
          ? mimeHeader
          : formatToVideoMime(outputFormat);
    const upload = await uploadFileBuffer({
      data: buffer,
      mime,
      userId,
      prefix: 'upscale',
      fileName: `upscale-${engineId}.${outputFormat === 'gif' ? 'gif' : outputFormat}`,
    });
    const assetId = await recordUserAsset({
      userId,
      url: upload.url,
      mime,
      width: output.width ?? null,
      height: output.height ?? null,
      size: buffer.length,
      source: 'upscale',
      metadata: {
        originUrl: output.url,
        jobId,
        providerJobId: providerJobId ?? null,
        tool: 'upscale',
        engineId,
        engineLabel,
      },
    });
    return {
      ...output,
      url: upload.url,
      mimeType: mime,
      originUrl: output.url,
      assetId,
      source: 'upscale',
      persisted: true,
    };
  } catch (error) {
    console.warn('[tools/upscale] failed to persist output', {
      engineId,
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return output;
  }
}
