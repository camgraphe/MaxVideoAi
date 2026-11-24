import type { ImageGenerationMode } from '@/types/image-generation';

export const KLING_IMAGE_V4_ID = 'kling-image-v4';
export const KLING_IMAGE_V4_ENDPOINTS = {
  t2i: 'kling/v4/text-to-image',
  i2i: 'kling/v4/image-to-image',
} as const;

// Fal OpenAPI schemas for both endpoints, checked 2026-11-20.
export const KLING_IMAGE_V4_RESOLUTIONS = ['2K', '4K', '8K'] as const;
export const KLING_IMAGE_V4_ASPECT_RATIOS = ['auto', '16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9'] as const;
export const KLING_IMAGE_V4_MAX_REFERENCES = 10;
export const KLING_IMAGE_V4_MAX_OUTPUTS = 10;
export const KLING_IMAGE_V4_MAX_IMAGE_MB = 30;
export const KLING_IMAGE_V4_MIN_SIDE = 300;
export const KLING_IMAGE_V4_REFERENCE_ASPECT = { min: 0.4, max: 2.5 };
export const KLING_IMAGE_V4_PROMPT_MAX_CHARS = 50_000;
export const KLING_IMAGE_V4_REFERENCE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export function isKlingImageV4EngineId(id: string | null | undefined): boolean {
  return id === KLING_IMAGE_V4_ID;
}

export function assertKlingImageV4OutputCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 1 || count > KLING_IMAGE_V4_MAX_OUTPUTS) {
    throw new Error('Choose 1–10 Kling Image outputs.');
  }
}

export function assertKlingImageV4ReferenceCount(mode: ImageGenerationMode, count: number): void {
  if (!Number.isSafeInteger(count) || (mode === 't2i' ? count !== 0 : count < 1 || count > KLING_IMAGE_V4_MAX_REFERENCES)) {
    throw new Error('Kling Image editing requires 1–10 reference images. Text-to-image takes no references.');
  }
}

export function klingImageV4ReferenceFailure(reference: {
  mimeType?: string | null; width?: number | null; height?: number | null; sizeBytes?: number | null;
}): 'format_unsupported' | 'size_exceeded' | 'metadata_unverified' | 'image_dimensions_too_small' | 'image_aspect_ratio_unsupported' | null {
  if (!reference.mimeType || !KLING_IMAGE_V4_REFERENCE_MIME.includes(reference.mimeType.toLowerCase())) return 'format_unsupported';
  const { width, height, sizeBytes } = reference;
  if (!width || !height || !sizeBytes || ![width, height, sizeBytes].every(value => Number.isSafeInteger(value) && value > 0)) return 'metadata_unverified';
  if (sizeBytes > KLING_IMAGE_V4_MAX_IMAGE_MB * 1024 * 1024) return 'size_exceeded';
  if (width < KLING_IMAGE_V4_MIN_SIDE || height < KLING_IMAGE_V4_MIN_SIDE) return 'image_dimensions_too_small';
  const ratio = width / height;
  if (ratio < KLING_IMAGE_V4_REFERENCE_ASPECT.min || ratio > KLING_IMAGE_V4_REFERENCE_ASPECT.max) return 'image_aspect_ratio_unsupported';
  return null;
}
