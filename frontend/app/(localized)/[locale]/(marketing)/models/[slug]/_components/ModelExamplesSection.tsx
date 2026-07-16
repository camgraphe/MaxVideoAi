import Image from 'next/image';
import {
  AudioLines,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  Type,
  Users,
  Zap,
  PenLine,
  Maximize2,
  type LucideIcon,
} from 'lucide-react';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { ButtonLink } from '@/components/ui/Button';
import { TextLink } from '@/components/ui/TextLink';
import { UIIcon } from '@/components/ui/UIIcon';
import { deriveShortPromptLabel, getImageAlt, inferRenderTag } from '@/lib/image-alt';
import { MODEL_PAGE_ICON, MODEL_PAGE_ICON_WRAP } from '../_lib/model-page-icon-styles';
import type { ModelExampleIconId, ModelExamplesContent } from '../_lib/model-page-examples-content';
import { buildLegacyModelExamplesContent } from '../_lib/model-page-examples-legacy';
import { formatEmptyExamplesLabel, getModelExamplesUiCopy } from '../_lib/model-page-examples-ui-copy';
import { PRICE_AUDIO_LABELS } from '../_lib/model-page-specs-constants';
import {
  FULL_BLEED_CONTENT,
  FULL_BLEED_SECTION,
  SECTION_BG_A,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
  type SoraCopy,
} from '../_lib/model-page-specs';
import {
  ModelDecisionExamplesGallery,
  type DecisionExampleFilter,
  type DecisionExampleFilterId,
  type DecisionExampleGalleryItem,
} from './ModelDecisionExamplesGallery.client';

const MODEL_EXAMPLE_ICON_BY_ID: Record<ModelExampleIconId, LucideIcon> = {
  audio: AudioLines,
  image: ImageIcon,
  maximize: Maximize2,
  pen: PenLine,
  shield: ShieldCheck,
  sparkles: Sparkles,
  type: Type,
  users: Users,
  zap: Zap,
};

const DECISION_EXAMPLE_ALT_PREFIX_BY_SLUG: Record<string, string> = {
  'luma-ray-2': 'Luma Ray 2',
  lumaRay2: 'Luma Ray 2',
  'luma-ray-3-2': 'Luma Ray 3.2',
  'sora-2-pro': 'Sora 2 Pro',
  'sora-2': 'Sora 2',
  'ltx-2-3-fast': 'LTX 2.3 Fast',
  'ltx-2-3-pro': 'LTX 2.3 Pro',
  'ltx-2-3': 'LTX 2.3 Pro',
  'kling-3-pro': 'Kling 3 Pro',
  'kling-3-4k': 'Kling 3 4K',
  'kling-3-standard': 'Kling 3 Standard',
  'veo-3-1-lite': 'Veo 3.1 Lite',
  'veo-3-1': 'Veo 3.1',
  'veo-3-1-fast': 'Veo 3.1 Fast',
  'seedance-2-0-fast': 'Seedance 2.0 Fast',
  'seedance-1-5-pro': 'Seedance 1.5 Pro',
};

const IMAGE_FALLBACK_POSTERS: Record<string, Record<string, string>> = {
  'seedream-5-0-pro': {
    infographic: '/assets/model-examples/seedream-5-0-pro/hero.webp',
    campaign: '/assets/model-examples/seedream-5-0-pro/campaign.webp',
    edit: '/assets/model-examples/seedream-5-0-pro/edit.webp',
    final: '/assets/model-examples/seedream-5-0-pro/final.webp',
  },
  seedream: {
    product: '/assets/model-examples/seedream/product.webp',
    character: '/assets/model-examples/seedream/character.webp',
    edit: '/assets/model-examples/seedream/edit.webp',
    batch: '/assets/model-examples/seedream/batch.webp',
  },
  'gpt-image-2': {
    product: '/assets/model-examples/gpt-image-2/product.webp',
    typography: '/assets/model-examples/gpt-image-2/typography.webp',
    ui: '/assets/model-examples/gpt-image-2/ui.webp',
    edit: '/assets/model-examples/gpt-image-2/edit.webp',
    mask: '/assets/model-examples/gpt-image-2/mask.webp',
    final: '/assets/model-examples/gpt-image-2/final.webp',
  },
  'nano-banana': {
    campaign: '/assets/model-examples/nano-banana/campaign.webp',
    typography: '/assets/model-examples/nano-banana/typography.webp',
    reference: '/assets/model-examples/nano-banana/reference.webp',
    final: '/assets/model-examples/nano-banana/final.webp',
  },
  'nano-banana-lite': {
    campaign: '/assets/model-examples/nano-banana-lite/hero.webp',
    edit: '/assets/model-examples/nano-banana-lite/edit.webp',
    reference: '/assets/model-examples/nano-banana-lite/reference.webp',
    batch: '/assets/model-examples/nano-banana-lite/batch.webp',
  },
  'nano-banana-2': {
    grounded: '/assets/model-examples/nano-banana-2/grounded.webp',
    edit: '/assets/model-examples/nano-banana-2/edit.webp',
    reference: '/assets/model-examples/nano-banana-2/reference.webp',
    wide: '/assets/model-examples/nano-banana-2/wide.webp',
  },
  'luma-uni-1': {
    product: '/assets/model-examples/luma-uni-1/product.webp',
    edit: '/assets/model-examples/luma-uni-1/edit.webp',
    reference: '/assets/model-examples/luma-uni-1/reference.webp',
    campaign: '/assets/model-examples/luma-uni-1/research.webp',
  },
  'luma-uni-1-max': {
    product: '/assets/model-examples/luma-uni-1-max/hero-product.webp',
    typography: '/assets/model-examples/luma-uni-1-max/typography.webp',
    edit: '/assets/model-examples/luma-uni-1-max/edit.webp',
    reference: '/assets/model-examples/luma-uni-1-max/reference.webp',
  },
  'nano-banana-pro': {
    campaign: '/assets/model-examples/nano-banana-pro/campaign.webp',
    typography: '/assets/model-examples/nano-banana-pro/typography.webp',
    reference: '/assets/model-examples/nano-banana-pro/reference.webp',
    final: '/assets/model-examples/nano-banana-pro/final.webp',
  },
};

type ModelExamplesSectionProps = {
  hideExamplesSection: boolean;
  textAnchorId: string;
  copy: SoraCopy;
  galleryVideos: ExampleGalleryVideo[];
  galleryPreviewAlts: Map<string, string>;
  engineSlug: string;
  fallbackImageUrl: string | null;
  isImageEngine: boolean;
  locale: AppLocale;
  examplesLinkHref: LocalizedLinkHref;
  galleryCtaHref: LocalizedLinkHref;
  variant?: 'default' | 'decision';
};

function getExampleMetadata(video: ExampleGalleryVideo, locale: AppLocale) {
  const duration = locale === 'es' || locale === 'fr' ? `${video.durationSec} s` : `${video.durationSec}s`;
  const audioLabels = PRICE_AUDIO_LABELS[locale] ?? PRICE_AUDIO_LABELS.en;
  const audio = video.hasAudio ? audioLabels.on.toLowerCase() : audioLabels.off.toLowerCase();
  return [video.aspectRatio ?? 'Auto', duration, audio].join(' · ');
}

function getDecisionExampleCategory(video: ExampleGalleryVideo, locale: AppLocale) {
  const tag = inferRenderTag(video.promptFull ?? video.prompt, locale);
  if (tag) return tag;
  if (video.hasAudio) return locale === 'fr' ? 'Cinématique' : locale === 'es' ? 'Cinemático' : 'Cinematic';
  return locale === 'fr' ? 'Render' : locale === 'es' ? 'Render' : 'Render';
}

function getDisplayAspectRatio(video: ExampleGalleryVideo) {
  const raw = video.aspectRatio?.trim();
  if (!raw) return null;
  if (/^(16:9|9:16|1:1|4:3|3:4|21:9)$/i.test(raw)) return raw;
  const match = raw.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return raw;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height === 0) return raw;
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.08) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.08) return '9:16';
  if (Math.abs(ratio - 1) < 0.04) return '1:1';
  return raw;
}

function getDurationLabel(video: ExampleGalleryVideo, locale: AppLocale) {
  return locale === 'es' || locale === 'fr' ? `${video.durationSec} s` : `${video.durationSec}s`;
}

function getAudioBadgeLabel(video: ExampleGalleryVideo, locale: AppLocale) {
  const labels = PRICE_AUDIO_LABELS[locale] ?? PRICE_AUDIO_LABELS.en;
  return video.hasAudio ? labels.on : labels.off;
}

function getDecisionExampleTags(
  video: ExampleGalleryVideo,
  category: string,
  aspectRatio: string | null,
  isImageEngine: boolean,
  isSilentVideoEngine: boolean,
): DecisionExampleFilterId[] {
  const categoryText = category.toLowerCase();
  const titleText = deriveShortPromptLabel(video.promptFull ?? video.prompt, 'en').toLowerCase();
  const tags = new Set<DecisionExampleFilterId>();
  if (isImageEngine) {
    if (/\b(campaign|campagne|campaña|ad|poster|launch)\b/.test(`${categoryText} ${titleText}`)) tags.add('campaign');
    if (/\b(type|typography|typographie|tipograf)\b/.test(`${categoryText} ${titleText}`)) tags.add('typography');
    if (/\b(reference|référence|referencia|edit|retouche|edici)/.test(`${categoryText} ${titleText}`)) tags.add('reference');
    if (/\b(4k|final)\b/.test(`${categoryText} ${titleText}`)) tags.add('final');
    return Array.from(tags);
  }
  if (video.hasAudio && !isSilentVideoEngine) tags.add('audio');
  if (aspectRatio === '9:16') tags.add('vertical');
  if (/\b(action|parkour|run|running|chase|combat|sport)\b/.test(`${categoryText} ${titleText}`)) {
    tags.add('action');
  }
  if (/\b(product|produit|producto|ad|pub|anuncio|lifestyle|clothing|try-on|brand|branded)\b/.test(categoryText)) {
    tags.add('product');
  }
  if (/\b(cinematic|cinematique|cinématique|cinematico|cinemático|narrative|narratif|narrativa|romance|film|filmique)\b/.test(categoryText)) {
    tags.add('cinematic');
  }
  return Array.from(tags);
}

function buildDecisionExampleItems({
  galleryVideos,
  galleryPreviewAlts,
  locale,
  recreateLabel,
  isImageEngine,
  isSilentVideoEngine,
  engineSlug,
}: {
  galleryVideos: ExampleGalleryVideo[];
  galleryPreviewAlts: Map<string, string>;
  locale: AppLocale;
  recreateLabel: string | null;
  isImageEngine: boolean;
  isSilentVideoEngine: boolean;
  engineSlug: string;
}): DecisionExampleGalleryItem[] {
  const uiCopy = getModelExamplesUiCopy(locale);
  const altPrefix = DECISION_EXAMPLE_ALT_PREFIX_BY_SLUG[engineSlug];

  return galleryVideos.map((video) => {
    const shortTitle = deriveShortPromptLabel(video.promptFull ?? video.prompt, locale);
    const category = getDecisionExampleCategory(video, locale);
    const aspectRatio = getDisplayAspectRatio(video);
    const posterUrl = video.optimizedPosterUrl ?? video.rawPosterUrl ?? '';
    return {
      id: video.id,
      href: video.href,
      posterUrl,
      alt: altPrefix
        ? `${altPrefix} ${shortTitle.toLowerCase()}`
        : (galleryPreviewAlts.get(video.id) ?? `${video.engineLabel} example: ${shortTitle}`),
      audioBadgeLabel: isImageEngine
        ? null
        : isSilentVideoEngine
          ? uiCopy.silentLabel
          : getAudioBadgeLabel(video, locale),
      durationLabel: isImageEngine ? null : getDurationLabel(video, locale),
      aspectRatio,
      category,
      title: shortTitle,
      recreateHref: video.recreateHref ?? null,
      recreateLabel,
      tags: getDecisionExampleTags(
        video,
        category,
        aspectRatio,
        isImageEngine,
        isSilentVideoEngine,
      ),
    };
  });
}

function buildImageFallbackGalleryItems({
  contentItems,
  engineSlug,
  fallbackImageUrl,
  recreateLabel,
}: {
  contentItems: NonNullable<ModelExamplesContent['fallbackItems']>;
  engineSlug: string;
  fallbackImageUrl: string | null;
  recreateLabel: string | null;
}): DecisionExampleGalleryItem[] {
  const appHref = `/app/image?engine=${encodeURIComponent(engineSlug)}`;
  return contentItems.map((item) => ({
    id: `${engineSlug}-fallback-${item.id}`,
    href: appHref,
    posterUrl: IMAGE_FALLBACK_POSTERS[engineSlug]?.[item.id] ?? fallbackImageUrl ?? '',
    alt: item.alt,
    audioBadgeLabel: null,
    durationLabel: null,
    aspectRatio: item.aspectRatio,
    category: item.category,
    title: item.title,
    recreateHref: appHref,
    recreateLabel,
    tags: item.tags as DecisionExampleFilterId[],
  }));
}

function getAvailableDecisionExampleFilters(
  filters: ModelExamplesContent['filters'],
  items: DecisionExampleGalleryItem[],
): DecisionExampleFilter[] {
  const availableIds = new Set(items.flatMap((item) => item.tags));
  return filters.filter((filter) => filter.id === 'all' || availableIds.has(filter.id));
}

function ModelDecisionExamplesPanel({
  textAnchorId,
  copy,
  galleryVideos,
  galleryPreviewAlts,
  engineSlug,
  fallbackImageUrl,
  isImageEngine,
  locale,
  examplesLinkHref,
}: Omit<ModelExamplesSectionProps, 'hideExamplesSection' | 'galleryCtaHref' | 'variant'>) {
  const legacyContent = buildLegacyModelExamplesContent({
    modelSlug: engineSlug,
    locale,
    copy,
    imageFallbackActive: isImageEngine,
  });
  const uiCopy = getModelExamplesUiCopy(locale);
  const renderLinkLabel = isImageEngine ? uiCopy.openLabel : uiCopy.renderLabel;
  const modelName = (copy.heroTitle ?? copy.galleryTitle ?? '')
    .replace(/\s+(?:examples|exemples|ejemplos)\b.*$/i, '')
    .replace(/\s+-\s+.*$/i, '')
    .trim() || 'this model';
  const isSilentVideoEngine =
    !isImageEngine && !legacyContent.filters.some((filter) => filter.id === 'audio');
  const galleryItems = buildDecisionExampleItems({
    galleryVideos,
    galleryPreviewAlts,
    locale,
    recreateLabel: legacyContent.section.recreateLabel,
    isImageEngine,
    isSilentVideoEngine,
    engineSlug,
  });
  const fallbackItems = legacyContent.fallbackItems
    ? buildImageFallbackGalleryItems({
        contentItems: legacyContent.fallbackItems,
        engineSlug,
        fallbackImageUrl,
        recreateLabel: legacyContent.section.recreateLabel,
      })
    : [];
  const items = galleryItems.length ? galleryItems : fallbackItems;
  const resolvedExamplesLinkHref = isImageEngine && !galleryVideos.length ? null : examplesLinkHref;
  const filters = getAvailableDecisionExampleFilters(legacyContent.filters, items);

  return (
    <section id={textAnchorId} className={SECTION_SCROLL_MARGIN}>
      <div className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:bg-slate-950/72 dark:shadow-[0_24px_70px_-42px_rgba(0,0,0,0.85)] sm:p-7">
        <ModelDecisionExamplesGallery
          title={legacyContent.section.title}
          intro={legacyContent.section.intro}
          filters={filters}
          items={items}
          examplesLinkHref={resolvedExamplesLinkHref}
          viewAllLabel={legacyContent.section.defaultCtaLabel ?? uiCopy.viewAllLabel}
          renderLinkLabel={renderLinkLabel}
          emptyLabel={formatEmptyExamplesLabel(uiCopy, modelName)}
        />

        <div className="mt-4 grid grid-cols-2 rounded-xl border border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.035] lg:grid-cols-5">
          {legacyContent.proofItems.map((item, index) => (
            <div
              key={item.title}
              className={[
                'flex gap-2.5 p-3 sm:gap-3 sm:p-4',
                index % 2 === 1 ? 'border-l border-slate-200 dark:border-white/10' : '',
                index >= 2 ? 'border-t border-slate-200 dark:border-white/10 lg:border-t-0' : '',
                index > 0 ? 'lg:border-l lg:border-slate-200 dark:lg:border-white/10' : '',
              ].join(' ')}
            >
              <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${MODEL_PAGE_ICON_WRAP}`}>
                <UIIcon icon={MODEL_EXAMPLE_ICON_BY_ID[item.icon]} size={19} strokeWidth={1.85} className={MODEL_PAGE_ICON} />
              </span>
              <div>
                <h3 className="!text-left text-[0.82rem] font-semibold leading-snug text-slate-950 dark:text-white sm:text-sm">{item.title}</h3>
                <p className="mt-1 text-[0.74rem] leading-4 text-slate-600 dark:text-slate-300 sm:text-[0.8rem] sm:leading-5">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ModelExamplesSection({
  hideExamplesSection,
  textAnchorId,
  copy,
  galleryVideos,
  galleryPreviewAlts,
  engineSlug,
  fallbackImageUrl,
  isImageEngine,
  locale,
  examplesLinkHref,
  galleryCtaHref,
  variant = 'default',
}: ModelExamplesSectionProps) {
  const hasFallbackGalleryCopy = Boolean(
    copy.galleryTitle || copy.galleryIntro || copy.galleryAllCta || copy.gallerySceneCta
  );

  if (hideExamplesSection || (!galleryVideos.length && !hasFallbackGalleryCopy && !isImageEngine)) {
    return null;
  }

  const renderLinkLabel = getModelExamplesUiCopy(locale).renderLabel;

  if (variant === 'decision') {
    return (
      <ModelDecisionExamplesPanel
        textAnchorId={textAnchorId}
        copy={copy}
        galleryVideos={galleryVideos}
        galleryPreviewAlts={galleryPreviewAlts}
        engineSlug={engineSlug}
        fallbackImageUrl={fallbackImageUrl}
        isImageEngine={isImageEngine}
        locale={locale}
        examplesLinkHref={examplesLinkHref}
      />
    );
  }

  return (
    <section id={textAnchorId} className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN}`}>
      <div className={`${FULL_BLEED_CONTENT} px-6 sm:px-8`}>
        {copy.galleryTitle ? (
          <h2 className="mt-0 text-center text-2xl font-semibold text-text-primary sm:mt-0 sm:text-3xl">
            {copy.galleryTitle}
          </h2>
        ) : null}
        {galleryVideos.length ? (
          <>
            {copy.galleryIntro ? (
              <p className="mt-2 text-center text-base leading-relaxed text-text-secondary">{copy.galleryIntro}</p>
            ) : null}
            <div className="mt-4 stack-gap">
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-full gap-4">
                  {galleryVideos.slice(0, 6).map((video) => (
                    <article
                      key={video.id}
                      className="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card"
                    >
                      <Link href={video.href} className="group relative block aspect-video bg-placeholder">
                        {video.optimizedPosterUrl || video.rawPosterUrl ? (
                          <Image
                            src={video.optimizedPosterUrl ?? video.rawPosterUrl ?? ''}
                            alt={
                              galleryPreviewAlts.get(video.id) ??
                              getImageAlt({
                                kind: 'renderThumb',
                                engine: video.engineLabel,
                                label: video.prompt,
                                prompt: video.prompt,
                                locale,
                              })
                            }
                            fill
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                            sizes="320px"
                            quality={70}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-skeleton text-xs font-semibold text-text-muted">
                            No preview
                          </div>
                        )}
                      </Link>
                      <div className="space-y-1 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                          {getExampleMetadata(video, locale)}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <TextLink href={video.href} className="text-[11px]" linkComponent={Link}>
                            {renderLinkLabel}
                          </TextLink>
                          {video.recreateHref && copy.recreateLabel ? (
                            <TextLink href={video.recreateHref} className="text-[11px]" linkComponent={Link}>
                              {copy.recreateLabel}
                            </TextLink>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
            {copy.galleryAllCta ? (
              <p className="mt-4 text-center text-base leading-relaxed text-text-secondary">
                <Link href={examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                  {copy.galleryAllCta}
                </Link>
              </p>
            ) : null}
          </>
        ) : copy.galleryIntro || copy.galleryAllCta ? (
          <div className="mt-4 rounded-2xl border border-dashed border-hairline bg-surface/60 px-4 py-4 text-sm text-text-secondary">
            {copy.galleryIntro}{' '}
            {copy.galleryAllCta ? (
              <Link href={examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                {copy.galleryAllCta}
              </Link>
            ) : null}
          </div>
        ) : null}
        {copy.gallerySceneCta ? (
          <div className="mt-6">
            <ButtonLink href={galleryCtaHref} size="lg" className="shadow-card" linkComponent={Link}>
              {copy.gallerySceneCta}
            </ButtonLink>
          </div>
        ) : null}
      </div>
    </section>
  );
}
