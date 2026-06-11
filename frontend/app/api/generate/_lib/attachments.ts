import { uploadImageToStorage, isAllowedAssetHost, probeImageUrl, recordUserAsset } from '@/server/storage';

export type NormalizedAttachment = {
  name: string;
  type: string;
  size: number;
  kind?: 'image' | 'video' | 'audio';
  slotId?: string;
  label?: string;
  url?: string;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  assetId?: string;
};

type AttachmentProcessingErrorBody =
  | {
      ok: false;
      error: 'INVALID_VIDEO_ASSET' | 'INVALID_AUDIO_ASSET' | 'INLINE_ASSET_UNSUPPORTED' | 'IMAGE_UPLOAD_FAILED';
      message?: string;
    }
  | {
      ok: false;
      error: 'IMAGE_HOST_NOT_ALLOWED' | 'IMAGE_UNREACHABLE';
      url: string;
    };

type AttachmentProcessingResult =
  | {
      ok: true;
      attachments: NormalizedAttachment[];
    }
  | {
      ok: false;
      status: 400 | 422 | 500;
      body: AttachmentProcessingErrorBody;
    };

function decodeDataUrl(value: string): { buffer: Buffer; mime: string } {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(value);
  if (!match) {
    throw new Error('Invalid data URL');
  }
  const [, mime, base64] = match;
  return {
    mime,
    buffer: Buffer.from(base64, 'base64'),
  };
}

function positiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export async function processGenerationAttachments(params: {
  rawInputs: unknown;
  userId: string;
}): Promise<AttachmentProcessingResult> {
  const rawAttachments = Array.isArray(params.rawInputs) ? params.rawInputs : [];
  const processedAttachments: NormalizedAttachment[] = [];

  for (const entry of rawAttachments) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Record<string, unknown>;
    const base: NormalizedAttachment = {
      name: typeof candidate.name === 'string' ? candidate.name : 'attachment',
      type: typeof candidate.type === 'string' ? candidate.type : 'application/octet-stream',
      size: typeof candidate.size === 'number' ? candidate.size : 0,
      kind:
        candidate.kind === 'image' || candidate.kind === 'video' || candidate.kind === 'audio'
          ? (candidate.kind as 'image' | 'video' | 'audio')
          : undefined,
      slotId: typeof candidate.slotId === 'string' ? candidate.slotId : undefined,
      label: typeof candidate.label === 'string' ? candidate.label : undefined,
    };

    const urlCandidate = typeof candidate.url === 'string' ? candidate.url.trim() : null;
    const dataUrlCandidate = typeof candidate.dataUrl === 'string' ? candidate.dataUrl.trim() : null;
    const width = typeof candidate.width === 'number' ? candidate.width : null;
    const height = typeof candidate.height === 'number' ? candidate.height : null;
    const durationSec = positiveNumber(candidate.durationSec ?? candidate.duration ?? candidate.mediaDurationSec);
    const assetId = typeof candidate.assetId === 'string' ? candidate.assetId : undefined;
    const declaredMimeType = base.type.trim().toLowerCase();

    if (
      base.kind === 'video' &&
      declaredMimeType &&
      declaredMimeType !== 'application/octet-stream' &&
      !declaredMimeType.startsWith('video/')
    ) {
      return {
        ok: false,
        status: 422,
        body: {
          ok: false,
          error: 'INVALID_VIDEO_ASSET',
          message: 'The selected source is not a video. Choose an MP4/MOV clip and try again.',
        },
      };
    }

    if (
      base.kind === 'audio' &&
      declaredMimeType &&
      declaredMimeType !== 'application/octet-stream' &&
      !declaredMimeType.startsWith('audio/')
    ) {
      return {
        ok: false,
        status: 422,
        body: {
          ok: false,
          error: 'INVALID_AUDIO_ASSET',
          message: 'The selected source is not an audio file. Choose an audio clip and try again.',
        },
      };
    }

    if (urlCandidate) {
      if (!isAllowedAssetHost(urlCandidate)) {
        return {
          ok: false,
          status: 422,
          body: { ok: false, error: 'IMAGE_HOST_NOT_ALLOWED', url: urlCandidate },
        };
      }

      let sizeBytes = base.size;
      let mimeType = base.type;
      if (base.kind === 'image' && (!sizeBytes || !mimeType || mimeType === 'application/octet-stream')) {
        const probe = await probeImageUrl(urlCandidate);
        if (!probe.ok) {
          return {
            ok: false,
            status: 422,
            body: { ok: false, error: 'IMAGE_UNREACHABLE', url: urlCandidate },
          };
        }
        sizeBytes = sizeBytes || probe.size || 0;
        mimeType = mimeType === 'application/octet-stream' && probe.mime ? probe.mime : mimeType;
      }

      processedAttachments.push({
        ...base,
        type: mimeType,
        size: sizeBytes,
        url: urlCandidate,
        width,
        height,
        ...(durationSec ? { durationSec } : {}),
        assetId,
      });
      continue;
    }

    if (dataUrlCandidate && dataUrlCandidate.startsWith('data:')) {
      if (base.kind && base.kind !== 'image') {
        return {
          ok: false,
          status: 400,
          body: {
            ok: false,
            error: 'INLINE_ASSET_UNSUPPORTED',
            message: 'Inline audio/video uploads are not supported.',
          },
        };
      }

      const { buffer, mime } = decodeDataUrl(dataUrlCandidate);
      let uploadResult;
      try {
        uploadResult = await uploadImageToStorage({
          data: buffer,
          mime,
          userId: params.userId,
          fileName: base.name,
          prefix: 'inline',
        });
      } catch (error) {
        console.error('[generate] failed to upload inline attachment', error);
        return { ok: false, status: 500, body: { ok: false, error: 'IMAGE_UPLOAD_FAILED' } };
      }

      try {
        const assetIdCreated = await recordUserAsset({
          userId: params.userId,
          url: uploadResult.url,
          mime: uploadResult.mime,
          width: uploadResult.width,
          height: uploadResult.height,
          size: uploadResult.size,
          source: 'inline',
          metadata: { originalName: base.name, kind: 'image' },
        });

        processedAttachments.push({
          ...base,
          type: uploadResult.mime,
          size: uploadResult.size,
          url: uploadResult.url,
          width: uploadResult.width,
          height: uploadResult.height,
          assetId: assetIdCreated,
        });
      } catch (error) {
        console.error('[generate] failed to record inline asset', error);
      }
      continue;
    }
  }

  return { ok: true, attachments: processedAttachments };
}
