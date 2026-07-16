import { isDatabaseConfigured } from '@/lib/db';
import type { AppLocale } from '@/i18n/locales';
import { listGalleryVideos, listPlaylistVideos, type GalleryVideo } from '@/server/videos';
import type { PayAsYouGoContent, PaygShowcaseTitleId } from '../_content/types';

export const PAYG_VIDEO_PLAYLIST_SLUG = 'payg-ai-video-generator';
const SHOWCASE_LIMIT = 7;
const FALLBACK_FETCH_LIMIT = 18;
const SHOWCASE_DISALLOWED_MODEL_PATTERN = /\b(?:sora|openai|pika)\b/i;
const SHOWCASE_MODEL_PRIORITY: Array<{ key: string; pattern: RegExp }> = [
  { key: 'seedance-2', pattern: /seedance(?:[-\s]?2|[-\s]?2\.0)(?!.*mini)/i },
  { key: 'kling', pattern: /kling/i },
  { key: 'google-veo', pattern: /\b(?:google\s+)?veo\b/i },
  { key: 'happy-horse-1-1', pattern: /happy\s*-?\s*horse(?:\s*1(?:\.|-)?1)?/i },
  { key: 'seedance-2-mini', pattern: /seedance.*mini|dreamina/i },
  { key: 'ltx', pattern: /\bltx\b/i },
  { key: 'wan', pattern: /\bwan\b/i },
];

export type PayAsYouGoShowcaseVideo = {
  id: string;
  engineId: string;
  engineLabel: string;
  priceLabel: string;
  durationLabel: string;
  title: string;
  useCase: string;
  posterUrl?: string;
  videoUrl?: string;
  href: string;
};

export type PayAsYouGoShowcaseRuntimeCopy = PayAsYouGoContent['showcase']['runtime'];

function formatVideoPrice(video: GalleryVideo, locale: AppLocale, copy: PayAsYouGoShowcaseRuntimeCopy) {
  if (typeof video.finalPriceCents !== 'number' || !Number.isFinite(video.finalPriceCents)) {
    return copy.priceUnavailable;
  }

  const currency = video.currency?.trim().toUpperCase() || 'USD';
  try {
    return new Intl.NumberFormat(locale === 'es' ? 'es-419' : locale === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(video.finalPriceCents / 100);
  } catch {
    return `${currency} ${(video.finalPriceCents / 100).toFixed(2)}`;
  }
}

function hasMedia(video: GalleryVideo) {
  return Boolean(video.previewVideoUrl || video.videoUrl || video.thumbUrl);
}

function videoModelSearchText(video: GalleryVideo) {
  return [video.engineId, video.engineLabel, video.promptExcerpt, video.prompt].filter(Boolean).join(' ');
}

function isAllowedShowcaseModel(video: GalleryVideo) {
  return !SHOWCASE_DISALLOWED_MODEL_PATTERN.test(videoModelSearchText(video));
}

function modelPriorityIndex(video: GalleryVideo) {
  const searchText = videoModelSearchText(video);
  const index = SHOWCASE_MODEL_PRIORITY.findIndex(({ pattern }) => pattern.test(searchText));
  return index === -1 ? SHOWCASE_MODEL_PRIORITY.length : index;
}

function cleanPromptText(prompt: string) {
  const cleaned = prompt
    .replace(/\*\*/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned
    .replace(/^(?:prompt\s*(?:en|fr|es)?\s*[^A-Za-z0-9]+\s*)/i, '')
    .replace(/^(?:brief|scene\s*\d+|shot\s*\d+)\s*:\s*/i, '')
    .replace(/^safer\s+/i, '')
    .trim();
}

const VIDEO_TITLE_RULES: Array<{ pattern: RegExp; id: PaygShowcaseTitleId }> = [
  { pattern: /rooftop|chase|reunion/i, id: 'rooftop' },
  { pattern: /museum|curator|gallery/i, id: 'museum' },
  { pattern: /animate this image|image into|smooth animation/i, id: 'smooth-image' },
  { pattern: /provided image|reference image/i, id: 'guided-image' },
  { pattern: /female racer|racer/i, id: 'racer' },
  { pattern: /selfie|ugc|vertical/i, id: 'ugc' },
  { pattern: /warrior|temple/i, id: 'warrior' },
  { pattern: /product|packshot|bottle|perfume/i, id: 'product-image' },
  { pattern: /cinematic|studio lighting|camera push/i, id: 'product-reveal' },
];

function formatVideoTitle(prompt: string, engineLabel: string, copy: PayAsYouGoShowcaseRuntimeCopy) {
  const cleaned = cleanPromptText(prompt);
  const matched = VIDEO_TITLE_RULES.find(({ pattern }) => pattern.test(cleaned));
  if (matched) return copy.titles[matched.id];
  if (/image|reference|photo/i.test(cleaned)) return copy.fallbackTitles.image;
  if (/character|person|portrait|actor/i.test(cleaned)) return copy.fallbackTitles.character;
  if (/text-to-video|prompt/i.test(cleaned)) return copy.fallbackTitles.prompt;
  return copy.defaultTitleTemplate.replace('{engine}', engineLabel || copy.defaultTitleEngineLabel);
}

function formatVideoUseCase(video: GalleryVideo, copy: PayAsYouGoShowcaseRuntimeCopy) {
  const searchText = videoModelSearchText(video);
  if (/seedance.*mini|dreamina/i.test(searchText)) return copy.useCases.seedanceMini;
  if (/seedance/i.test(searchText)) return copy.useCases.seedance;
  if (/kling/i.test(searchText)) return copy.useCases.kling;
  if (/\b(?:google\s+)?veo\b/i.test(searchText)) return copy.useCases.veo;
  if (/happy\s*-?\s*horse/i.test(searchText)) {
    const isHappyHorse11 = /happy\s*-?\s*horse[\s-]*(?:v)?1(?:\.|-)?1|(?:v)?1(?:\.|-)?1[\s-]*happy\s*-?\s*horse/i.test(
      searchText
    );
    const isEarlierHappyHorse = /happy\s*-?\s*horse[\s-]*(?:v)?1(?:\.|-)?0|(?:v)?1(?:\.|-)?0[\s-]*happy\s*-?\s*horse/i.test(
      searchText
    );
    if (isEarlierHappyHorse && !isHappyHorse11) return copy.useCases.happyHorseEarlier;
    if (isHappyHorse11) return copy.useCases.happyHorse11;
    return copy.useCases.happyHorse;
  }
  if (/\bltx\b/i.test(searchText)) return copy.useCases.ltx;
  if (/\bwan\b/i.test(searchText)) return copy.useCases.wan;
  return copy.useCases.fallback;
}

function pickDiverseVideos(videos: GalleryVideo[]) {
  const selected: GalleryVideo[] = [];
  const seenEngines = new Set<string>();
  const uniqueVideos = videos.filter((video, index, source) => source.findIndex((item) => item.id === video.id) === index);
  const candidates = uniqueVideos
    .filter((video) => hasMedia(video) && isAllowedShowcaseModel(video))
    .sort((first, second) => modelPriorityIndex(first) - modelPriorityIndex(second));

  candidates.forEach((video) => {
    if (selected.length >= SHOWCASE_LIMIT) return;
    const engineKey = video.engineId.trim().toLowerCase();
    if (!engineKey || seenEngines.has(engineKey)) return;
    seenEngines.add(engineKey);
    selected.push(video);
  });

  candidates.forEach((video) => {
    if (selected.length >= SHOWCASE_LIMIT) return;
    if (selected.some((item) => item.id === video.id)) return;
    selected.push(video);
  });

  return selected;
}

export function buildPayAsYouGoShowcaseVideo(
  video: GalleryVideo,
  locale: AppLocale,
  copy: PayAsYouGoShowcaseRuntimeCopy,
): PayAsYouGoShowcaseVideo {
  const duration = Math.max(1, Math.round(video.durationSec || 0));
  const engineLabel = video.engineLabel || video.engineId || copy.defaultEngineLabel;
  const titleEngineLabel = video.engineLabel || video.engineId || copy.defaultTitleEngineLabel;
  return {
    id: video.id,
    engineId: video.engineId,
    engineLabel,
    priceLabel: formatVideoPrice(video, locale, copy),
    durationLabel: `${duration}s`,
    title: formatVideoTitle(video.promptExcerpt || video.prompt || '', titleEngineLabel, copy),
    useCase: formatVideoUseCase(video, copy),
    posterUrl: video.thumbUrl,
    videoUrl: video.previewVideoUrl ?? video.videoUrl,
    href: `/video/${encodeURIComponent(video.id)}?from=${encodeURIComponent('/pay-as-you-go-ai-video-generator')}`,
  };
}

async function loadFallbackVideos() {
  try {
    return await listGalleryVideos('starter', FALLBACK_FETCH_LIMIT);
  } catch (error) {
    console.warn('[payg-video-showcase] failed to load starter fallback videos', error);
    return [] as GalleryVideo[];
  }
}

export async function loadPayAsYouGoVideoShowcase({
  locale,
  copy,
}: {
  locale: AppLocale;
  copy: PayAsYouGoShowcaseRuntimeCopy;
}): Promise<PayAsYouGoShowcaseVideo[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  let videos: GalleryVideo[] = [];
  try {
    videos = await listPlaylistVideos(PAYG_VIDEO_PLAYLIST_SLUG, SHOWCASE_LIMIT);
  } catch (error) {
    console.warn(`[payg-video-showcase] failed to load playlist "${PAYG_VIDEO_PLAYLIST_SLUG}"`, error);
  }

  if (!videos.length) {
    videos = await loadFallbackVideos();
  }

  return pickDiverseVideos(videos).map((video) => buildPayAsYouGoShowcaseVideo(video, locale, copy));
}
