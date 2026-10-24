/** Shared by element selection and the existing owned-generation checks. */
export const KLING_ELEMENT_MINIMUM_IMAGE_WIDTH = 300;
export const KLING_ELEMENT_MINIMUM_IMAGE_HEIGHT = 300;

export function getKlingElementImageDimensionIssue(width: unknown, height: unknown): 'too-small' | 'unverified' | null {
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0
    || typeof height !== 'number' || !Number.isFinite(height) || height <= 0) return 'unverified';
  return width < KLING_ELEMENT_MINIMUM_IMAGE_WIDTH || height < KLING_ELEMENT_MINIMUM_IMAGE_HEIGHT ? 'too-small' : null;
}
