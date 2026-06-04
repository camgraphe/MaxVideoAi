import {
  parseGptImage2SizeKey,
  type GptImage2ImageSize,
} from '@/lib/image/gptImage2';
import type { ImageEngineOption } from './image-workspace-types';

type ImageCountControlOption = {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
};

export function formatImageSizeLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  const labels: Record<string, string> = {
    auto: 'Auto',
    '2k': '2K',
    '3k': '3K',
    square: 'Square · 1024 x 1024',
    square_hd: 'Square HD · 1024 x 1024',
    portrait_4_3: 'Portrait 4:3 · 768 x 1024',
    portrait_16_9: 'Portrait · 1024 x 1536',
    landscape_4_3: 'Landscape 4:3 · 1024 x 768',
    landscape_16_9: 'Landscape 16:9 · 1920 x 1080',
    '3840x2160': '4K · 3840 x 2160',
    '2560x1440': '2.5K · 2560 x 1440',
    custom: 'Custom size',
  };
  if (labels[normalized]) return labels[normalized];
  const parsed = parseGptImage2SizeKey(normalized);
  if (parsed) {
    return `${parsed.width} x ${parsed.height}`;
  }
  return value.toUpperCase();
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

export function resolveSeedreamMaxOutputImages(referenceCount: number): number {
  const safeReferenceCount = Number.isFinite(referenceCount) ? Math.max(0, Math.floor(referenceCount)) : 0;
  return Math.max(1, 15 - safeReferenceCount);
}

function getNumericImageCountOption(value: ImageCountControlOption['value']): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }
  return null;
}

export function buildImageCountOptionsWithinMax({
  options,
  max,
  labelForCount,
}: {
  options: ImageCountControlOption[];
  max: number;
  labelForCount: (count: number) => string;
}): ImageCountControlOption[] {
  const safeMax = Math.max(1, Math.floor(max));
  const byCount = new Map<number, ImageCountControlOption>();

  options.forEach((option) => {
    const count = getNumericImageCountOption(option.value);
    if (count == null || count < 1 || count > safeMax) {
      return;
    }
    byCount.set(count, option);
  });

  if (!byCount.has(safeMax)) {
    byCount.set(safeMax, {
      value: safeMax,
      label: labelForCount(safeMax),
    });
  }

  return Array.from(byCount.entries())
    .sort(([left], [right]) => left - right)
    .map(([, option]) => option);
}
