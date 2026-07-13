import type { Mode } from '@/types/engines';
import { resolveSourceVideoDurationSec } from './attachment-references';
import type { NormalizedAttachment } from './attachments';

type SourceVideoContextParams = {
  mode: Mode;
  attachments: NormalizedAttachment[];
  sourceInputVideoUrl?: string;
  videoUrls: string[];
  fallbackDurationSec: number;
  fallbackDurationLabel?: string;
  maxDurationSec?: number | null;
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
