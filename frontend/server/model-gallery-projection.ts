import { normalizeEngineId } from '@/lib/engine-alias';
import type { GalleryVideo } from './videos-normalization';
import { finalizeModelGallery } from '../app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-gallery-curation';

export const modelExamplePlaylistKeys = (slug: string) => slug === 'ltx-2-3-pro'
  ? ['examples-ltx-2-3-pro', 'examples-ltx-2-3'] : [`examples-${slug}`];

/** Shared final visible-card policy; callers supply their reader/transaction and presentation. */
export async function projectModelPageGallery<T extends {id: string; aspectRatio?: string | null; videoUrl?: string | null}>(options: {
  engine: {modelSlug: string; id: string}; examples: GalleryVideo[]; managed: boolean;
  preferred: {hero: string | null; demo: string | null}; featuredIds: string[];
  getPublicVideosByIds: (ids: string[]) => Promise<Map<string, GalleryVideo>>;
  toCard: (video: GalleryVideo) => T;
}) {
  const {engine, examples, managed, getPublicVideosByIds, toCard} = options;
  const normalizedSlug = normalizeEngineId(engine.modelSlug) ?? engine.modelSlug;
  const allowedEngineIds = new Set([
    normalizedSlug, engine.modelSlug, engine.id,
    ...(engine.modelSlug === 'sora-2-pro' || engine.modelSlug === 'sora-2' ? ['sora-2','sora2'] : []),
  ].map(id => id ? id.toString().trim().toLowerCase() : '').filter(Boolean));
  const safeExamples = examples.filter(video => {
    const normalized = normalizeEngineId(video.engineId)?.trim().toLowerCase();
    if (!normalized || !allowedEngineIds.has(normalized)) return false;
    return engine.modelSlug !== 'sora-2' || !/\b(john\s+lennon|lennon|beatles)\b/i.test(
      [video.prompt,video.promptExcerpt,video.id].filter(Boolean).join(' '));
  });
  const validatedMap = await getPublicVideosByIds(safeExamples.map(video => video.id));
  const preferredIds = managed ? {hero:null,demo:null} : options.preferred;
  const galleryVideos = await finalizeModelGallery({
    managed,
    cards: safeExamples.filter(video => validatedMap.has(video.id)).map(toCard),
    featuredIds: options.featuredIds,
    preferredIds: [preferredIds.hero,preferredIds.demo].filter((id): id is string => Boolean(id)),
    preferLandscape: engine.modelSlug === 'kling-2-5-turbo',
    fetchCards: async ids => Array.from((await getPublicVideosByIds(ids)).values()).map(toCard),
  });
  return {galleryVideos,preferredIds};
}
