import type { AppLocale } from '@/i18n/locales';
import { normalizeEngineId } from '@/lib/engine-alias';
import { getSeoVideosByIds, type GalleryVideo } from '@/server/videos';
import { BEST_FOR_SCENES } from './best-for-scenes';
import type { ExamplePreviewPick, RankedPick } from './best-for-detail-config';

type PreviewVideo = Pick<GalleryVideo, 'engineId' | 'thumbUrl' | 'videoUrl'>;
export function getExamplesSlug(pick: RankedPick) { return pick.engine?.family ?? pick.slug; }

/** No sibling-model or stale hard-coded poster fallback. */
export function pickModelSpecificPreviewThumb(pick: RankedPick, videos: PreviewVideo[]): string | null {
  return videos.find(video => matchesModel(pick, video) && video.videoUrl && video.thumbUrl)?.thumbUrl ?? null;
}
function matchesModel(pick: RankedPick, video: PreviewVideo) {
  const model = normalizeEngineId(video.engineId)?.toLowerCase();
  return Boolean(model && [pick.slug, pick.engine?.engineId].some(id => id && normalizeEngineId(id)?.toLowerCase() === model));
}
export function selectBestForScenes(picks: RankedPick[], videos: Map<string, GalleryVideo>, locale: AppLocale, usecase: string): ExamplePreviewPick[] {
  const candidates = BEST_FOR_SCENES.flatMap(scene => {
    if (['4k-video', 'lipsync-dialogue'].includes(usecase) && !scene.usecases.includes(usecase)) return [];
    const pick = picks.find(candidate => candidate.slug === scene.model);
    const video = videos.get(scene.id);
    if (usecase === '4k-video' && (!video || Math.max(video.outputWidth ?? 0, video.outputHeight ?? 0) < 3840 || Math.min(video.outputWidth ?? 0, video.outputHeight ?? 0) < 2160)) return [];
    if (!pick || !video || video.visibility !== 'public' || video.indexable === false || !matchesModel(pick, video) || !video.videoUrl || !video.thumbUrl) return [];
    return [{ pick, scene, video }];
  }).sort((a, b) => Number(b.scene.usecases.includes(usecase)) - Number(a.scene.usecases.includes(usecase)));
  const selected = candidates.filter((candidate, index) => candidates.findIndex(other => other.pick.slug === candidate.pick.slug) === index);
  selected.push(...candidates.filter(candidate => !selected.includes(candidate)));
  return selected.slice(0, 3).map(({ pick, scene, video }) => ({
    ...pick, examplesSlug: getExamplesSlug(pick), heroThumbUrl: video.thumbUrl,
    example: { id: video.id, videoUrl: video.videoUrl!, poster: video.thumbUrl!, duration: video.durationSec,
      title: scene.title[locale], watchFor: scene.watchFor[locale] },
  }));
}
export async function resolveExamplePreviewPicks(picks: RankedPick[], locale: AppLocale = 'en', usecase = ''): Promise<ExamplePreviewPick[]> {
  const ids = BEST_FOR_SCENES.filter(scene => picks.some(pick => pick.slug === scene.model)).map(scene => scene.id);
  try { return selectBestForScenes(picks, await getSeoVideosByIds(ids), locale, usecase); }
  catch { return []; } // A missing public render must never be replaced with another model.
}
