import type { PublicVideoRenditionProjection } from '../../lib/public-video-renditions';
import {
  checkPublicVideoState,
  type PublicVideoSource,
  type PublishedManifest,
} from './public-video-renditions';

type CriticalHomeMedia = Readonly<Record<string, { videoSrc?: string | null } | undefined>>;

export type PublicVideoCoverageInput = {
  heroVideoOrder: readonly string[];
  heroEngineMedia: CriticalHomeMedia;
  sources: PublicVideoSource[];
  manifest: PublishedManifest;
  projection: PublicVideoRenditionProjection;
};

export function checkCriticalHomeVideoCoverage(input: PublicVideoCoverageInput): void {
  checkPublicVideoState({
    sources: input.sources,
    manifest: input.manifest,
    projection: input.projection,
  });

  const sourceByUrl = new Map(input.sources.map((source) => [source.url, source]));
  const manifestByAssetId = new Map(input.manifest.entries.map((entry) => [entry.assetId, entry]));

  for (const heroId of input.heroVideoOrder) {
    const media = input.heroEngineMedia[heroId];
    if (!media) {
      throw new Error(`Critical homepage hero "${heroId}" is missing HERO_ENGINE_MEDIA`);
    }
    const sourceUrl = media.videoSrc?.trim();
    if (!sourceUrl) {
      throw new Error(`Critical homepage hero "${heroId}" is missing its full-duration videoSrc`);
    }
    const source = sourceByUrl.get(sourceUrl);
    if (!source) {
      throw new Error(`Critical homepage hero "${heroId}" uses an unregistered public video source: ${sourceUrl}`);
    }
    const entry = manifestByAssetId.get(source.assetId);
    if (!entry || entry.original.url !== source.url) {
      throw new Error(
        `Critical homepage hero "${heroId}" source "${source.assetId}" has no validated manifest entry`,
      );
    }

    for (const profile of ['desktop', 'mobile'] as const) {
      const active = entry.renditions[profile];
      const omitted = entry.omissions.some((omission) => omission.profile === profile);
      if (!active && !omitted) {
        throw new Error(
          `Critical homepage hero "${heroId}" source "${source.assetId}" has no ready ${profile} path; `
          + 'activate a validated rendition or record a validated omission',
        );
      }
    }
  }
}
