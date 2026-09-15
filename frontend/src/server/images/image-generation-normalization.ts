import type { ImageGenerationRequest } from '@/types/image-generation';
import { canonicalizeImageFieldValue } from '@/lib/image/inputSchema';

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
