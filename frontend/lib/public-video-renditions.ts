import generatedProjection from '@/config/public-video-renditions.generated.json';

export type PublicVideoRenditionProfile = 'desktop' | 'mobile';
export type ResolvedPublicVideoRenditionProfile = PublicVideoRenditionProfile | 'original';

export type PublicVideoRenditionProjection = {
  schemaVersion: 1;
  profileVersion: string;
  renditions: Record<string, {
    assetId: string;
    desktop?: string;
    mobile?: string;
  }>;
};

export type ResolvedPublicVideoRendition = {
  src: string;
  originalSrc: string;
  assetId: string | null;
  profile: ResolvedPublicVideoRenditionProfile;
};

export function resolvePublicVideoRenditionFromProjection(
  originalSrc: string,
  profile: PublicVideoRenditionProfile,
  projection: PublicVideoRenditionProjection
): ResolvedPublicVideoRendition {
  const entry = projection.renditions[originalSrc];
  const derivative = entry?.[profile];
  if (!entry) {
    return { src: originalSrc, originalSrc, assetId: null, profile: 'original' };
  }
  if (!derivative) {
    return { src: originalSrc, originalSrc, assetId: entry.assetId, profile: 'original' };
  }
  return { src: derivative, originalSrc, assetId: entry.assetId, profile };
}

export function resolvePublicVideoRendition(
  originalSrc: string,
  profile: PublicVideoRenditionProfile
): ResolvedPublicVideoRendition {
  return resolvePublicVideoRenditionFromProjection(
    originalSrc,
    profile,
    generatedProjection as PublicVideoRenditionProjection
  );
}
