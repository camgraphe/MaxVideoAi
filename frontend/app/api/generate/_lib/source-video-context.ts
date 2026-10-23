import { validateKlingEditSource } from '@/lib/video-operation';
import { isLumaSourceVideoMode, validateLumaSourceVideoTiming, lumaModifyTariffDurationSec, LUMA_MODIFY_SOURCE_MAX_SEC, LUMA_REFRAME_SOURCE_MAX_SEC } from '@/lib/luma-source-video';
import type { Mode } from '@/types/engines';
import { resolveSourceVideoDurationSec } from './attachment-references';
import type { NormalizedAttachment } from './attachments';

type SourceVideoContextParams = {
  operation?: import('@/lib/video-operation').VideoOperation;
  engineId?: string;
  trustedSourceVideo?: { url: string; durationSec?: number | null; width?: number | null; height?: number | null };
  mode: Mode;
  attachments: NormalizedAttachment[];
  sourceInputVideoUrl?: string;
  videoUrls: string[];
  fallbackDurationSec: number;
  fallbackDurationLabel?: string;
  maxDurationSec?: number | null;
  maxSourcePlusOutputDurationSec?: number;
  inputVideoDurationSec?: number;
  engineLabel: string;
};

type SourceVideoContextResult =
  | {
      ok: true;
      durationSec: number;
      durationLabel: string | undefined;
      hasVideoInput: boolean;
    }
  | {
      ok: false;
      status: 422;
      body: {
        ok: false;
        error: 'SOURCE_VIDEO_DURATION_UNSUPPORTED';
        message: string;
      };
      metric: {
        errorCode: 'SOURCE_VIDEO_DURATION_UNSUPPORTED';
        meta: {
          sourceDurationSec: number | null;
          maxDurationSec: number;
          mode: Mode;
        };
      };
    };

export function resolveGenerateSourceVideoContext(params: SourceVideoContextParams): SourceVideoContextResult {
  if (params.operation === 'kling-edit') {
    const seconds = params.trustedSourceVideo?.url === params.sourceInputVideoUrl ? params.trustedSourceVideo?.durationSec : undefined;
    const sourceError = validateKlingEditSource(params.trustedSourceVideo);
    if (sourceError || typeof seconds !== 'number') return {
      ok: false, status: 422, body: { ok: false, error: 'SOURCE_VIDEO_DURATION_UNSUPPORTED', message: sourceError ?? 'Kling Edit requires a verified source.' },
      metric: { errorCode: 'SOURCE_VIDEO_DURATION_UNSUPPORTED', meta: { sourceDurationSec: seconds ?? null, maxDurationSec: 15, mode: params.mode } } };
    return { ok: true, durationSec: seconds, durationLabel: `${seconds}s`, hasVideoInput: true };
  }
  if (isLumaSourceVideoMode(params.engineId, params.mode)) {
    const sourceDurationSec = params.trustedSourceVideo?.url === params.sourceInputVideoUrl
      ? params.trustedSourceVideo?.durationSec : undefined;
    const message = validateLumaSourceVideoTiming({ engineId: params.engineId, mode: params.mode,
      sourceDurationSec, durationSec: params.fallbackDurationSec });
    if (message) return { ok: false, status: 422,
      body: { ok: false, error: 'SOURCE_VIDEO_DURATION_UNSUPPORTED', message },
      metric: { errorCode: 'SOURCE_VIDEO_DURATION_UNSUPPORTED', meta: {
        sourceDurationSec: sourceDurationSec ?? null, mode: params.mode,
        maxDurationSec: params.mode === 'v2v' ? LUMA_MODIFY_SOURCE_MAX_SEC : LUMA_REFRAME_SOURCE_MAX_SEC } } };
    const durationSec = params.mode === 'v2v' ? lumaModifyTariffDurationSec(sourceDurationSec!) : params.fallbackDurationSec;
    return { ok: true, durationSec, durationLabel: `${durationSec}s`, hasVideoInput: true };
  }
  const sourceVideoDuration = resolveSourceVideoDurationSec({
    mode: params.mode,
    attachments: params.attachments,
    sourceInputVideoUrl: params.sourceInputVideoUrl,
    fallbackDurationSec: params.fallbackDurationSec,
    maxDurationSec: params.maxDurationSec,
  });
  if (sourceVideoDuration.exceedsMax) {
    const maxDurationSec = sourceVideoDuration.maxDurationSec ?? 30;
    return {
      ok: false,
      status: 422,
      body: {
        ok: false,
        error: 'SOURCE_VIDEO_DURATION_UNSUPPORTED',
        message: `Source video must be ${maxDurationSec}s or shorter for ${params.engineLabel}.`,
      },
      metric: {
        errorCode: 'SOURCE_VIDEO_DURATION_UNSUPPORTED',
        meta: {
          sourceDurationSec: sourceVideoDuration.sourceDurationSec,
          maxDurationSec,
          mode: params.mode,
        },
      },
    };
  }

  const totalMaximum = params.maxSourcePlusOutputDurationSec;
  const inputVideoDurationSec = params.inputVideoDurationSec
    ?? (params.mode === 'v2v' || params.mode === 'extend' ? sourceVideoDuration.sourceDurationSec : null);
  if (typeof totalMaximum === 'number' && Number.isFinite(totalMaximum) && totalMaximum > 0
    && inputVideoDurationSec != null
    && inputVideoDurationSec + sourceVideoDuration.durationSec > totalMaximum) {
    return {
      ok: false,
      status: 422,
      body: {
        ok: false,
        error: 'SOURCE_VIDEO_DURATION_UNSUPPORTED',
        message: `Source video plus generated duration must be ${totalMaximum}s or shorter for ${params.engineLabel}.`,
      },
      metric: {
        errorCode: 'SOURCE_VIDEO_DURATION_UNSUPPORTED',
        meta: {
          sourceDurationSec: inputVideoDurationSec,
          maxDurationSec: totalMaximum - sourceVideoDuration.durationSec,
          mode: params.mode,
        },
      },
    };
  }

  return {
    ok: true,
    durationSec: sourceVideoDuration.durationSec,
    durationLabel: sourceVideoDuration.durationLabel ?? params.fallbackDurationLabel,
    hasVideoInput:
      params.videoUrls.length > 0 ||
      Boolean(params.sourceInputVideoUrl) ||
      params.mode === 'v2v' ||
      params.mode === 'extend',
  };
}
