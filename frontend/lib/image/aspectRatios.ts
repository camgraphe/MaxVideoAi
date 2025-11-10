import type { ImageGenerationMode } from '@/types/image-generation';

export const NANO_BANANA_T2I_ASPECT_RATIOS = [
  '9:16',
  '16:9',
  '1:1',
  '4:5',
  '5:4',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '21:9',
] as const;

export const NANO_BANANA_I2I_ASPECT_RATIOS = ['auto', ...NANO_BANANA_T2I_ASPECT_RATIOS] as const;

export type NanoBananaTextToImageRatio = (typeof NANO_BANANA_T2I_ASPECT_RATIOS)[number];
export type NanoBananaImageToImageRatio = (typeof NANO_BANANA_I2I_ASPECT_RATIOS)[number];

export function getNanoBananaAspectRatios(mode: ImageGenerationMode): readonly string[] {
  return mode === 'i2i' ? NANO_BANANA_I2I_ASPECT_RATIOS : NANO_BANANA_T2I_ASPECT_RATIOS;
}

export function getNanoBananaDefaultAspectRatio(mode: ImageGenerationMode): string {
  return mode === 'i2i' ? 'auto' : '1:1';
}

export function normalizeNanoBananaAspectRatio(mode: ImageGenerationMode, value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }
  const options = getNanoBananaAspectRatios(mode);
  const normalized = trimmed.toLowerCase();
  const index = options.findIndex((option) => option.toLowerCase() === normalized);
  return index >= 0 ? options[index] : null;
}

const RATIO_LABEL_MAP: Record<string, string> = {
  auto: 'Auto',
  '9:16': 'Vertical 9:16',
  '16:9': 'Horizontal 16:9',
  '1:1': 'Square 1:1',
  '4:5': 'Portrait 4:5',
  '5:4': 'Portrait 5:4',
  '4:3': 'Classic 4:3',
  '3:4': 'Vertical 3:4',
  '3:2': 'Frame 3:2',
  '2:3': 'Vertical 2:3',
  '21:9': 'Cinematic 21:9',
};

export function formatAspectRatioLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return RATIO_LABEL_MAP[value] ?? value;
}
