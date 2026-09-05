import type { PublicVideoRenditionProfile, PublicVideoRenditionProjection } from '../../lib/public-video-renditions';
import {
  assertAllowedPublicMp4Url,
  assertProbeShape,
  assertSha256,
  PUBLIC_VIDEO_PROFILE_VERSION,
  validatePreparedRendition,
  validatePublicVideoSources,
  type HttpCheckEvidence,
  type PublicVideoSource,
  type PublishedManifest,
} from './public-video-renditions';

function validateRendition(
  manifestEntry: PublishedManifest['entries'][number],
  profile: PublicVideoRenditionProfile,
  state: 'active' | 'pending',
  derivativeUrls: Set<string>
): void {
  const rendition = state === 'active' ? manifestEntry.renditions[profile] : manifestEntry.pendingRenditions[profile];
  if (!rendition) return;
  if (rendition.profileVersion !== PUBLIC_VIDEO_PROFILE_VERSION) throw new Error(`Stale profile version for ${manifestEntry.assetId}`);
  assertAllowedPublicMp4Url(rendition.url);
  if (new URL(rendition.url).origin !== 'https://media.maxvideoai.com') throw new Error('Derivative must use the public media origin');
  if (derivativeUrls.has(rendition.url)) throw new Error(`Duplicate or conflicting derivative URL: ${rendition.url}`);
  derivativeUrls.add(rendition.url);
  assertSha256(rendition.sha256, 'Rendition hash');
  const expectedKey = `marketing/video-renditions/${manifestEntry.original.sha256}/${PUBLIC_VIDEO_PROFILE_VERSION}/${profile}/${rendition.sha256}.mp4`;
  if (rendition.storageKey !== expectedKey || rendition.url !== `https://media.maxvideoai.com/${expectedKey}`) {
    throw new Error('Rendition identity conflicts with immutable storage key');
  }
  assertProbeShape(rendition.probe);
  validatePreparedRendition({
    sourceBytes: manifestEntry.original.bytes,
    outputBytes: rendition.bytes,
    sourceProbe: manifestEntry.original.probe,
    outputProbe: rendition.probe,
  }, profile);
  if (!rendition.visualReview?.evidence.trim() || !Number.isFinite(Date.parse(rendition.visualReview.reviewedAt))) {
    throw new Error('Published rendition requires valid visual review evidence');
  }
  if (state === 'pending') {
    if (rendition.httpCheck || rendition.activatedAt) throw new Error('Pending rendition cannot contain activation evidence');
    return;
  }
  if (!rendition.httpCheck || !rendition.activatedAt || !Number.isFinite(Date.parse(rendition.activatedAt))) {
    throw new Error('Active rendition requires valid HTTP readiness and activation evidence');
  }
  if (
    !Number.isFinite(Date.parse(rendition.httpCheck.checkedAt)) ||
    rendition.httpCheck.bytes !== rendition.bytes || rendition.httpCheck.totalBytes !== rendition.bytes ||
    rendition.httpCheck.contentType !== 'video/mp4' || rendition.httpCheck.rangeStart !== 0 || rendition.httpCheck.rangeEnd !== 31
  ) throw new Error('Published rendition has invalid HTTP readiness evidence');
}

export function validatePublishedManifestState(manifest: PublishedManifest, sources: PublicVideoSource[]): void {
  if (manifest?.schemaVersion !== 1) throw new Error('Unsupported manifest schema version');
  if (manifest.profileVersion !== PUBLIC_VIDEO_PROFILE_VERSION) throw new Error('Stale manifest profile version');
  validatePublicVideoSources(sources);
  const sourceById = new Map(sources.map((source) => [source.assetId, source]));
  const ids = new Set<string>();
  const derivativeUrls = new Set<string>();
  for (const entry of manifest.entries) {
    if (ids.has(entry.assetId)) throw new Error(`Duplicate asset ID: ${entry.assetId}`);
    ids.add(entry.assetId);
    const source = sourceById.get(entry.assetId);
    if (!source) throw new Error(`Unknown source asset ID: ${entry.assetId}`);
    if (entry.role !== 'public-demo' || source.role !== entry.role) throw new Error('Invalid public video role');
    if (entry.original.url !== source.url) throw new Error(`Stale source URL for ${entry.assetId}`);
    if (entry.original.sha256 !== source.sha256) throw new Error(`Stale source hash for ${entry.assetId}`);
    if (!Number.isSafeInteger(entry.original.bytes) || entry.original.bytes <= 0) throw new Error('Invalid original byte size');
    assertProbeShape(entry.original.probe);
    if (!entry.renditions || !entry.pendingRenditions || !Array.isArray(entry.omissions) || !Array.isArray(entry.failures)) {
      throw new Error('Published entry is missing active, pending, omission, or failure state');
    }
    for (const profile of ['desktop', 'mobile'] as const) {
      validateRendition(entry, profile, 'active', derivativeUrls);
      validateRendition(entry, profile, 'pending', derivativeUrls);
    }
    const omitted = new Set<PublicVideoRenditionProfile>();
    for (const omission of entry.omissions) {
      if (!['desktop', 'mobile'].includes(omission.profile) || !omission.reason?.trim()) throw new Error('Invalid rendition omission');
      if (omitted.has(omission.profile) || entry.pendingRenditions[omission.profile]) throw new Error('Conflicting rendition omission');
      omitted.add(omission.profile);
    }
    const failed = new Set<PublicVideoRenditionProfile>();
    for (const failure of entry.failures) {
      if (!['desktop', 'mobile'].includes(failure.profile) || !failure.reason?.trim() || failure.retryable !== true) {
        throw new Error('Invalid rendition failure');
      }
      if (failed.has(failure.profile)) throw new Error('Duplicate rendition failure');
      failed.add(failure.profile);
    }
  }
}

export function buildPublicProjectionState(manifest: PublishedManifest): PublicVideoRenditionProjection {
  const renditions: PublicVideoRenditionProjection['renditions'] = {};
  for (const entry of manifest.entries) {
    const projected: { assetId: string; desktop?: string; mobile?: string } = { assetId: entry.assetId };
    for (const profile of ['desktop', 'mobile'] as const) {
      const rendition = entry.renditions[profile];
      if (rendition?.activatedAt) projected[profile] = rendition.url;
    }
    if (projected.desktop || projected.mobile) renditions[entry.original.url] = projected;
  }
  return { schemaVersion: 1, profileVersion: PUBLIC_VIDEO_PROFILE_VERSION, renditions };
}

export function checkPublicVideoStateFiles(input: {
  sources: PublicVideoSource[];
  manifest: PublishedManifest;
  projection: PublicVideoRenditionProjection;
}): void {
  validatePublishedManifestState(input.manifest, input.sources);
  if (input.projection.schemaVersion !== 1 || input.projection.profileVersion !== PUBLIC_VIDEO_PROFILE_VERSION) {
    throw new Error('Generated projection has a stale schema or profile version');
  }
  if (JSON.stringify(input.projection) !== JSON.stringify(buildPublicProjectionState(input.manifest))) {
    throw new Error('Generated projection is stale or hand-edited');
  }
}

export async function verifyPublishedHttpRenditionsState(
  manifest: PublishedManifest,
  verifyHttp: (url: string, expectedBytes: number) => Promise<unknown>
): Promise<void> {
  const verifiedUrls = new Set<string>();
  for (const entry of manifest.entries) {
    for (const profile of ['desktop', 'mobile'] as const) {
      for (const rendition of [entry.renditions[profile], entry.pendingRenditions[profile]]) {
        if (!rendition || verifiedUrls.has(rendition.url)) continue;
        verifiedUrls.add(rendition.url);
        await verifyHttp(rendition.url, rendition.bytes);
      }
    }
  }
}

export async function activatePublishedManifestState(
  manifest: PublishedManifest,
  sources: PublicVideoSource[],
  dependencies: {
    verifyHttp: (url: string, expectedBytes: number) => Promise<HttpCheckEvidence>;
    now?: () => Date;
    assetIds?: ReadonlySet<string>;
  }
): Promise<{ manifest: PublishedManifest; projection: PublicVideoRenditionProjection }> {
  validatePublishedManifestState(manifest, sources);
  if (dependencies.assetIds) {
    for (const assetId of dependencies.assetIds) {
      if (!manifest.entries.some((entry) => entry.assetId === assetId)) throw new Error(`Selected asset ${assetId} is not published`);
    }
  }
  const activated = structuredClone(manifest);
  const activatedAt = (dependencies.now ?? (() => new Date()))().toISOString();
  for (const entry of activated.entries) {
    if (dependencies.assetIds && !dependencies.assetIds.has(entry.assetId)) continue;
    for (const profile of ['desktop', 'mobile'] as const) {
      const pending = entry.pendingRenditions[profile];
      const rendition = pending ?? entry.renditions[profile];
      if (!rendition) continue;
      const evidence = await dependencies.verifyHttp(rendition.url, rendition.bytes);
      if (evidence.bytes !== rendition.bytes || evidence.totalBytes !== rendition.bytes || evidence.contentType !== 'video/mp4') {
        throw new Error(`${entry.assetId} ${profile} failed current HTTP readiness verification`);
      }
      rendition.httpCheck = evidence;
      rendition.activatedAt = activatedAt;
      if (pending) {
        entry.renditions[profile] = rendition;
        delete entry.pendingRenditions[profile];
      }
    }
  }
  validatePublishedManifestState(activated, sources);
  return { manifest: activated, projection: buildPublicProjectionState(activated) };
}

export async function persistActivatedStateFiles(
  manifest: PublishedManifest,
  sources: PublicVideoSource[],
  dependencies: {
    verifyHttp: (url: string, expectedBytes: number) => Promise<HttpCheckEvidence>;
    writeManifest: (manifest: PublishedManifest) => Promise<void>;
    writeProjection: (projection: PublicVideoRenditionProjection) => Promise<void>;
    now?: () => Date;
    assetIds?: ReadonlySet<string>;
  }
): Promise<{ manifest: PublishedManifest; projection: PublicVideoRenditionProjection }> {
  const activated = await activatePublishedManifestState(manifest, sources, dependencies);
  await dependencies.writeManifest(activated.manifest);
  await dependencies.writeProjection(activated.projection);
  return activated;
}
