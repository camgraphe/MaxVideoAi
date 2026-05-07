import {
  parseGptImage2SizeKey,
  type GptImage2ImageSize,
} from '@/lib/image/gptImage2';
import type { ImageEngineOption } from './image-workspace-types';

export function formatImageSizeLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  const labels: Record<string, string> = {
    auto: 'Auto',
    square: 'Square',
    square_hd: 'Square HD',
    portrait_4_3: 'Portrait 4:3',
    portrait_16_9: 'Portrait 16:9',
    landscape_4_3: 'Landscape 4:3',
    landscape_16_9: 'Landscape 16:9',
    custom: 'Custom size',
  };
  const parsed = parseGptImage2SizeKey(normalized);
  if (parsed) {
    return `${parsed.width} x ${parsed.height}`;
  }
  return labels[normalized] ?? value.toUpperCase();
}

export function formatQualityLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'low') return 'Low';
  if (normalized === 'medium') return 'Medium';
  if (normalized === 'high') return 'High';
  return value;
}

export function buildCustomImageSize(width: string, height: string): GptImage2ImageSize | null {
  const parsedWidth = Number(width);
  const parsedHeight = Number(height);
  if (!Number.isFinite(parsedWidth) || !Number.isFinite(parsedHeight)) {
    return null;
  }
  return {
    width: Math.round(parsedWidth),
    height: Math.round(parsedHeight),
  };
}

function normalizeEngineToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function findImageEngine(engines: ImageEngineOption[], engineId: string): ImageEngineOption | null {
  const trimmed = engineId.trim();
  if (!trimmed) return null;
  const direct = engines.find((entry) => entry.id === trimmed);
  if (direct) return direct;
  const token = normalizeEngineToken(trimmed);
  if (!token) return null;
  return (
    engines.find((entry) => normalizeEngineToken(entry.id) === token) ??
    engines.find((entry) => normalizeEngineToken(entry.name) === token) ??
    engines.find((entry) => (entry.aliases ?? []).some((alias) => normalizeEngineToken(alias) === token)) ??
    null
  );
}
