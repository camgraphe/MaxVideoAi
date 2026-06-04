import type { ImageGenerationRequest } from '@/types/image-generation';

export function normalizeOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
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
