import { normalizeEngineId } from '@/lib/engine-alias';
import { EXAMPLES_HERO_SELECTION_LIMIT, pickFirstPlayableVideo } from '@/lib/examples/heroVideo';
import { listExampleFamilyPage, type GalleryVideo } from '@/server/videos';
import type {
  ExamplePreviewPick,
  RankedPick,
} from './best-for-detail-config';

type PreviewVideo = Pick<GalleryVideo, 'engineId' | 'thumbUrl' | 'videoUrl'>;

const MODEL_SPECIFIC_PREVIEW_FALLBACK_THUMBS: Record<string, string> = {
  'veo-3-1-fast':
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a4b54a9f-7fc6-4b32-b3ad-5ca2a3602869-job_4db2339c-000a-4b81-a68c-9314dd7940b2.jpg',
  'veo-3-1-lite':
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/0a6e2df3-0107-4ea7-8f70-6e03e406f39b.jpg',
};

export async function resolveExamplePreviewPicks(picks: RankedPick[]): Promise<ExamplePreviewPick[]> {
  const examplesSlugs = Array.from(new Set(picks.map((pick) => getExamplesSlug(pick))));
  const videoEntries = await Promise.all(
    examplesSlugs.map(async (examplesSlug) => {
      try {
        const result = await listExampleFamilyPage(examplesSlug, {
          sort: 'playlist',
          limit: EXAMPLES_HERO_SELECTION_LIMIT,
          offset: 0,
        });
        return [examplesSlug, result.items] as const;
      } catch {
        return [examplesSlug, [] as GalleryVideo[]] as const;
      }
    })
  );
  const videosBySlug = new Map(videoEntries);

  return picks.map((pick) => {
    const examplesSlug = getExamplesSlug(pick);
    return {
      ...pick,
      examplesSlug,
      heroThumbUrl: pickModelSpecificPreviewThumb(pick, videosBySlug.get(examplesSlug) ?? []),
    };
  });
}

export function getExamplesSlug(pick: RankedPick) {
  return pick.engine?.family ?? pick.slug;
}

export function pickModelSpecificPreviewThumb(pick: RankedPick, videos: PreviewVideo[]): string | null {
  const modelSlug = normalizePreviewModelSlug(pick.engine?.modelSlug ?? pick.slug);
  const exactVideo = pickFirstPlayableVideo(
    videos.filter((video) => normalizePreviewModelSlug(video.engineId) === modelSlug)
  );
  if (exactVideo?.thumbUrl) {
    return exactVideo.thumbUrl;
  }

  const modelFallback = modelSlug ? MODEL_SPECIFIC_PREVIEW_FALLBACK_THUMBS[modelSlug] : null;
  if (modelFallback) {
    return modelFallback;
  }

  const familyVideo = pickFirstPlayableVideo(videos);
  return familyVideo?.thumbUrl ?? null;
}

function normalizePreviewModelSlug(raw: string | null | undefined) {
  return normalizeEngineId(raw)?.trim().toLowerCase() ?? null;
}
