import { query } from '@/lib/db';
import { loadPricingPolicyOverrides } from '@/lib/pricing-rule-store';
import { BASE_SELECT_WITH_SETTINGS } from './videos-query';
import { CURATION_ELIGIBILITY } from './playlists/curation-service';
import { mapGalleryVideoRow, type VideoRow } from './videos-normalization';
import { isLocalPublicExamplesEnabled, getLocalPublicExample } from './local-public-examples';
import { getResolvedVideoSeoEditorialEntry } from './video-seo-editorial';
import { computeCanonicalPublicSnapshot } from './pricing/quote-public';
import { projectExampleWatchDetail } from './example-watch-detail';

/** No schema/bootstrap writes on this public read path. Eligibility is rechecked on each open. */
export async function getExampleWatchDetail(id: string) {
  const local = isLocalPublicExamplesEnabled();
  const rows = local ? [] : await query<VideoRow>(`${BASE_SELECT_WITH_SETTINGS} WHERE job_id=$1 AND ${CURATION_ELIGIBILITY} LIMIT 1`, [id]);
  const video = local ? getLocalPublicExample(id) : rows[0] ? mapGalleryVideoRow(rows[0]) : null;
  if (!video) return null;
  const editorial = await getResolvedVideoSeoEditorialEntry(id);
  // One read for a coherent policy across all compared engines in this response.
  const overrides = loadPricingPolicyOverrides();
  return projectExampleWatchDetail(video, editorial, context => computeCanonicalPublicSnapshot(context, { loadOverrides: () => overrides }));
}
