import type { HomeExampleCard } from '@/components/marketing/home/HomeRedesignSections';
import {
  findModelLaunchReadiness,
  type ModelLaunchReadinessEntry,
} from '@/config/model-launch-readiness';
import type { RuntimeModelEntry } from '@/config/model-runtime';
import type { AppLocale } from '@/i18n/locales';
import { normalizeEngineId } from '@/lib/engine-alias';
import type { AcceptedDurableModelAsset } from '@/server/model-launch-assets-validation';
import type { GalleryVideo } from '@/server/videos';
import { formatCurrency } from './formatting';
import type { HomepageExampleFamily, RedesignContent } from './types';

const P0_PROMOTION_CANDIDATES = [
  { family: 'ltx', modelId: 'ltx-2-5-pro', label: 'LTX 2.5 Pro' },
  { family: 'wan', modelId: 'wan-3-prime', label: 'Wan 3 Prime' },
  { family: 'grok', modelId: 'grok-imagine-video-1-5', label: 'Grok Imagine Video 1.5' },
  { family: 'flux', modelId: 'flux-3', label: 'FLUX 3' },
] as const satisfies ReadonlyArray<{ family: HomepageExampleFamily; modelId: string; label: string }>;

export type HomepageP0PromotionTarget = (typeof P0_PROMOTION_CANDIDATES)[number] & {
  readiness: ModelLaunchReadinessEntry;
};

export function buildHomepageP0PromotionTargets({
  models,
  readiness,
}: {
  models: readonly RuntimeModelEntry[];
  readiness: readonly ModelLaunchReadinessEntry[];
}): HomepageP0PromotionTarget[] {
  const byId = new Map(models.map((model) => [model.id, model]));
  return P0_PROMOTION_CANDIDATES.flatMap((candidate) => {
    const model = byId.get(candidate.modelId);
    const accepted = findModelLaunchReadiness(candidate.modelId, readiness);
    if (
      !model ||
      model.lifecycle !== 'current' ||
      !model.publication.model.published ||
      !model.publication.examples.published ||
      !accepted
    ) {
      return [];
    }
    return [{ ...candidate, readiness: accepted }];
  });
}

function isDurablePublicMediaUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'media.maxvideoai.com';
  } catch {
    return false;
  }
}

function findPublicLaunchVideo(
  videos: readonly GalleryVideo[],
  modelId: string,
  acceptedAssets: readonly AcceptedDurableModelAsset[],
): GalleryVideo | null {
  const normalizedModelId = normalizeEngineId(modelId) ?? modelId;
  const acceptedVideoIds = new Set(acceptedAssets
    .filter((asset) => asset.modelId === modelId && asset.engineId === modelId)
    .map(({ videoId }) => videoId));
  const matches = videos.filter((video) => (
    acceptedVideoIds.has(video.id) &&
    video.visibility === 'public' &&
    video.indexable &&
    isDurablePublicMediaUrl(video.thumbUrl) &&
    isDurablePublicMediaUrl(video.videoUrl) &&
    (normalizeEngineId(video.engineId) ?? video.engineId) === normalizedModelId
  ));
  return matches.find((video) => video.aspectRatio === '16:9') ?? matches[0] ?? null;
}

export function buildHomepageP0PromotionCards({
  locale,
  content,
  targets,
  modelVideos,
  acceptedAssets,
}: {
  locale: AppLocale;
  content: RedesignContent;
  targets: readonly HomepageP0PromotionTarget[];
  modelVideos: ReadonlyMap<string, GalleryVideo[]>;
  acceptedAssets: readonly AcceptedDurableModelAsset[];
}): HomeExampleCard[] {
  return targets.flatMap<HomeExampleCard>((target) => {
    const video = findPublicLaunchVideo(
      modelVideos.get(target.modelId) ?? [],
      target.modelId,
      acceptedAssets,
    );
    if (!video?.thumbUrl || !video.videoUrl) return [];
    return [{
      id: `launch-${target.modelId}`,
      title: target.label,
      engineId: target.modelId,
      engine: target.label,
      mode: content.modeLabels?.t2v ?? 'Text-to-video',
      duration: `${video.durationSec}${locale === 'fr' ? ' s' : 's'}`,
      price: formatCurrency(locale, video.currency, video.finalPriceCents),
      useCase: locale === 'fr' ? 'Nouvelle génération' : locale === 'es' ? 'Nueva generación' : 'New generation',
      imageSrc: video.thumbUrl,
      videoSrc: video.videoUrl,
      imageAlt: locale === 'fr'
        ? `Exemple vidéo généré avec ${target.label}`
        : locale === 'es' ? `Ejemplo de vídeo generado con ${target.label}` : `Video example generated with ${target.label}`,
      href: { pathname: '/examples/[model]', params: { model: target.family } },
      modelHref: { pathname: '/models/[slug]', params: { slug: target.modelId } },
      ctaLabel: content.examples.cta ?? 'View examples',
      examplesCtaVisible: true,
      modelCtaLabel: (content.examples.modelCta ?? 'Discover {model}').replace('{model}', target.label),
      cloneLabel: content.examples.viewPrompt,
    }];
  });
}
