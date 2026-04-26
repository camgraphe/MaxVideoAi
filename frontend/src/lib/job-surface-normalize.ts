import type { JobSurface, UserAssetSource } from '@/types/billing';

export function normalizeJobSurface(value: unknown): JobSurface | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'video' ||
    normalized === 'image' ||
    normalized === 'character' ||
    normalized === 'angle' ||
    normalized === 'audio' ||
    normalized === 'upscale'
  ) {
    return normalized;
  }
  if (normalized === 'character-builder') {
    return 'character';
  }
  return null;
}

export function normalizeUserAssetSource(value: unknown): UserAssetSource {
  if (typeof value !== 'string') return 'generated';
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'upload' ||
    normalized === 'generated' ||
    normalized === 'character' ||
    normalized === 'angle' ||
    normalized === 'upscale'
  ) {
    return normalized;
  }
  return 'generated';
}
