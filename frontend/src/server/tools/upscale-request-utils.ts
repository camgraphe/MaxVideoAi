import { ValidationError } from '@fal-ai/client';
import { normalizeMediaUrl } from '@/lib/media';
import { getTargetResolutionHeight } from '@/lib/tools-upscale';
import type { PricingSnapshot } from '@/types/engines';
import type {
  UpscaleMediaType,
  UpscaleOutputFormat,
  UpscaleTargetResolution,
  UpscaleToolEngineDefinition,
  UpscaleToolOutput,
} from '@/types/tools-upscale';

export const UPSCALE_SURFACE = 'upscale' as const;

export type VideoMetadata = {
  width: number;
  height: number;
  durationSec: number;
  fps: number;
};

function normalizeFalUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://fal.media/files/${trimmed.replace(/^\.?\/+/, '')}`;
}

export function formatToImageMime(format: UpscaleOutputFormat): string {
  if (format === 'png') return 'image/png';
  if (format === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export function formatToVideoMime(format: UpscaleOutputFormat): string {
  if (format === 'webm') return 'video/webm';
  if (format === 'mov') return 'video/quicktime';
  if (format === 'gif') return 'image/gif';
  return 'video/mp4';
}

function seedVideoFormat(format: UpscaleOutputFormat): string {
  if (format === 'webm') return 'VP9 (.webm)';
  if (format === 'mov') return 'PRORES4444 (.mov)';
  if (format === 'gif') return 'GIF (.gif)';
  return 'X264 (.mp4)';
}

function toUpscaleOutput(entry: Record<string, unknown>, mediaType: UpscaleMediaType): UpscaleToolOutput | null {
  const urlRaw =
    typeof entry.url === 'string'
      ? entry.url
      : typeof entry.image_url === 'string'
        ? entry.image_url
        : typeof entry.video_url === 'string'
          ? entry.video_url
          : typeof entry.path === 'string'
            ? entry.path
            : null;
  if (!urlRaw) return null;

  const width = typeof entry.width === 'number' ? entry.width : null;
  const height = typeof entry.height === 'number' ? entry.height : null;
  const mimeType =
    typeof entry.content_type === 'string'
      ? entry.content_type
      : typeof entry.mimetype === 'string'
        ? entry.mimetype
        : typeof entry.mime === 'string'
          ? entry.mime
          : mediaType === 'video'
            ? 'video/mp4'
            : 'image/png';

  const url = normalizeFalUrl(urlRaw);
  return {
    url: normalizeMediaUrl(url) ?? url,
    width,
    height,
    mimeType,
  };
}

export function extractUpscaleOutput(payload: unknown, mediaType: UpscaleMediaType): UpscaleToolOutput | null {
  const roots: unknown[] = [];
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    roots.push(record);
    if (record.output && typeof record.output === 'object') roots.push(record.output);
    if (record.response && typeof record.response === 'object') roots.push(record.response);
    if (record.data && typeof record.data === 'object') roots.push(record.data);
  }

  for (const root of roots) {
    if (!root || typeof root !== 'object') continue;
    const record = root as Record<string, unknown>;
    const key = mediaType === 'video' ? 'video' : 'image';

    if (record[key] && typeof record[key] === 'object') {
      const output = toUpscaleOutput(record[key] as Record<string, unknown>, mediaType);
      if (output) return output;
    }

    if (Array.isArray(record.images) && mediaType === 'image') {
      for (const entry of record.images) {
        if (entry && typeof entry === 'object') {
          const output = toUpscaleOutput(entry as Record<string, unknown>, mediaType);
          if (output) return output;
        }
      }
    }

    if (typeof record.url === 'string') {
      const output = toUpscaleOutput(record, mediaType);
      if (output) return output;
    }
  }
  return null;
}

export function parseUpscaleRequestId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.request_id === 'string') return record.request_id;
  if (typeof record.id === 'string') return record.id;
  if (record.response && typeof record.response === 'object') {
    const responseRecord = record.response as Record<string, unknown>;
    if (typeof responseRecord.request_id === 'string') return responseRecord.request_id;
    if (typeof responseRecord.id === 'string') return responseRecord.id;
  }
  return undefined;
}

export function extractUpscaleActualCostUsd(payload: unknown): number | null {
  const queue: Array<{ value: unknown; depth: number }> = [{ value: payload, depth: 0 }];
  const candidates: number[] = [];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const { value, depth } = current;
    if (depth > 5 || value == null) continue;
    if (Array.isArray(value)) {
      value.slice(0, 20).forEach((entry) => queue.push({ value: entry, depth: depth + 1 }));
      continue;
    }
    if (typeof value !== 'object') continue;

    Object.entries(value as Record<string, unknown>).forEach(([key, field]) => {
      const lowered = key.toLowerCase();
      const costLike =
        lowered === 'cost' ||
        lowered === 'price' ||
        lowered.includes('cost_usd') ||
        lowered.includes('price_usd') ||
        lowered.includes('actual_cost') ||
        lowered.includes('estimated_cost');
      if (costLike && typeof field === 'number' && Number.isFinite(field) && field > 0 && field < 10_000) {
        candidates.push(field);
        return;
      }
      queue.push({ value: field, depth: depth + 1 });
    });
  }

  if (!candidates.length) return null;
  return Number(candidates[0].toFixed(6));
}

function resolveTopazTargetFactor(metadata: VideoMetadata | null, target: UpscaleTargetResolution): number {
  if (!metadata) return 2;
  const sourceShortEdge = Math.max(1, Math.min(metadata.width, metadata.height));
  const factor = getTargetResolutionHeight(target) / sourceShortEdge;
  return Math.max(1, Math.min(4, Number(factor.toFixed(2))));
}

export function buildUpscaleFalInput(args: {
  engine: UpscaleToolEngineDefinition;
  mediaUrl: string;
  mode: 'factor' | 'target';
  upscaleFactor: number;
  targetResolution: UpscaleTargetResolution;
  outputFormat: UpscaleOutputFormat;
  metadata: VideoMetadata | null;
}): Record<string, unknown> {
  const { engine, mediaUrl, mode, upscaleFactor, targetResolution, outputFormat, metadata } = args;

  if (engine.id === 'seedvr-image') {
    return {
      image_url: mediaUrl,
      upscale_mode: mode,
      upscale_factor: upscaleFactor,
      target_resolution: targetResolution,
      noise_scale: 0.1,
      output_format: outputFormat,
    };
  }

  if (engine.id === 'topaz-image') {
    return {
      image_url: mediaUrl,
      model: 'Standard V2',
      upscale_factor: Math.min(4, upscaleFactor),
      crop_to_fill: false,
      output_format: outputFormat === 'png' ? 'png' : 'jpeg',
      subject_detection: 'All',
      face_enhancement: true,
      face_enhancement_creativity: 0,
      face_enhancement_strength: 0.8,
    };
  }

  if (engine.id === 'recraft-crisp') {
    return {
      image_url: mediaUrl,
      enable_safety_checker: true,
    };
  }

  if (engine.id === 'seedvr-video') {
    return {
      video_url: mediaUrl,
      upscale_mode: mode,
      upscale_factor: upscaleFactor,
      target_resolution: targetResolution,
      noise_scale: 0.1,
      output_format: seedVideoFormat(outputFormat),
      output_quality: 'high',
      output_write_mode: 'balanced',
      sync_mode: false,
    };
  }

  if (engine.id === 'flashvsr-video') {
    return {
      video_url: mediaUrl,
      upscale_factor: upscaleFactor,
      acceleration: 'regular',
      color_fix: true,
      quality: 70,
      preserve_audio: true,
      output_format: seedVideoFormat(outputFormat),
      output_quality: 'high',
      output_write_mode: 'balanced',
    };
  }

  return {
    video_url: mediaUrl,
    model: 'Proteus',
    upscale_factor: resolveTopazTargetFactor(metadata, targetResolution),
    H264_output: true,
  };
}

export function buildUpscalePromptSummary(args: {
  engine: UpscaleToolEngineDefinition;
  mediaType: UpscaleMediaType;
  mode: 'factor' | 'target';
  upscaleFactor: number;
  targetResolution: UpscaleTargetResolution;
  outputFormat: UpscaleOutputFormat;
}): string {
  const target = args.mode === 'target' ? args.targetResolution : `${args.upscaleFactor}x`;
  return `Upscale ${args.mediaType} · ${args.engine.label} · ${target} · ${args.outputFormat.toUpperCase()}`;
}

export function buildUpscaleSettingsSnapshot(args: {
  engine: UpscaleToolEngineDefinition;
  mediaUrl: string;
  mode: 'factor' | 'target';
  upscaleFactor: number;
  targetResolution: UpscaleTargetResolution;
  outputFormat: UpscaleOutputFormat;
  billingProductKey: string;
  sourceJobId?: string | null;
  sourceAssetId?: string | null;
  metadata: VideoMetadata | null;
}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    surface: UPSCALE_SURFACE,
    billingProductKey: args.billingProductKey,
    engineId: args.engine.id,
    engineLabel: args.engine.label,
    mediaType: args.engine.mediaType,
    inputMode: args.engine.mediaType === 'video' ? 'v2v' : 'i2i',
    source: {
      mediaUrl: args.mediaUrl,
      sourceJobId: args.sourceJobId ?? null,
      sourceAssetId: args.sourceAssetId ?? null,
      metadata: args.metadata,
    },
    controls: {
      mode: args.mode,
      upscaleFactor: args.upscaleFactor,
      targetResolution: args.targetResolution,
      outputFormat: args.outputFormat,
    },
  };
}

export function cloneUpscalePricingWithDynamicTotal(
  pricing: PricingSnapshot,
  dynamicTotalCents: number,
  meta: Record<string, unknown>
): PricingSnapshot {
  const totalCents = Math.max(pricing.totalCents, dynamicTotalCents);
  if (totalCents === pricing.totalCents) {
    return {
      ...pricing,
      meta: {
        ...(pricing.meta ?? {}),
        ...meta,
      },
    };
  }

  return {
    ...pricing,
    totalCents,
    subtotalBeforeDiscountCents: totalCents,
    base: {
      ...pricing.base,
      amountCents: totalCents,
      rate: Number((totalCents / 100).toFixed(4)),
    },
    discount: undefined,
    meta: {
      ...(pricing.meta ?? {}),
      pricingModel: 'dynamic-upscale-video',
      dynamicFloorCents: pricing.totalCents,
      ...meta,
    },
  };
}

export function toUpscaleValidationMessage(error: ValidationError): string {
  const messages = error.fieldErrors
    .map((entry) => {
      const loc = Array.isArray(entry.loc) ? entry.loc.filter((part) => part !== 'body') : [];
      const path = loc.length ? loc.join('.') : null;
      const msg = typeof entry.msg === 'string' ? entry.msg.trim() : '';
      return msg ? (path ? `${path}: ${msg}` : msg) : null;
    })
    .filter((entry): entry is string => Boolean(entry));
  return messages.length ? messages.slice(0, 3).join(' · ') : error.message || 'Validation failed';
}
