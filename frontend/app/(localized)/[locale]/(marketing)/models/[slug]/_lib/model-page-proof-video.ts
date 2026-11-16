import { getCinematicVideoMedia } from './model-page-cinematic-media';

/** Reviewed local originals only. Gallery publication has its own owner. */
export function cinematicProofVideo(modelSlug: string, assetId: string) {
  return getCinematicVideoMedia(modelSlug)?.examples[assetId];
}
