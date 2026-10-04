import type { ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { isLegacyMarketingVideoUrl, resolvePublicMarketingVideoUrl } from '@/lib/media';
import type { GalleryVideo } from '@/server/videos';
import type { CurrentExamplePrice } from '@/server/current-example-price';
import type { AppLocale } from '@/i18n/locales';
import { formatCurrentExamplePrice } from '@/lib/current-example-price-display';

export type FeaturedMedia = {
  id: string | null;
  prompt: string | null;
  videoUrl: string | null;
  previewVideoUrl?: string | null;
  posterUrl: string | null;
  durationSec?: number | null;
  hasAudio?: boolean;
  href?: string | null;
  label?: string | null;
  aspectRatio?: string | null;
};

export function isPlayableVideoUrl(src: string | null | undefined): boolean {
  return Boolean(src && /\.(?:mp4|webm|mov)(?:[?#].*)?$/i.test(src));
}

export function getHeroMediaBadges(media: FeaturedMedia, authored: string[], audioBadgeLabel: string): Array<string | null> {
  if (!isPlayableVideoUrl(media.videoUrl)) return authored;
  return [
    media.hasAudio ? audioBadgeLabel : null,
    typeof media.durationSec === 'number' && media.durationSec > 0 ? `${media.durationSec}s` : null,
    /^\d+:\d+$/.test(media.aspectRatio ?? '') ? media.aspectRatio! : null,
  ];
}

function formatPromptExcerpt(prompt: string, maxWords = 22): string {
  const words = prompt.trim().split(/\s+/);
  if (words.length <= maxWords) return prompt.trim();
  return `${words.slice(0, maxWords).join(' ')}…`;
}

function formatFeaturedPrompt(prompt: string, preferFullPrompt = false): string {
  const condensed = prompt
    .replace(/\*\*/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!condensed) return '';
  const hasStructuredSections =
    /^prompt\b/i.test(condensed) || /\b(brief|subject|camera|style|audio|look|ending):/i.test(condensed);
  if (preferFullPrompt && !hasStructuredSections) {
    return condensed;
  }
  return formatPromptExcerpt(condensed, preferFullPrompt ? 48 : 22);
}

export function normalizeMediaUrl(src?: string | null): string | null {
  const value = src?.trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if (['image', 'video', 'thumbnail', 'poster', 'null', 'undefined'].includes(lower)) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/') || value.startsWith('data:') || value.startsWith('blob:')) return value;
  return null;
}

export function toGalleryCard(
  video: GalleryVideo,
  brandId?: string,
  fallbackLabel?: string,
  iconId?: string,
  engineSlug = 'sora-2',
  fromPath?: string,
  appPath = '/app',
  currentPrice?: CurrentExamplePrice,
  locale: AppLocale = 'en',
): ExampleGalleryVideo {
  const promptExcerpt = formatPromptExcerpt(video.promptExcerpt || video.prompt || 'MaxVideoAI render');
  const isImageWorkspace = appPath === '/app/image';
  const videoHrefBase = isImageWorkspace
    ? `${appPath}?job=${encodeURIComponent(video.id)}`
    : `/video/${encodeURIComponent(video.id)}`;
  const videoHref = !isImageWorkspace && fromPath ? `${videoHrefBase}?from=${encodeURIComponent(fromPath)}` : videoHrefBase;
  const thumbUrl =
    video.thumbUrl && !isLegacyMarketingVideoUrl(video.thumbUrl)
      ? normalizeMediaUrl(video.thumbUrl)
      : null;
  return {
    id: video.id,
    href: videoHref,
    engineLabel: video.engineLabel || fallbackLabel || 'Sora 2',
    engineIconId: iconId ?? 'sora-2',
    engineBrandId: brandId,
    priceLabel: formatCurrentExamplePrice(currentPrice, locale),
    prompt: promptExcerpt,
    promptFull: video.prompt,
    aspectRatio: video.aspectRatio ?? null,
    durationSec: video.durationSec,
    hasAudio: video.hasAudio,
    optimizedPosterUrl: buildOptimizedPosterUrl(thumbUrl),
    rawPosterUrl: thumbUrl,
    videoUrl: resolvePublicMarketingVideoUrl(video.videoUrl),
    previewVideoUrl: resolvePublicMarketingVideoUrl(video.previewVideoUrl),
    recreateHref: `${appPath}?engine=${encodeURIComponent(engineSlug)}&from=${encodeURIComponent(video.id)}`,
  };
}

export function toFeaturedMedia(entry?: ExampleGalleryVideo | null, preferFullPrompt = false): FeaturedMedia | null {
  if (!entry) return null;
  const rawPrompt = preferFullPrompt && entry.promptFull ? entry.promptFull : entry.prompt;
  const prompt = formatFeaturedPrompt(rawPrompt, preferFullPrompt);
  return {
    id: entry.id,
    prompt,
    videoUrl: resolvePublicMarketingVideoUrl(entry.videoUrl),
    previewVideoUrl: resolvePublicMarketingVideoUrl(entry.previewVideoUrl),
    posterUrl: normalizeMediaUrl(entry.optimizedPosterUrl) ?? normalizeMediaUrl(entry.rawPosterUrl),
    durationSec: entry.durationSec,
    hasAudio: entry.hasAudio,
    href: entry.href,
    label: entry.engineLabel,
    aspectRatio: entry.aspectRatio,
  };
}

function isLandscape(aspect: string | null | undefined): boolean {
  if (!aspect) return true;
  const [w, h] = aspect.split(':').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return true;
  return w / h >= 1;
}

function isWideVideo(card: ExampleGalleryVideo): boolean {
  if (!isPlayableVideoUrl(card.videoUrl)) return false;
  const [width, height] = (card.aspectRatio ?? '').split(':').map(Number);
  return Number.isFinite(width) && Number.isFinite(height) && height > 0 && width / height >= 1.5;
}

export function pickHeroMedia(
  cards: ExampleGalleryVideo[],
  preferredId: string | null,
  fallback: FeaturedMedia,
  options?: { preserveOrder?: boolean }
): FeaturedMedia {
  // Image model heroes are deliberately curated in the engine registry. Keep a
  // model playlist available to the gallery without letting its first item
  // silently replace the authored hero artwork.
  if (!fallback.videoUrl && fallback.posterUrl) {
    return fallback;
  }
  // Explicit admin order owns the selected hero; legacy galleries keep landscape preference.
  if (options?.preserveOrder) {
    const first = cards.find((card) => isPlayableVideoUrl(card.videoUrl)) ?? cards[0];
    return toFeaturedMedia(first) ?? fallback;
  }
  const preferred = preferredId ? cards.find((card) => card.id === preferredId) : null;
  if (preferred && isWideVideo(preferred)) {
    return toFeaturedMedia(preferred) ?? fallback;
  }
  const playable = cards.find(isWideVideo) ?? cards.find((card) => isPlayableVideoUrl(card.videoUrl)) ?? cards[0];
  return toFeaturedMedia(playable) ?? fallback;
}

export function pickDemoMedia(
  cards: ExampleGalleryVideo[],
  heroId: string | null,
  preferredId: string | null,
  fallback: FeaturedMedia | null,
  options?: { allowFallbackReuse?: boolean }
): FeaturedMedia | null {
  const preferred =
    preferredId && preferredId !== heroId
      ? cards.find((card) => card.id === preferredId && Boolean(card.videoUrl))
      : null;
  if (preferred) {
    const resolved = toFeaturedMedia(preferred, true);
    if (resolved) return resolved;
  }
  const candidate =
    cards.find((card) => card.id !== heroId && Boolean(card.videoUrl) && isLandscape(card.aspectRatio)) ??
    cards.find((card) => card.id !== heroId);
  const resolved = toFeaturedMedia(candidate, true);
  if (resolved) return resolved;
  if (fallback && (options?.allowFallbackReuse || !heroId || fallback.id !== heroId)) {
    return fallback;
  }
  return null;
}
