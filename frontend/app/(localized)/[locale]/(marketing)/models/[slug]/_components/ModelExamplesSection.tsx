import Image from 'next/image';
import {
  ArrowRight,
  AudioLines,
  ChevronRight,
  ExternalLink,
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
import {
  FULL_BLEED_CONTENT,
  FULL_BLEED_SECTION,
  SECTION_BG_A,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
  type SoraCopy,
} from '../_lib/model-page-specs';

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
  const audio = video.hasAudio
    ? locale === 'fr'
      ? 'audio on'
      : locale === 'es'
        ? 'audio activado'
        : 'audio on'
    : locale === 'fr'
      ? 'audio off'
      : locale === 'es'
        ? 'audio desactivado'
        : 'audio off';
  return [video.aspectRatio ?? 'Auto', duration, audio].join(' · ');
}

function getRenderLinkLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Voir le rendu';
  if (locale === 'es') return 'Ver render';
  return 'View render';
}

function getViewAllExamplesLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Voir tous les exemples';
  if (locale === 'es') return 'Ver todos los ejemplos';
  return 'View all examples';
}

function getFallbackExamplesTitle(locale: AppLocale) {
  if (locale === 'fr') return 'Exemples Seedance 2.0';
  if (locale === 'es') return 'Ejemplos de Seedance 2.0';
  return 'Seedance 2.0 examples';
}

function getFallbackExamplesIntro(locale: AppLocale) {
  if (locale === 'fr') {
    return 'Explorez des rendus de la communaute et voyez comment Seedance 2.0 gere le mouvement, la continuite et l audio natif.';
  }
  if (locale === 'es') {
    return 'Explora renders de la comunidad y mira como Seedance 2.0 maneja movimiento, continuidad y audio nativo.';
  }
  return 'Explore real outputs from the community and see how Seedance 2.0 handles motion, continuity and native audio.';
}

function getDecisionExampleFilters(locale: AppLocale) {
  if (locale === 'fr') return ['Tous', 'Cinematique', 'Produit / Pub', 'Action', 'Vertical', 'Audio on'];
  if (locale === 'es') return ['Todo', 'Cinematico', 'Producto / Anuncio', 'Accion', 'Vertical', 'Audio on'];
  return ['All', 'Cinematic', 'Product / Ad', 'Action', 'Vertical', 'Audio on'];
}

function getDecisionExampleProofItems(locale: AppLocale): Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  tone: string;
}> {
  if (locale === 'fr') {
    return [
      { title: 'Rendus communautaires', body: 'Voyez ce qui est possible avec Seedance 2.0.', icon: Sparkles, tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300' },
      { title: 'Recreer un shot', body: 'Ouvrez l app en un clic et reutilisez la configuration.', icon: Zap, tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300' },
      { title: 'Audio natif', body: 'Dialogue, ambience et SFX generes en sync.', icon: AudioLines, tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300' },
      { title: 'Continuite multi-shot', body: 'Gardez personnages, style et scene coherents.', icon: Users, tone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/12 dark:text-violet-300' },
      { title: 'Pret pour la production', body: 'Garde-fous et filtres integres.', icon: ShieldCheck, tone: 'bg-orange-50 text-orange-600 dark:bg-orange-500/12 dark:text-orange-300' },
    ];
  }

  if (locale === 'es') {
    return [
      { title: 'Renders reales', body: 'Mira que es posible con Seedance 2.0.', icon: Sparkles, tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300' },
      { title: 'Recrear un shot', body: 'Abre la app con un clic y reutiliza la configuracion.', icon: Zap, tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300' },
      { title: 'Audio nativo', body: 'Dialogo, ambiente y SFX generados en sync.', icon: AudioLines, tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300' },
      { title: 'Continuidad multi-shot', body: 'Mantiene personajes, estilo y escena consistentes.', icon: Users, tone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/12 dark:text-violet-300' },
      { title: 'Listo para produccion', body: 'Guardrails y filtros integrados.', icon: ShieldCheck, tone: 'bg-orange-50 text-orange-600 dark:bg-orange-500/12 dark:text-orange-300' },
    ];
  }

  return [
    { title: 'Real community renders', body: "See what's possible with Seedance 2.0.", icon: Sparkles, tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300' },
    { title: 'Recreate any shot', body: 'Jump into the app with one click and reuse the setup.', icon: Zap, tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300' },
    { title: 'Native audio', body: 'Dialogue, ambience and SFX generated in sync.', icon: AudioLines, tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300' },
    { title: 'Multi-shot continuity', body: 'Keep characters, style and scene consistency across sequences.', icon: Users, tone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/12 dark:text-violet-300' },
    { title: 'Safe for production', body: 'Built-in guardrails and safety filters for peace of mind.', icon: ShieldCheck, tone: 'bg-orange-50 text-orange-600 dark:bg-orange-500/12 dark:text-orange-300' },
  ];
}

function getDecisionExampleCategory(video: ExampleGalleryVideo, locale: AppLocale) {
  const tag = inferRenderTag(video.promptFull ?? video.prompt, locale);
  if (tag) return tag;
  if (video.hasAudio) return locale === 'fr' ? 'Cinematique' : locale === 'es' ? 'Cinematico' : 'Cinematic';
  return locale === 'fr' ? 'Render' : locale === 'es' ? 'Render' : 'Render';
}

function getCuratedDecisionExampleTitle(index: number, fallback: string, locale: AppLocale) {
  const labels: Record<AppLocale, string[]> = {
    en: ['Parkour rooftop run', 'Trading desk intensity', 'Clothing try-on moment', 'Warm kitchen reunion'],
    fr: ['Course parkour rooftop', 'Intensite salle de trading', 'Essayage vetement', 'Reunion en cuisine'],
    es: ['Parkour en azotea', 'Intensidad mesa de trading', 'Prueba de ropa', 'Reencuentro en cocina'],
  };
  return labels[locale]?.[index] ?? fallback;
}

function getCuratedDecisionExampleCategory(index: number, fallback: string, locale: AppLocale) {
  const labels: Record<AppLocale, string[]> = {
    en: ['Cinematic · Action', 'Corporate · Tech', 'Lifestyle · Product', 'Narrative · Romance'],
    fr: ['Cinematique · Action', 'Corporate · Tech', 'Lifestyle · Produit', 'Narratif · Romance'],
    es: ['Cinematico · Accion', 'Corporativo · Tech', 'Lifestyle · Producto', 'Narrativa · Romance'],
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
  if (video.hasAudio) return locale === 'es' ? 'Audio on' : 'Audio on';
  if (locale === 'fr') return 'Audio off';
  if (locale === 'es') return 'Audio off';
  return 'Audio off';
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
  const filters = getDecisionExampleFilters(locale);
  const proofItems = getDecisionExampleProofItems(locale);
  const title = copy.galleryTitle ?? getFallbackExamplesTitle(locale);
  const intro = copy.galleryIntro ?? getFallbackExamplesIntro(locale);

  return (
    <section id={textAnchorId} className={SECTION_SCROLL_MARGIN}>
      <div className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:bg-slate-950/72 dark:shadow-[0_24px_70px_-42px_rgba(0,0,0,0.85)] sm:p-7">
        <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,0.92fr)_auto] xl:items-start">
          <div className="xl:max-w-[650px]">
            <h2 className="!text-left text-[1.7rem] font-semibold leading-tight tracking-normal text-slate-950 dark:text-white">
              {title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{intro}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
            <div className="flex flex-wrap gap-2 xl:flex-nowrap">
              {filters.map((filter, index) => (
                <span
                  key={filter}
                  className={[
                    'inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition',
                    index === 0
                      ? 'border-blue-200 bg-white text-blue-600 shadow-sm dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200'
                      : 'border-slate-200 bg-white/75 text-slate-600 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300',
                  ].join(' ')}
                >
                  {filter}
                </span>
              ))}
            </div>
            <Link
              href={examplesLinkHref}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <span>{getViewAllExamplesLabel(locale)}</span>
              <UIIcon icon={ExternalLink} size={14} />
            </Link>
          </div>
        </div>

        {galleryVideos.length ? (
          <div className="relative mt-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {galleryVideos.slice(0, 4).map((video, index) => {
                const fallbackTitle = deriveShortPromptLabel(video.promptFull ?? video.prompt, locale);
                const shortTitle = getCuratedDecisionExampleTitle(index, fallbackTitle, locale);
                const category = getCuratedDecisionExampleCategory(index, getDecisionExampleCategory(video, locale), locale);
                const aspectRatio = getDisplayAspectRatio(video);
                const posterUrl = video.optimizedPosterUrl ?? video.rawPosterUrl ?? '';
                return (
                  <article
                    key={video.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_14px_36px_-28px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/[0.045]"
                  >
                    <Link href={video.href} className="group relative block aspect-video overflow-hidden bg-slate-100 dark:bg-white/5">
                      {posterUrl ? (
                        <Image
                          src={posterUrl}
                          alt={galleryPreviewAlts.get(video.id) ?? `${video.engineLabel} example: ${shortTitle}`}
                          fill
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                          sizes="(min-width: 1280px) 300px, (min-width: 768px) 45vw, 90vw"
                          quality={70}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                          No preview
                        </div>
                      )}
                      <div className="absolute left-3 top-3 inline-flex h-7 items-center gap-1.5 rounded-lg bg-slate-950/82 px-2.5 text-[0.72rem] font-semibold text-white shadow-sm backdrop-blur">
                        <UIIcon icon={AudioLines} size={13} className="text-cyan-300" />
                        <span>{getAudioBadgeLabel(video, locale)}</span>
                      </div>
                      <div className="absolute right-3 top-3 rounded-lg bg-slate-950/82 px-2.5 py-1 text-[0.72rem] font-semibold text-white shadow-sm backdrop-blur">
                        {getDurationLabel(video, locale)}
                      </div>
                      {aspectRatio ? (
                        <div className="absolute bottom-3 right-3 rounded-lg bg-slate-950/82 px-2.5 py-1 text-[0.72rem] font-semibold text-white shadow-sm backdrop-blur">
                          {aspectRatio}
                        </div>
                      ) : null}
                    </Link>
                    <div className="px-4 py-3.5">
                      <p className="text-[0.72rem] font-medium text-slate-500 dark:text-slate-400">
                        {category}
                      </p>
                      <h3 className="mt-1 line-clamp-1 !text-left text-sm font-semibold text-slate-950 dark:text-white">
                        {shortTitle}
                      </h3>
                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.78rem] font-semibold">
                        <Link href={video.href} className="text-slate-950 transition hover:text-blue-600 dark:text-white dark:hover:text-blue-200">
                          {renderLinkLabel}
                        </Link>
                        {video.recreateHref && copy.recreateLabel ? (
                          <Link
                            href={video.recreateHref}
                            className="inline-flex items-center gap-1 text-blue-700 transition hover:text-blue-500 dark:text-blue-200 dark:hover:text-blue-100"
                          >
                            <span>{copy.recreateLabel}</span>
                            <UIIcon icon={ArrowRight} size={13} />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <span className="pointer-events-none absolute -right-7 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 shadow-[0_16px_38px_-26px_rgba(15,23,42,0.55)] dark:border-white/10 dark:bg-slate-900 dark:text-white xl:inline-flex">
              <UIIcon icon={ChevronRight} size={19} />
            </span>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300">
            {intro}
          </div>
        )}

        <div className="mt-4 grid rounded-xl border border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.035] sm:grid-cols-2 lg:grid-cols-5">
          {proofItems.map((item, index) => (
            <div
              key={item.title}
              className={[
                'flex gap-3 p-4',
                index > 0 ? 'border-t border-slate-200 dark:border-white/10 sm:border-l sm:border-t-0' : '',
                index === 2 ? 'lg:border-l' : '',
              ].join(' ')}
            >
              <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.tone}`}>
                <UIIcon icon={item.icon} size={20} strokeWidth={1.85} />
              </span>
              <div>
                <h3 className="!text-left text-sm font-semibold leading-snug text-slate-950 dark:text-white">{item.title}</h3>
                <p className="mt-1 text-[0.8rem] leading-5 text-slate-600 dark:text-slate-300">{item.body}</p>
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
