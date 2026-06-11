import { ValidationError } from '@fal-ai/client';
import { normalizeMediaUrl } from '@/lib/media';
import type { PricingSnapshot } from '@/types/engines';
import type {
  BackgroundRemovalOutputCodec,
  BackgroundRemovalStudioBackgroundColor,
  BackgroundRemovalToolEngineDefinition,
  BackgroundRemovalToolOutput,
} from '@/types/tools-background-removal';

export const BACKGROUND_REMOVAL_SURFACE = 'background-removal' as const;
export const BACKGROUND_REMOVAL_TOOL_EVENT_NAME = 'tool_background_removal';
export const BACKGROUND_REMOVAL_PLACEHOLDER_THUMB = '/assets/frames/thumb-1x1.svg';

export type BackgroundRemovalVideoMetadata = {
  width?: number | null;
  height?: number | null;
  durationSec: number;
  fps?: number | null;
};

function normalizeProviderMediaUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://fal.media/files/${trimmed.replace(/^\.?\/+/, '')}`;
}

export function formatBackgroundRemovalVideoMime(codec: BackgroundRemovalOutputCodec): string {
  if (codec === 'webm_vp9') return 'video/webm';
  if (codec === 'mov_h265' || codec === 'mov_proresks') return 'video/quicktime';
  if (codec === 'gif') return 'image/gif';
  if (codec === 'avi_h264') return 'video/x-msvideo';
  if (codec.startsWith('mkv_')) return 'video/x-matroska';
  return 'video/mp4';
}

function toBackgroundRemovalOutput(entry: Record<string, unknown>): BackgroundRemovalToolOutput | null {
  const urlRaw =
    typeof entry.url === 'string'
      ? entry.url
      : typeof entry.video_url === 'string'
        ? entry.video_url
        : typeof entry.path === 'string'
          ? entry.path
          : null;
  if (!urlRaw) return null;

  const mimeType =
    typeof entry.content_type === 'string'
      ? entry.content_type
      : typeof entry.mimetype === 'string'
        ? entry.mimetype
        : typeof entry.mime === 'string'
          ? entry.mime
          : null;
  const url = normalizeProviderMediaUrl(urlRaw);

  return {
    url: normalizeMediaUrl(url) ?? url,
    width: typeof entry.width === 'number' ? entry.width : null,
    height: typeof entry.height === 'number' ? entry.height : null,
    durationSec: typeof entry.duration === 'number' ? entry.duration : null,
    mimeType,
  };
}

export function extractBackgroundRemovalOutput(payload: unknown): BackgroundRemovalToolOutput | null {
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

    if (record.video && typeof record.video === 'object') {
      const output = toBackgroundRemovalOutput(record.video as Record<string, unknown>);
      if (output) return output;
    }

    if (typeof record.video_url === 'string' || typeof record.url === 'string') {
      const output = toBackgroundRemovalOutput(record);
      if (output) return output;
    }
  }

  return null;
}

export function parseBackgroundRemovalRequestId(payload: unknown): string | undefined {
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

export function extractBackgroundRemovalActualCostUsd(payload: unknown): number | null {
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

export function buildBackgroundRemovalPromptSummary(args: {
  backgroundColor: BackgroundRemovalStudioBackgroundColor;
  outputCodec: BackgroundRemovalOutputCodec;
  preserveAudio: boolean;
}): string {
  const audio = args.preserveAudio ? 'audio preserved' : 'audio muted';
  return `Remove video background · ${args.backgroundColor} · ${args.outputCodec} · ${audio}`;
}

export function buildBackgroundRemovalSettingsSnapshot(args: {
  engine: BackgroundRemovalToolEngineDefinition;
  videoUrl: string;
  backgroundColor: BackgroundRemovalStudioBackgroundColor;
  outputCodec: BackgroundRemovalOutputCodec;
  preserveAudio: boolean;
  billingProductKey: string;
  sourceJobId?: string | null;
  sourceAssetId?: string | null;
  metadata: BackgroundRemovalVideoMetadata | null;
}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    surface: BACKGROUND_REMOVAL_SURFACE,
    billingProductKey: args.billingProductKey,
    engineId: args.engine.id,
    engineLabel: args.engine.label,
    inputMode: 'v2v',
    source: {
      videoUrl: args.videoUrl,
      sourceJobId: args.sourceJobId ?? null,
      sourceAssetId: args.sourceAssetId ?? null,
      metadata: args.metadata,
    },
    controls: {
      backgroundColor: args.backgroundColor,
      outputCodec: args.outputCodec,
      preserveAudio: args.preserveAudio,
    },
  };
}

export function cloneBackgroundRemovalPricingWithDynamicTotal(
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
      pricingModel: 'dynamic-background-removal-video',
      dynamicFloorCents: pricing.totalCents,
      ...meta,
    },
  };
}

export function toBackgroundRemovalValidationMessage(error: ValidationError): string {
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
