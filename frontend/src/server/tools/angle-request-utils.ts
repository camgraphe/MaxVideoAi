import { ValidationError } from '@fal-ai/client';
import { normalizeMediaUrl } from '@/lib/media';
import { mapTiltForEngine, normalizeRotation } from '@/lib/tools-angle';
import type {
  AngleToolEngineDefinition,
  AngleToolEngineId,
  AngleToolOutput,
  AngleToolRequest,
} from '@/types/tools-angle';

export const ANGLE_SURFACE = 'angle' as const;
export const ANGLE_MULTI_OUTPUT_COUNT = 4;

export function getAngleBillingProductKeyForEngine(engineId: AngleToolEngineId, generateBestAngles: boolean): string {
  const family = engineId === 'qwen-multiple-angles' ? 'qwen' : 'flux';
  return `angle-${family}-${generateBestAngles ? 'multi' : 'single'}`;
}

export function buildAnglePromptSummary(params: { rotation: number; tilt: number; zoom: number }, outputCount: number): string {
  return `Angle tool · rotation ${Math.round(params.rotation)}° · tilt ${Math.round(params.tilt)}° · zoom ${params.zoom.toFixed(1)} · ${outputCount} output${outputCount > 1 ? 's' : ''}`;
}

export function buildAngleSettingsSnapshot(args: {
  engine: AngleToolEngineDefinition;
  imageUrl: string;
  requested: AngleToolRequest['params'];
  applied: AngleToolRequest['params'] & { safeMode: boolean; safeApplied: boolean };
  generateBestAngles: boolean;
  outputCount: number;
  billingProductKey: string;
}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    surface: ANGLE_SURFACE,
    billingProductKey: args.billingProductKey,
    engineId: args.engine.id,
    engineLabel: args.engine.label,
    inputMode: 'i2i',
    prompt: buildAnglePromptSummary(args.applied, args.outputCount),
    source: {
      imageUrl: args.imageUrl,
    },
    controls: {
      requested: args.requested,
      applied: args.applied,
      generateBestAngles: args.generateBestAngles,
      outputCount: args.outputCount,
    },
  };
}

function normalizeFalUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.replace(/^\.?\/+/, '');
  return `https://fal.media/files/${normalized}`;
}

function toAngleOutput(entry: Record<string, unknown>): AngleToolOutput | null {
  const urlRaw =
    typeof entry.url === 'string'
      ? entry.url
      : typeof entry.image_url === 'string'
        ? entry.image_url
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
          : null;

  const url = normalizeFalUrl(urlRaw);
  return {
    url: normalizeMediaUrl(url) ?? url,
    width,
    height,
    mimeType,
  };
}

export function extractAngleOutputs(payload: unknown): AngleToolOutput[] {
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

    if (Array.isArray(record.images)) {
      const mapped = record.images
        .map((entry) => (entry && typeof entry === 'object' ? toAngleOutput(entry as Record<string, unknown>) : null))
        .filter((entry): entry is AngleToolOutput => Boolean(entry));
      if (mapped.length) return mapped;
    }

    if (record.image && typeof record.image === 'object') {
      const single = toAngleOutput(record.image as Record<string, unknown>);
      if (single) return [single];
    }

    if (typeof record.url === 'string') {
      const single = toAngleOutput(record);
      if (single) return [single];
    }
  }

  return [];
}

export function parseAngleRequestId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  const direct = typeof record.request_id === 'string' ? record.request_id : undefined;
  if (direct) return direct;
  if (typeof record.id === 'string') return record.id;
  if (record.response && typeof record.response === 'object') {
    const responseRecord = record.response as Record<string, unknown>;
    if (typeof responseRecord.request_id === 'string') return responseRecord.request_id;
    if (typeof responseRecord.id === 'string') return responseRecord.id;
  }
  if (record.output && typeof record.output === 'object') {
    const outputRecord = record.output as Record<string, unknown>;
    if (typeof outputRecord.request_id === 'string') return outputRecord.request_id;
    if (typeof outputRecord.id === 'string') return outputRecord.id;
  }
  return undefined;
}

export function extractAngleActualCostUsd(payload: unknown): number | null {
  const queue: Array<{ value: unknown; depth: number }> = [{ value: payload, depth: 0 }];
  const candidates: number[] = [];

  const isCostKey = (rawKey: string): boolean => {
    const key = rawKey.toLowerCase();
    if (key.includes('zoom_amount')) return false;
    return (
      key === 'cost' ||
      key === 'price' ||
      key.includes('cost_usd') ||
      key.includes('price_usd') ||
      key.includes('actual_cost') ||
      key.includes('estimated_cost') ||
      key.endsWith('_usd') ||
      key.endsWith('usd')
    );
  };

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const { value, depth } = current;
    if (depth > 5 || value == null) continue;

    if (typeof value === 'string') {
      const cleaned = value.trim();
      const dollarMatch = cleaned.match(/\$\s*([0-9]+(?:\.[0-9]+)?)/);
      if (dollarMatch) {
        const parsed = Number(dollarMatch[1]);
        if (Number.isFinite(parsed) && parsed > 0) candidates.push(parsed);
      }
      continue;
    }

    if (Array.isArray(value)) {
      value.slice(0, 20).forEach((entry) => queue.push({ value: entry, depth: depth + 1 }));
      continue;
    }

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      Object.entries(record).forEach(([key, field]) => {
        const costLike = isCostKey(key);

        if (costLike && typeof field === 'number' && Number.isFinite(field) && field > 0 && field < 10_000) {
          candidates.push(field);
          return;
        }

        if (costLike && typeof field === 'string') {
          const parsed = Number(field.replace(/[^0-9.]+/g, ''));
          if (Number.isFinite(parsed) && parsed > 0) {
            candidates.push(parsed);
            return;
          }
        }

        queue.push({ value: field, depth: depth + 1 });
      });
    }
  }

  if (!candidates.length) return null;
  const costCandidate = candidates.find((value) => value <= 100) ?? candidates[0];
  return Number(costCandidate.toFixed(6));
}

export function buildAngleFalInput(
  engine: AngleToolEngineDefinition,
  imageUrl: string,
  params: { rotation: number; tilt: number; zoom: number }
) {
  const horizontalAngle = Math.round(normalizeRotation(params.rotation));
  const verticalAngle = Math.round(mapTiltForEngine(engine.id, params.tilt));
  const zoomAmount = Number(params.zoom.toFixed(1));

  return {
    image_urls: [imageUrl],
    horizontal_angle: horizontalAngle,
    vertical_angle: verticalAngle,
    zoom_amount: zoomAmount,
    num_images: 1,
  };
}

export function toAngleValidationMessage(error: ValidationError): string {
  const messages = error.fieldErrors
    .map((entry) => {
      const loc = Array.isArray(entry.loc) ? entry.loc.filter((part) => part !== 'body') : [];
      const path = loc.length ? loc.join('.') : null;
      const msg = typeof entry.msg === 'string' ? entry.msg.trim() : '';
      if (!msg) return null;
      return path ? `${path}: ${msg}` : msg;
    })
    .filter((entry): entry is string => Boolean(entry));

  if (!messages.length) {
    return error.message || 'Validation failed';
  }
  return messages.slice(0, 3).join(' · ');
}
