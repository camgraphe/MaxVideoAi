import { isDiscoverableExampleEngine } from '@/lib/examples/discovery';
import type { GalleryVideo } from './videos-normalization';
import { paginateGalleryVideos, sortVideosByPreference, type ExampleSort } from './videos-examples';

export type PublicExampleCard = {
  id: string; engineIconId: string; engineLabel: string; promptFull?: string; prompt: string;
  rawPosterUrl?: string; videoUrl?: string; previewVideoUrl?: string; aspectRatio?: string;
  durationSec: number; hasAudio: boolean; priceLabel?: string | null;
};
export type PublicExamplesSnapshot = {
  version: 1; source: 'https://maxvideoai.com/api/examples'; capturedAt: string;
  cards: Record<string, PublicExampleCard>;
  feeds: Record<string, { playlist: string[]; 'date-desc': string[] }>;
};

export function canUseLocalPublicExamples(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === 'development' && env.MAXVIDEOAI_PUBLIC_EXAMPLES_SNAPSHOT === '1' && !env.DATABASE_URL?.trim() && !env.VERCEL;
}

export function publicCardToVideo(card: PublicExampleCard): GalleryVideo {
  const usd = card.priceLabel?.match(/^\$([\d,]+)\.(\d{2})$/);
  return {
    id: card.id, userId: null, engineId: card.engineIconId, engineLabel: card.engineLabel,
    prompt: card.promptFull ?? card.prompt, promptExcerpt: card.prompt,
    thumbUrl: card.rawPosterUrl, videoUrl: card.videoUrl, previewVideoUrl: card.previewVideoUrl,
    aspectRatio: card.aspectRatio, durationSec: card.durationSec, hasAudio: card.hasAudio,
    // The public cards do not expose creation dates, owner IDs or input settings.
    createdAt: '', visibility: 'public', indexable: true, canUpscale: false,
    finalPriceCents: usd ? Number(usd[1].replaceAll(',', '')) * 100 + Number(usd[2]) : null,
    currency: usd ? 'USD' : null,
  };
}

export function selectLocalPublicExamples(snapshot: PublicExamplesSnapshot, family: string, sort: ExampleSort, limit: number, offset: number) {
  const feed = snapshot.feeds[family];
  if (!feed) return paginateGalleryVideos([], limit, offset);
  const ids = sort === 'playlist' ? feed.playlist : sort === 'date-asc' ? [...feed['date-desc']].reverse() : feed['date-desc'];
  const videos = ids.flatMap(id => snapshot.cards[id] ? [publicCardToVideo(snapshot.cards[id])] : [])
    .filter(video => family || isDiscoverableExampleEngine(video.engineId));
  // Preserve captured date ordering instead of inventing missing timestamps.
  const sorted = sort.startsWith('date-') || sort === 'playlist' ? videos : sortVideosByPreference(videos, sort);
  return paginateGalleryVideos(sorted, limit, offset);
}

export function selectLocalModelExamples(snapshot: PublicExamplesSnapshot, modelSlug: string, limit = 200) {
  return Object.values(snapshot.cards)
    .filter(card => card.engineIconId === modelSlug)
    .slice(0, Math.max(0, limit))
    .map(publicCardToVideo);
}
