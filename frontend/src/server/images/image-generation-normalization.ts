import type { ImageGenerationMode, ImageGenerationRequest, ImageGenerationResponse } from '@/types/image-generation';
import type { EngineCaps } from '@/types/engines';
import { canonicalizeImageFieldValue, getImageFieldValues } from '@/lib/image/inputSchema';
import { seedreamOutputSettingsError } from '@/lib/image/seedream';
import { failImageGenerationExecution } from './image-generation-error';

export function normalizeOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function resolveImageEnumSetting(allowed: string[], input: unknown): {
  allowed: string[];
  invalid: boolean;
  value: string | null;
} {
  const value = typeof input === 'string' ? canonicalizeImageFieldValue(allowed, input) : null;
  return {
    allowed,
    invalid: typeof input === 'string' && input.trim().length > 0 && !value,
    value,
  };
}

/** Normalize output controls before pricing or wallet reservation; callers retain default ownership. */
export function resolveImageGenerationOutputSettings({ engine, mode, body, extras }: {
  engine: EngineCaps;
  mode: ImageGenerationMode;
  body: { outputFormat?: unknown; quality?: unknown; background?: unknown; style?: unknown };
  extras?: Partial<ImageGenerationResponse>;
}): { outputFormat: string | null; quality: string | null; background: string | null; style: string | null } {
  const readEnum = (fieldId: string, input: unknown, code: string, message: string): string | null => {
    const result = resolveImageEnumSetting(getImageFieldValues(engine, fieldId, mode), input);
    if (result.invalid) failImageGenerationExecution(mode, code, message, 400, { allowed: result.allowed }, extras);
    return result.value;
  };
  const outputFormat = readEnum('output_format', body.outputFormat, 'output_format_invalid',
    'Selected output format is not available for this engine.');
  const quality = readEnum('quality', body.quality, 'quality_invalid',
    'Selected quality is not available for this engine.');
  const background = readEnum('background', body.background, 'background_invalid',
    'Selected background mode is not available for this engine.');
  if (seedreamOutputSettingsError(engine.id, { background, outputFormat })) {
    failImageGenerationExecution(mode, 'output_format_invalid', 'Transparent Seedream 5.5 images require PNG output.',
      400, { allowed: ['png'] }, extras);
  }
  const style = readEnum('style', body.style, 'style_invalid',
    'Selected style is not available for this engine.');
  return { outputFormat, quality, background, style };
}

export function normalizeImageGenerationMetadata(value: unknown): ImageGenerationRequest['metadata'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rawStoryboard = (value as { storyboard?: unknown }).storyboard;
  if (!rawStoryboard || typeof rawStoryboard !== 'object' || Array.isArray(rawStoryboard)) return null;
  const source = rawStoryboard as Record<string, unknown>;
  const role = source.role === 'board' || source.role === 'kling_first_frame' ? source.role : null;
  const parentJobId =
    typeof source.parentJobId === 'string' && source.parentJobId.trim().startsWith('storyboard_')
      ? source.parentJobId.trim()
      : null;
  const targetModel = source.targetModel === 'seedance' || source.targetModel === 'kling' ? source.targetModel : null;
  if (!role && !parentJobId && !targetModel) return null;
  return {
    storyboard: {
      ...(role ? { role } : {}),
      ...(parentJobId ? { parentJobId } : {}),
      ...(targetModel ? { targetModel } : {}),
    },
  };
}
