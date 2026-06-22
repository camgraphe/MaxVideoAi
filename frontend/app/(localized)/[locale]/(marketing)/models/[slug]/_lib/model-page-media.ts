import type { ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import type { GalleryVideo } from '@/server/videos';

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

function formatPriceLabel(priceCents: number | null | undefined, currency: string | null | undefined): string | null {
  if (typeof priceCents !== 'number' || Number.isNaN(priceCents)) {
    return null;
  }
  const normalizedCurrency = typeof currency === 'string' && currency.length ? currency.toUpperCase() : 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(priceCents / 100);
  } catch {
    return `${normalizedCurrency} ${(priceCents / 100).toFixed(2)}`;
  }
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
  appPath = '/app'
): ExampleGalleryVideo {
  const promptExcerpt = formatPromptExcerpt(video.promptExcerpt || video.prompt || 'MaxVideoAI render');
  const isImageWorkspace = appPath === '/app/image';
  const videoHrefBase = isImageWorkspace
    ? `${appPath}?job=${encodeURIComponent(video.id)}`
    : `/video/${encodeURIComponent(video.id)}`;
  const videoHref = !isImageWorkspace && fromPath ? `${videoHrefBase}?from=${encodeURIComponent(fromPath)}` : videoHrefBase;
  const thumbUrl = normalizeMediaUrl(video.thumbUrl);
  return {
    id: video.id,
    href: videoHref,
    engineLabel: video.engineLabel || fallbackLabel || 'Sora 2',
    engineIconId: iconId ?? 'sora-2',
    engineBrandId: brandId,
    priceLabel: formatPriceLabel(video.finalPriceCents ?? null, video.currency ?? null),
    prompt: promptExcerpt,
    promptFull: video.prompt,
    aspectRatio: video.aspectRatio ?? null,
    durationSec: video.durationSec,
    hasAudio: video.hasAudio,
    optimizedPosterUrl: buildOptimizedPosterUrl(thumbUrl),
    rawPosterUrl: thumbUrl,
    videoUrl: normalizeMediaUrl(video.videoUrl),
    previewVideoUrl: normalizeMediaUrl(video.previewVideoUrl),
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
    videoUrl: normalizeMediaUrl(entry.videoUrl),
    previewVideoUrl: normalizeMediaUrl(entry.previewVideoUrl),
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

export function pickHeroMedia(
  cards: ExampleGalleryVideo[],
  preferredId: string | null,
  fallback: FeaturedMedia
): FeaturedMedia {
  const preferred = preferredId ? cards.find((card) => card.id === preferredId) : null;
  if (preferred) {
    return toFeaturedMedia(preferred) ?? fallback;
  }
  const playable = cards.find((card) => Boolean(card.videoUrl)) ?? cards[0];
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
