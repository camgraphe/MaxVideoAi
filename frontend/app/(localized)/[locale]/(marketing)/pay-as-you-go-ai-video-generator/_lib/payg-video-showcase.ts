import { isDatabaseConfigured } from '@/lib/db';
import type { AppLocale } from '@/i18n/locales';
import { listGalleryVideos, listPlaylistVideos, type GalleryVideo } from '@/server/videos';

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

function formatVideoPrice(video: GalleryVideo, locale: AppLocale) {
  if (typeof video.finalPriceCents !== 'number' || !Number.isFinite(video.finalPriceCents)) {
    return locale === 'es' ? 'Precio visible antes de generar' : locale === 'fr' ? 'Prix affiché avant la génération' : 'Price shown first';
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

const VIDEO_TITLE_RULES: Array<{ pattern: RegExp; title: string }> = [
  { pattern: /rooftop|chase|reunion/i, title: 'Cinematic rooftop chase' },
  { pattern: /museum|curator|gallery/i, title: 'Museum curator walkthrough' },
  { pattern: /animate this image|image into|smooth animation/i, title: 'Smooth image-to-video animation' },
  { pattern: /provided image|reference image/i, title: 'Image-guided cinematic scene' },
  { pattern: /female racer|racer/i, title: 'Female racer character test' },
  { pattern: /selfie|ugc|vertical/i, title: 'Vertical UGC selfie test' },
  { pattern: /warrior|temple/i, title: 'Dark warrior temple scene' },
  { pattern: /product|packshot|bottle|perfume/i, title: 'Product image-to-video test' },
  { pattern: /cinematic|studio lighting|camera push/i, title: 'Cinematic product reveal' },
];

function formatVideoTitle(prompt: string, engineLabel: string, locale: AppLocale) {
  const cleaned = cleanPromptText(prompt);
  const matchedTitle = VIDEO_TITLE_RULES.find(({ pattern }) => pattern.test(cleaned))?.title;
  const translatedTitles: Record<AppLocale, Record<string, string>> = {
    en: {},
    es: { 'Cinematic rooftop chase': 'Persecución cinematográfica en una azotea', 'Museum curator walkthrough': 'Recorrido de una curadora de museo', 'Smooth image-to-video animation': 'Animación fluida de imagen a video', 'Image-guided cinematic scene': 'Escena cinematográfica guiada por imagen', 'Female racer character test': 'Prueba de personaje de piloto', 'Vertical UGC selfie test': 'Prueba de selfie UGC vertical', 'Dark warrior temple scene': 'Escena de guerrero en un templo oscuro', 'Product image-to-video test': 'Prueba de producto de imagen a video', 'Cinematic product reveal': 'Presentación cinematográfica de producto' },
    fr: { 'Cinematic rooftop chase': 'Poursuite cinématographique sur un toit', 'Museum curator walkthrough': 'Visite guidée par une conservatrice de musée', 'Smooth image-to-video animation': 'Animation fluide d’image vers vidéo', 'Image-guided cinematic scene': 'Scène cinématographique guidée par image', 'Female racer character test': 'Essai de personnage de pilote', 'Vertical UGC selfie test': 'Essai de selfie UGC vertical', 'Dark warrior temple scene': 'Scène de guerrier dans un temple sombre', 'Product image-to-video test': 'Essai produit d’image vers vidéo', 'Cinematic product reveal': 'Présentation produit cinématographique' },
  };
  if (matchedTitle) return translatedTitles[locale][matchedTitle] ?? matchedTitle;
  if (/image|reference|photo/i.test(cleaned)) return locale === 'es' ? 'Escena cinematográfica guiada por imagen' : locale === 'fr' ? 'Scène cinématographique guidée par image' : 'Image-guided cinematic scene';
  if (/character|person|portrait|actor/i.test(cleaned)) return locale === 'es' ? 'Prueba de movimiento de personaje' : locale === 'fr' ? 'Essai de mouvement de personnage' : 'Character motion test';
  if (/text-to-video|prompt/i.test(cleaned)) return locale === 'es' ? 'Prueba de prompt de texto a video' : locale === 'fr' ? 'Essai de prompt texte vers vidéo' : 'Text-to-video prompt test';
  return locale === 'es' ? `Render de ejemplo con ${engineLabel || 'video IA'}` : locale === 'fr' ? `Rendu d’exemple avec ${engineLabel || 'vidéo IA'}` : `${engineLabel || 'AI video'} example render`;
}

function formatVideoUseCase(video: GalleryVideo, locale: AppLocale) {
  const copy = (en: string, es: string, fr: string) => ({ en, es, fr })[locale];
  const searchText = videoModelSearchText(video);
  if (/seedance.*mini|dreamina/i.test(searchText)) return copy('Lighter multimodal test before scaling.', 'Prueba multimodal ligera antes de escalar.', 'Essai multimodal léger avant de passer à l’échelle.');
  if (/seedance/i.test(searchText)) return copy('Current benchmark render for model testing.', 'Render de referencia para probar modelos.', 'Rendu de référence pour tester les modèles.');
  if (/kling/i.test(searchText)) return copy('Motion-control or image-to-video test.', 'Prueba de control de movimiento o de imagen a video.', 'Essai de contrôle du mouvement ou d’image vers vidéo.');
  if (/\b(?:google\s+)?veo\b/i.test(searchText)) return copy('Cinematic quality and prompt-following test.', 'Prueba de calidad cinematográfica y seguimiento de prompt.', 'Essai de qualité cinématographique et de suivi de prompt.');
  if (/happy\s*-?\s*horse/i.test(searchText)) {
    const isHappyHorse11 = /happy\s*-?\s*horse[\s-]*(?:v)?1(?:\.|-)?1|(?:v)?1(?:\.|-)?1[\s-]*happy\s*-?\s*horse/i.test(
      searchText
    );
    const isEarlierHappyHorse = /happy\s*-?\s*horse[\s-]*(?:v)?1(?:\.|-)?0|(?:v)?1(?:\.|-)?0[\s-]*happy\s*-?\s*horse/i.test(
      searchText
    );
    if (isEarlierHappyHorse && !isHappyHorse11) return copy('Earlier Happy Horse render used as an Alibaba-route example.', 'Render anterior de Happy Horse usado como ejemplo de la opción de Alibaba.', 'Ancien rendu Happy Horse utilisé comme exemple de l’option Alibaba.');
    if (isHappyHorse11) return copy('Happy Horse 1.1 alternate Alibaba video route.', 'Opción alternativa de video Alibaba con Happy Horse 1.1.', 'Option vidéo Alibaba alternative avec Happy Horse 1.1.');
    return copy('Alternate Alibaba video route.', 'Opción de video Alibaba alternativa.', 'Option vidéo Alibaba alternative.');
  }
  if (/\bltx\b/i.test(searchText)) return copy('Efficient draft and prompt-iteration test.', 'Prueba de borrador eficiente e iteración de prompt.', 'Essai de brouillon efficace et d’itération de prompt.');
  if (/\bwan\b/i.test(searchText)) return copy('Budget-aware text or image-to-video test.', 'Prueba económica de texto o imagen a video.', 'Essai économique de texte ou d’image vers vidéo.');
  return copy('Public render with model and price context.', 'Render público con modelo y contexto de precio.', 'Rendu public avec modèle et contexte de prix.');
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

function toShowcaseVideo(video: GalleryVideo, locale: AppLocale): PayAsYouGoShowcaseVideo {
  const duration = Math.max(1, Math.round(video.durationSec || 0));
  return {
    id: video.id,
    engineId: video.engineId,
    engineLabel: video.engineLabel || video.engineId || 'AI video model',
    priceLabel: formatVideoPrice(video, locale),
    durationLabel: `${duration}s`,
    title: formatVideoTitle(video.promptExcerpt || video.prompt || '', video.engineLabel || video.engineId || 'AI video', locale),
    useCase: formatVideoUseCase(video, locale),
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

export async function loadPayAsYouGoVideoShowcase(locale: AppLocale): Promise<PayAsYouGoShowcaseVideo[]> {
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

  return pickDiverseVideos(videos).map((video) => toShowcaseVideo(video, locale));
}
