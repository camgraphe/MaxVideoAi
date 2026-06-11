import {
  BACKGROUND_REMOVAL_DYNAMIC_MARGIN_MULTIPLIER,
  BACKGROUND_REMOVAL_MAX_STUDIO_DURATION_SECONDS,
  BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND,
  BACKGROUND_REMOVAL_REALTIME_SESSION_SECONDS,
} from '@/config/tools-background-removal-engines';
import type {
  BackgroundRemovalOutputCodec,
  BackgroundRemovalRealtimeBackgroundColor,
  BackgroundRemovalRealtimeBackgroundType,
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

export const BACKGROUND_REMOVAL_REALTIME_COLORS: readonly BackgroundRemovalRealtimeBackgroundColor[] = [
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
  'mp4_h265',
  'mp4_h264',
  'webm_vp9',
  'mov_h265',
  'mov_proresks',
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

export function resolveRealtimeBackgroundColor(value?: string | null): BackgroundRemovalRealtimeBackgroundColor {
  return BACKGROUND_REMOVAL_REALTIME_COLORS.includes(value as BackgroundRemovalRealtimeBackgroundColor)
    ? (value as BackgroundRemovalRealtimeBackgroundColor)
    : 'Black';
}

export function resolveOutputCodec(value?: string | null): BackgroundRemovalOutputCodec {
  return BACKGROUND_REMOVAL_OUTPUT_CODECS.includes(value as BackgroundRemovalOutputCodec)
    ? (value as BackgroundRemovalOutputCodec)
    : 'webm_vp9';
}

export function clampRealtimeBlurStrength(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function resolveRealtimeBackgroundType(value?: string | null): BackgroundRemovalRealtimeBackgroundType {
  return value === 'image' || value === 'blur' ? value : 'color';
}

export function resolveRealtimeSessionSeconds(value?: number | null): 30 | 60 | 120 {
  return BACKGROUND_REMOVAL_REALTIME_SESSION_SECONDS.includes(value as 30 | 60 | 120)
    ? (value as 30 | 60 | 120)
    : 60;
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

export function buildBackgroundRemovalRealtimeInput(params: {
  backgroundType?: string | null;
  backgroundColor?: string | null;
  blurStrength?: number | null;
  backgroundImageUrl?: string | null;
}) {
  const backgroundType = resolveRealtimeBackgroundType(params.backgroundType);
  const input: {
    background_type: BackgroundRemovalRealtimeBackgroundType;
    background_color?: BackgroundRemovalRealtimeBackgroundColor;
    blur_strength?: number;
    background_image_url?: string;
  } = {
    background_type: backgroundType,
  };
  if (backgroundType === 'color') {
    input.background_color = resolveRealtimeBackgroundColor(params.backgroundColor);
  }
  if (backgroundType === 'blur') {
    input.blur_strength = clampRealtimeBlurStrength(params.blurStrength);
  }
  if (backgroundType === 'image' && params.backgroundImageUrl?.trim()) {
    input.background_image_url = params.backgroundImageUrl.trim();
  }
  return input;
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
