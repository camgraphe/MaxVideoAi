import {
  BACKGROUND_REMOVAL_DYNAMIC_MARGIN_MULTIPLIER,
  BACKGROUND_REMOVAL_MAX_STUDIO_DURATION_SECONDS,
  BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND,
} from '@/config/tools-background-removal-engines';
import type {
  BackgroundRemovalOutputCodec,
  BackgroundRemovalStudioBackgroundColor,
} from '@/types/tools-background-removal';

export const BACKGROUND_REMOVAL_STUDIO_COLORS: readonly BackgroundRemovalStudioBackgroundColor[] = [
  'Transparent',
  'Black',
  'White',
  'Gray',
  'Red',
  'Green',
  'Blue',
  'Yellow',
  'Cyan',
  'Magenta',
  'Orange',
] as const;

export const BACKGROUND_REMOVAL_OUTPUT_CODECS: readonly BackgroundRemovalOutputCodec[] = [
  'mov_proresks',
  'webm_vp9',
  'mp4_h264',
  'mp4_h265',
  'mov_h265',
  'mkv_h265',
  'mkv_h264',
  'mkv_vp9',
  'avi_h264',
  'gif',
] as const;

export type BackgroundRemovalPricingPreview = {
  totalCents: number | null;
  currency: string;
  ready: boolean;
  estimate: {
    durationSec: number;
    providerEstimateUsd: number;
  } | null;
};

export function resolveStudioBackgroundColor(value?: string | null): BackgroundRemovalStudioBackgroundColor {
  return BACKGROUND_REMOVAL_STUDIO_COLORS.includes(value as BackgroundRemovalStudioBackgroundColor)
    ? (value as BackgroundRemovalStudioBackgroundColor)
    : 'Transparent';
}

export function resolveOutputCodec(value?: string | null): BackgroundRemovalOutputCodec {
  return BACKGROUND_REMOVAL_OUTPUT_CODECS.includes(value as BackgroundRemovalOutputCodec)
    ? (value as BackgroundRemovalOutputCodec)
    : 'mov_proresks';
}

export function getBackgroundRemovalOutputExtension(codec: BackgroundRemovalOutputCodec): string {
  if (codec === 'gif') return 'gif';
  if (codec.startsWith('webm_')) return 'webm';
  if (codec.startsWith('mov_')) return 'mov';
  if (codec.startsWith('mkv_')) return 'mkv';
  if (codec.startsWith('avi_')) return 'avi';
  return 'mp4';
}

export function formatBackgroundRemovalOutputCodecLabel(codec: BackgroundRemovalOutputCodec): string {
  const labels: Record<BackgroundRemovalOutputCodec, string> = {
    mov_proresks: 'MOV ProRes + alpha (Premiere)',
    webm_vp9: 'WebM VP9 + alpha (web)',
    mp4_h264: 'MP4 H.264 (solid background)',
    mp4_h265: 'MP4 H.265 (solid background)',
    mov_h265: 'MOV H.265 (solid background)',
    mkv_h265: 'MKV H.265',
    mkv_h264: 'MKV H.264',
    mkv_vp9: 'MKV VP9',
    avi_h264: 'AVI H.264',
    gif: 'GIF',
  };
  return labels[codec] ?? codec;
}

export function estimateBackgroundRemovalCostUsd(durationSec: number): number {
  const seconds = Math.max(1, Math.ceil(durationSec));
  return Number(
    (
      seconds *
      BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND *
      BACKGROUND_REMOVAL_DYNAMIC_MARGIN_MULTIPLIER
    ).toFixed(4)
  );
}

export function buildBackgroundRemovalPricingPreview(params: {
  unitPriceCents?: number | null;
  currency?: string | null;
  durationSec?: number | null;
}): BackgroundRemovalPricingPreview {
  const unitPriceCents =
    typeof params.unitPriceCents === 'number' && Number.isFinite(params.unitPriceCents)
      ? Math.max(0, Math.round(params.unitPriceCents))
      : null;
  const currency =
    typeof params.currency === 'string' && params.currency.trim() ? params.currency.trim().toUpperCase() : 'USD';
  const durationSec =
    typeof params.durationSec === 'number' && Number.isFinite(params.durationSec) && params.durationSec > 0
      ? Math.ceil(params.durationSec)
      : null;

  if (!durationSec || typeof unitPriceCents !== 'number') {
    return {
      totalCents: unitPriceCents,
      currency,
      ready: false,
      estimate: null,
    };
  }

  const providerEstimateUsd = estimateBackgroundRemovalCostUsd(durationSec);
  const dynamicCents = Math.max(1, Math.ceil(providerEstimateUsd * 100));

  return {
    totalCents: Math.max(unitPriceCents, dynamicCents),
    currency,
    ready: true,
    estimate: {
      durationSec,
      providerEstimateUsd,
    },
  };
}

export function buildBackgroundRemovalFalInput(params: {
  videoUrl: string;
  backgroundColor?: string | null;
  outputCodec?: string | null;
  preserveAudio?: boolean | null;
}) {
  return {
    video_url: params.videoUrl,
    background_color: resolveStudioBackgroundColor(params.backgroundColor),
    output_container_and_codec: resolveOutputCodec(params.outputCodec),
    preserve_audio: params.preserveAudio !== false,
  };
}

export function validateBackgroundRemovalDuration(durationSec?: number | null): string | null {
  if (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec <= 0) {
    return 'Video metadata is required before background removal.';
  }
  if (durationSec > BACKGROUND_REMOVAL_MAX_STUDIO_DURATION_SECONDS) {
    return `Studio background removal supports clips up to ${BACKGROUND_REMOVAL_MAX_STUDIO_DURATION_SECONDS} seconds in this release.`;
  }
  return null;
}
