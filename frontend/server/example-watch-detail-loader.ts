import { getPublicConfiguredEnginesByCategory } from '@/server/engines';
import { query } from '@/lib/db';
import { loadPricingPolicyOverrides } from '@/lib/pricing-rule-store';
import { BASE_SELECT_WITH_SETTINGS } from './videos-query';
import { CURATION_ELIGIBILITY } from './playlists/curation-service';
import { mapGalleryVideoRow, type GalleryVideo, type VideoRow } from './videos-normalization';
import { isLocalPublicExamplesEnabled, getLocalPublicExample } from './local-public-examples';
import { getResolvedVideoSeoEditorialEntry } from './video-seo-editorial';
import { computeCanonicalPublicSnapshot } from './pricing/quote-public';
import { projectExampleWatchDetail } from './example-watch-detail';
import { deriveWatchPageSignals, type WatchPageDerivedSignals } from './watch-page-signals';
import { resolveWatchSourceImageOriginalUrls } from './watch-source-image-originals';
import { getBaseSeoWatchVideoMeta } from './video-seo';

/** No schema/bootstrap writes on this public read path. Eligibility is rechecked on each open. */
export async function getExampleWatchDetail(id: string) {
  const local = isLocalPublicExamplesEnabled();
  const rows = local ? [] : await query<VideoRow>(`${BASE_SELECT_WITH_SETTINGS} WHERE job_id=$1 AND ${CURATION_ELIGIBILITY} LIMIT 1`, [id]);
  const video = local ? getLocalPublicExample(id) : rows[0] ? mapGalleryVideoRow(rows[0]) : null;
  if (!video) return null;
  return buildExampleWatchDetail(video);
}

export async function buildExampleWatchDetail(video: GalleryVideo, preparedSignals?: WatchPageDerivedSignals) {
  // Direct watch pages pass the already validated editorial/source-image projection
  // from getVideoWatchPageDataById. API opens still resolve those gates here.
  const [editorial, engines] = await Promise.all([
    preparedSignals ? null : getResolvedVideoSeoEditorialEntry(video.id),
    getPublicConfiguredEnginesByCategory('video'),
  ]);
  const signals = preparedSignals ?? deriveWatchPageSignals({ video, editorial, entry: getBaseSeoWatchVideoMeta(video.id) });
  const sourceImages = preparedSignals?.sourceImages ?? await resolveWatchSourceImageOriginalUrls({ video, sourceImages: signals.sourceImages });
  // One read for a coherent policy across all compared engines in this response.
  const overrides = loadPricingPolicyOverrides();
  return projectExampleWatchDetail(video, editorial, context => computeCanonicalPublicSnapshot(context, { loadOverrides: () => overrides }), engines, { ...signals, sourceImages });
}
