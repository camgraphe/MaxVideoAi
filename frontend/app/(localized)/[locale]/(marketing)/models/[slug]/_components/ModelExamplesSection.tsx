import Image from 'next/image';
import {
  AudioLines,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
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

type ModelExamplesSectionProps = {
  hideExamplesSection: boolean;
  textAnchorId: string;
  copy: SoraCopy;
  galleryVideos: ExampleGalleryVideo[];
  galleryPreviewAlts: Map<string, string>;
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

function getRenderLinkLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Voir le rendu';
  if (locale === 'es') return 'Ver resultado';
  return 'View render';
}

function getViewAllExamplesLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Voir tous les exemples';
  if (locale === 'es') return 'Ver todos los ejemplos';
  return 'View all examples';
}

function getNoExamplesForFilterLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Aucun exemple Seedance 2.0 ne correspond encore à ce filtre.';
  if (locale === 'es') return 'Todavía no hay ejemplos de Seedance 2.0 para este filtro.';
  return 'No Seedance 2.0 examples match this filter yet.';
}

function getFallbackExamplesTitle(locale: AppLocale) {
  if (locale === 'fr') return 'Exemples Seedance 2.0';
  if (locale === 'es') return 'Ejemplos de Seedance 2.0';
  return 'Seedance 2.0 examples';
}

function getFallbackExamplesIntro(locale: AppLocale) {
  if (locale === 'fr') {
    return 'Explorez des rendus de la communauté et voyez comment Seedance 2.0 gère le mouvement, la continuité et l’audio natif.';
  }
  if (locale === 'es') {
    return 'Explora resultados de la comunidad y mira cómo Seedance 2.0 maneja movimiento, continuidad y audio nativo.';
  }
  return 'Explore real outputs from the community and see how Seedance 2.0 handles motion, continuity and native audio.';
}

function getDecisionExampleFilters(locale: AppLocale): DecisionExampleFilter[] {
  if (locale === 'fr') {
    return [
      { id: 'all', label: 'Tous' },
      { id: 'cinematic', label: 'Cinématique' },
      { id: 'product', label: 'Produit / Pub' },
      { id: 'action', label: 'Action' },
      { id: 'vertical', label: 'Vertical' },
      { id: 'audio', label: PRICE_AUDIO_LABELS.fr.on },
    ];
  }
  if (locale === 'es') {
    return [
      { id: 'all', label: 'Todo' },
      { id: 'cinematic', label: 'Cinemático' },
      { id: 'product', label: 'Producto / Anuncio' },
      { id: 'action', label: 'Acción' },
      { id: 'vertical', label: 'Vertical' },
      { id: 'audio', label: PRICE_AUDIO_LABELS.es.on },
    ];
  }
  return [
    { id: 'all', label: 'All' },
    { id: 'cinematic', label: 'Cinematic' },
    { id: 'product', label: 'Product / Ad' },
    { id: 'action', label: 'Action' },
    { id: 'vertical', label: 'Vertical' },
    { id: 'audio', label: 'Audio on' },
  ];
}

function getDecisionExampleProofItems(locale: AppLocale): Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  tone: string;
}> {
  if (locale === 'fr') {
    return [
      { title: 'Rendus communautaires', body: 'Voyez ce qui est possible avec Seedance 2.0.', icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Recréer un plan', body: 'Ouvrez l’app en un clic et réutilisez la configuration.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Audio natif', body: 'Dialogue, ambiance et SFX générés en synchro.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Continuité multi-plans', body: 'Gardez personnages, style et scène cohérents.', icon: Users, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Prêt pour la production', body: 'Garde-fous et filtres intégrés.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
    ];
  }

  if (locale === 'es') {
    return [
      { title: 'Resultados reales', body: 'Mira qué es posible con Seedance 2.0.', icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Recrear una toma', body: 'Abre la app con un clic y reutiliza la configuración.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Audio nativo', body: 'Diálogo, ambiente y efectos de sonido generados en sincronía.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Continuidad entre tomas', body: 'Mantiene personajes, estilo y escena consistentes.', icon: Users, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Listo para producción', body: 'Controles de seguridad y filtros integrados.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
    ];
  }

  return [
    { title: 'Real community renders', body: "See what's possible with Seedance 2.0.", icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
    { title: 'Recreate any shot', body: 'Jump into the app with one click and reuse the setup.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
    { title: 'Native audio', body: 'Dialogue, ambience and SFX generated in sync.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
    { title: 'Multi-shot continuity', body: 'Keep characters, style and scene consistency across sequences.', icon: Users, tone: MODEL_PAGE_ICON_WRAP },
    { title: 'Safe for production', body: 'Built-in guardrails and safety filters for peace of mind.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
  ];
}

function getDecisionExampleCategory(video: ExampleGalleryVideo, locale: AppLocale) {
  const tag = inferRenderTag(video.promptFull ?? video.prompt, locale);
  if (tag) return tag;
  if (video.hasAudio) return locale === 'fr' ? 'Cinématique' : locale === 'es' ? 'Cinemático' : 'Cinematic';
  return locale === 'fr' ? 'Render' : locale === 'es' ? 'Render' : 'Render';
}

function getCuratedDecisionExampleTitle(index: number, fallback: string, locale: AppLocale) {
  const labels: Record<AppLocale, string[]> = {
    en: ['Parkour rooftop run', 'Trading desk intensity', 'Clothing try-on moment', 'Warm kitchen reunion'],
    fr: ['Parkour sur toit', 'Intensité en salle de trading', 'Essayage de vêtement', 'Retrouvailles en cuisine'],
    es: ['Parkour en azotea', 'Intensidad mesa de trading', 'Prueba de ropa', 'Reencuentro en cocina'],
  };
  return labels[locale]?.[index] ?? fallback;
}

function getCuratedDecisionExampleCategory(index: number, fallback: string, locale: AppLocale) {
  const labels: Record<AppLocale, string[]> = {
    en: ['Cinematic · Action', 'Corporate · Tech', 'Lifestyle · Product', 'Narrative · Romance'],
    fr: ['Cinématique · Action', 'Corporate · Tech', 'Lifestyle · Produit', 'Narratif · Romance'],
    es: ['Cinemático · Acción', 'Corporativo · Tech', 'Lifestyle · Producto', 'Narrativa · Romance'],
  };
  return labels[locale]?.[index] ?? fallback;
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
  aspectRatio: string | null
): DecisionExampleFilterId[] {
  const categoryText = category.toLowerCase();
  const titleText = deriveShortPromptLabel(video.promptFull ?? video.prompt, 'en').toLowerCase();
  const tags = new Set<DecisionExampleFilterId>();
  if (video.hasAudio) tags.add('audio');
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
  copy,
}: {
  galleryVideos: ExampleGalleryVideo[];
  galleryPreviewAlts: Map<string, string>;
  locale: AppLocale;
  copy: SoraCopy;
}): DecisionExampleGalleryItem[] {
  return galleryVideos.slice(0, 4).map((video, index) => {
    const fallbackTitle = deriveShortPromptLabel(video.promptFull ?? video.prompt, locale);
    const shortTitle = getCuratedDecisionExampleTitle(index, fallbackTitle, locale);
    const category = getCuratedDecisionExampleCategory(index, getDecisionExampleCategory(video, locale), locale);
    const aspectRatio = getDisplayAspectRatio(video);
    const posterUrl = video.optimizedPosterUrl ?? video.rawPosterUrl ?? '';
    return {
      id: video.id,
      href: video.href,
      posterUrl,
      alt: galleryPreviewAlts.get(video.id) ?? `${video.engineLabel} example: ${shortTitle}`,
      audioBadgeLabel: getAudioBadgeLabel(video, locale),
      durationLabel: getDurationLabel(video, locale),
      aspectRatio,
      category,
      title: shortTitle,
      recreateHref: video.recreateHref ?? null,
      recreateLabel: copy.recreateLabel ?? null,
      tags: getDecisionExampleTags(video, category, aspectRatio),
    };
  });
}

function getAvailableDecisionExampleFilters(locale: AppLocale, items: DecisionExampleGalleryItem[]) {
  const filters = getDecisionExampleFilters(locale);
  const availableIds = new Set(items.flatMap((item) => item.tags));
  return filters.filter((filter) => filter.id === 'all' || availableIds.has(filter.id));
}

function ModelDecisionExamplesPanel({
  textAnchorId,
  copy,
  galleryVideos,
  galleryPreviewAlts,
  locale,
  examplesLinkHref,
}: Omit<ModelExamplesSectionProps, 'hideExamplesSection' | 'galleryCtaHref' | 'variant'>) {
  const renderLinkLabel = getRenderLinkLabel(locale);
  const proofItems = getDecisionExampleProofItems(locale);
  const title = copy.galleryTitle ?? getFallbackExamplesTitle(locale);
  const intro = copy.galleryIntro ?? getFallbackExamplesIntro(locale);
  const galleryItems = buildDecisionExampleItems({ galleryVideos, galleryPreviewAlts, locale, copy });
  const filters = getAvailableDecisionExampleFilters(locale, galleryItems);

  return (
    <section id={textAnchorId} className={SECTION_SCROLL_MARGIN}>
      <div className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:bg-slate-950/72 dark:shadow-[0_24px_70px_-42px_rgba(0,0,0,0.85)] sm:p-7">
        <ModelDecisionExamplesGallery
          title={title}
          intro={intro}
          filters={filters}
          items={galleryItems}
          examplesLinkHref={examplesLinkHref}
          viewAllLabel={getViewAllExamplesLabel(locale)}
          renderLinkLabel={renderLinkLabel}
          emptyLabel={getNoExamplesForFilterLabel(locale)}
        />

        <div className="mt-4 grid grid-cols-2 rounded-xl border border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.035] lg:grid-cols-5">
          {proofItems.map((item, index) => (
            <div
              key={item.title}
              className={[
                'flex gap-2.5 p-3 sm:gap-3 sm:p-4',
                index % 2 === 1 ? 'border-l border-slate-200 dark:border-white/10' : '',
                index >= 2 ? 'border-t border-slate-200 dark:border-white/10 lg:border-t-0' : '',
                index > 0 ? 'lg:border-l lg:border-slate-200 dark:lg:border-white/10' : '',
              ].join(' ')}
            >
              <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${item.tone}`}>
                <UIIcon icon={item.icon} size={19} strokeWidth={1.85} className={MODEL_PAGE_ICON} />
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
  locale,
  examplesLinkHref,
  galleryCtaHref,
  variant = 'default',
}: ModelExamplesSectionProps) {
  const hasFallbackGalleryCopy = Boolean(
    copy.galleryTitle || copy.galleryIntro || copy.galleryAllCta || copy.gallerySceneCta
  );

  if (hideExamplesSection || (!galleryVideos.length && !hasFallbackGalleryCopy)) {
    return null;
  }

  const renderLinkLabel = getRenderLinkLabel(locale);

  if (variant === 'decision') {
    return (
      <ModelDecisionExamplesPanel
        textAnchorId={textAnchorId}
        copy={copy}
        galleryVideos={galleryVideos}
        galleryPreviewAlts={galleryPreviewAlts}
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
