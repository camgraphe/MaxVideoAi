import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { headers } from 'next/headers';
import { getVideoById, type GalleryVideo } from '@/server/videos';
import { BackLink } from '@/components/video/BackLink';
import { CopyPromptButton } from '@/components/CopyPromptButton';
import { resolveDictionary } from '@/lib/i18n/server';
import type { Dictionary } from '@/lib/i18n/types';
import { localeRegions, type AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish, type SupportedLocale } from '@/lib/i18n/paths';
import { getFalEngineById, getFalEngineBySlug, type FalEngineEntry } from '@/config/falEngines';
import { normalizeEngineId } from '@/lib/engine-alias';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { ButtonLink } from '@/components/ui/Button';

type PageProps = {
  params: { id: string };
  searchParams?: { from?: string };
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maxvideoai.com').replace(/\/$/, '');
const FALLBACK_THUMB = `${SITE}/og/price-before.png`;
const FALLBACK_POSTER = `${SITE}/og/price-before.png`;
const TITLE_SUFFIX = ' — MaxVideoAI';
const META_TITLE_LIMIT = 60;

export const revalidate = 60 * 30; // 30 minutes

const DEFAULT_VIDEO_COPY = {
  backLink: '← Back',
  hero: {
    titleFallback: 'MaxVideoAI render',
    intro: 'This video was generated with {engine} on MaxVideoAI — discover how to create similar renders below.',
    promptLabel: 'Prompt',
    promptFallback: 'Prompt unavailable.',
    copy: 'Copy prompt',
    copied: 'Copied!',
    showMore: 'Show more',
    showLess: 'Show less',
  },
  seo: {
    title: 'Render breakdown',
    promptFallback: 'a cinematic AI scene',
    durationPhrase: 'an {value}-second clip',
    durationFallback: 'a short clip',
    aspectPhrase: 'a {value} aspect ratio',
    aspectFallback: 'an adaptive aspect ratio',
    sentences: [
      'This AI-generated video showcases {promptStyle} and ships straight from our public Examples playlist.',
      '{engineName} handled this render inside MaxVideoAI, delivering {durationLabel} at {aspectRatioLabel} with {audioState}.',
      'The footage highlights consistent motion, crisp lighting, and natural reflections so creative and product teams can judge how the model behaves.',
      'Prompt styling keeps {promptTone} cues that you can remix or extend with image references, narration, or upscaling.',
      'Use the engine card, pricing link, and blog resources below to compare models or start a similar run in your workspace.',
    ],
  },
  details: {
    title: 'Render details',
    engineLabel: 'Engine',
    engineDescriptionFallback: 'Browse the full spec sheet for this model.',
    engineCta: 'Open model page',
    engineUnavailable: 'Engine unavailable',
    durationLabel: 'Duration',
    durationValue: '{value} seconds',
    durationUnknown: 'Unknown',
    aspectLabel: 'Aspect ratio',
    aspectAuto: 'Auto',
    createdLabel: 'Created',
    priceTotalLabel: 'Render cost',
    priceTotalValue: '{value}',
    priceTotalUnknown: 'Unavailable',
    audioLabel: 'Audio',
    cta: 'Compare pricing',
    ctaDescription: 'Explore all engine rates',
    discountAppliedLabel: 'Member discount applied',
    discountSavedLabel: 'Saved {amount}',
    discountPercentLabel: '{percent} off',
    discountTierLabel: '{tier} tier',
  },
  audioStates: {
    withAudio: 'audio enabled',
    withoutAudio: 'muted output',
  },
  create: {
    title: 'Create your own',
    subtitle: 'Want to create a video like this?',
    body: 'Start a render from this prompt or load it in the workspace to remix with your preferred engine, duration, or audio settings.',
    cta: 'Start a render →',
  },
  recreate: {
    title: 'Recreate this video',
    body: 'Load this render in your workspace with the original settings prefilled.',
    cta: 'Recreate in Workspace →',
    microcopy: 'Loads prompt + engine + duration + audio.',
  },
  blog: {
    title: 'Keep leveling up',
    message: 'Learn more about AI video creation — visit our blog for tips, engine comparisons, and creative use cases.',
    cta: 'Visit the blog',
  },
  unavailable: {
    title: 'Video unavailable',
    message: 'This video is no longer available. It may have been removed or set to private.',
    cta: 'Back to gallery',
  },
};

type VideoPageCopy = typeof DEFAULT_VIDEO_COPY;

function formatPrompt(prompt?: string | null, maxLength = 320): string {
  if (!prompt) return 'AI-generated video created with MaxVideoAI.';
  const clean = prompt.replace(/\s+/g, ' ').trim();
  if (!clean) return 'AI-generated video created with MaxVideoAI.';
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1)}…`;
}

function formatPromptPreview(prompt: string, fallback: string, maxLength = 220): string {
  const clean = prompt.replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(1, maxLength - 1))}…`;
}

function toDurationIso(seconds?: number | null): string {
  const safe = Math.max(1, Math.round(Number(seconds ?? 0) || 1));
  return `PT${safe}S`;
}

function toAbsoluteUrl(value?: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) {
    return `https:${value}`;
  }
  if (value.startsWith('/')) {
    return `${SITE}${value}`;
  }
  return `${SITE}/${value.replace(/^\/+/, '')}`;
}

type AspectRatio = { width: number; height: number } | null;

function parseAspectRatio(value?: string | null): AspectRatio {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const [w, h] = trimmed.split(':');
    const width = Number.parseFloat(w);
    const height = Number.parseFloat(h);
    if (Number.isFinite(width) && Number.isFinite(height) && height > 0) {
      return { width, height };
    }
    return null;
  }
  const numeric = Number.parseFloat(trimmed);
  if (Number.isFinite(numeric) && numeric > 0) {
    return { width: numeric, height: 1 };
  }
  return null;
}

async function fetchVideo(id: string) {
  return getVideoById(id);
}

function isRenderable(video: GalleryVideo | null): video is GalleryVideo {
  if (!video) return false;
  if (video.visibility !== 'public') return false;
  if (!video.indexable) return false;
  if (!video.videoUrl) return false;
  return true;
}

function truncateForMeta(title: string, limit: number) {
  if (title.length <= limit) return title;
  const slice = title.slice(0, Math.max(1, limit - 1));
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > Math.floor(limit * 0.6)) {
    return `${slice.slice(0, lastSpace).trim()}…`;
  }
  return `${slice.trim()}…`;
}

function buildMetaTitle(primary: string) {
  const available = Math.max(10, META_TITLE_LIMIT - TITLE_SUFFIX.length);
  const safePrimary = primary && primary.trim().length ? primary.trim() : 'MaxVideoAI render';
  const truncated = truncateForMeta(safePrimary, available);
  return `${truncated}${TITLE_SUFFIX}`;
}

function formatJobSuffix(id: string) {
  const clean = id.replace(/[^a-z0-9]/gi, '');
  return clean.slice(-6).toUpperCase();
}

function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? '');
}

function resolveVideoCopy(dictionary: Dictionary): VideoPageCopy {
  const overrides = dictionary.videoPage ?? {};
  return {
    ...DEFAULT_VIDEO_COPY,
    ...overrides,
    hero: {
      ...DEFAULT_VIDEO_COPY.hero,
      ...(overrides.hero ?? {}),
    },
    seo: {
      ...DEFAULT_VIDEO_COPY.seo,
      ...(overrides.seo ?? {}),
      sentences:
        overrides.seo?.sentences && overrides.seo.sentences.length
          ? overrides.seo.sentences
          : DEFAULT_VIDEO_COPY.seo.sentences,
    },
    details: {
      ...DEFAULT_VIDEO_COPY.details,
      ...(overrides.details ?? {}),
    },
    audioStates: {
      ...DEFAULT_VIDEO_COPY.audioStates,
      ...(overrides.audioStates ?? {}),
    },
    create: {
      ...DEFAULT_VIDEO_COPY.create,
      ...(overrides.create ?? {}),
    },
    recreate: {
      ...DEFAULT_VIDEO_COPY.recreate,
      ...(overrides.recreate ?? {}),
    },
    blog: {
      ...DEFAULT_VIDEO_COPY.blog,
      ...(overrides.blog ?? {}),
    },
  };
}

function resolveEngineEntry(engineId?: string | null): FalEngineEntry | null {
  if (!engineId) return null;
  const normalized = normalizeEngineId(engineId);
  if (!normalized) return null;
  return getFalEngineById(normalized) ?? getFalEngineBySlug(normalized) ?? null;
}

function getPromptStyle(video: GalleryVideo, copy: VideoPageCopy): string {
  const source = video.promptExcerpt || video.prompt || '';
  const normalized = source.replace(/\s+/g, ' ').trim();
  return normalized || copy.seo.promptFallback;
}

function describeAudio(hasAudio: boolean | undefined, copy: VideoPageCopy): string {
  return hasAudio ? copy.audioStates.withAudio : copy.audioStates.withoutAudio;
}

function formatNumber(value: number, locale: AppLocale) {
  const region = localeRegions[locale] ?? 'en-US';
  return new Intl.NumberFormat(region, { maximumFractionDigits: 0 }).format(value);
}

function formatDurationDisplay(seconds: number | undefined, locale: AppLocale, copy: VideoPageCopy): string {
  if (!seconds || seconds <= 0) {
    return copy.details.durationUnknown;
  }
  return renderTemplate(copy.details.durationValue, { value: formatNumber(seconds, locale) });
}

function formatDurationSeo(seconds: number | undefined, locale: AppLocale, copy: VideoPageCopy): string {
  if (!seconds || seconds <= 0) {
    return copy.seo.durationFallback;
  }
  return renderTemplate(copy.seo.durationPhrase, { value: formatNumber(seconds, locale) });
}

function formatAspectDisplay(aspectRatio: string | undefined, copy: VideoPageCopy): string {
  return aspectRatio?.trim() || copy.details.aspectAuto;
}

function formatAspectSeo(aspectRatio: string | undefined, copy: VideoPageCopy): string {
  if (!aspectRatio || !aspectRatio.trim()) {
    return copy.seo.aspectFallback;
  }
  return renderTemplate(copy.seo.aspectPhrase, { value: aspectRatio.trim() });
}

function formatDateDisplay(value: string, locale: AppLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const region = localeRegions[locale] ?? 'en-US';
  return new Intl.DateTimeFormat(region, { dateStyle: 'long' }).format(date);
}

function formatCurrency(amount: number, currency: string, locale: AppLocale): string {
  const region = localeRegions[locale] ?? 'en-US';
  return new Intl.NumberFormat(region, {
    style: 'currency',
    currency,
    maximumFractionDigits: amount < 1 ? 2 : 2,
  }).format(amount);
}

function getTotalPrice(video: GalleryVideo): { amount: number; currency: string } | null {
  if (typeof video.finalPriceCents === 'number' && video.finalPriceCents > 0) {
    return {
      amount: video.finalPriceCents / 100,
      currency: video.currency ?? 'USD',
    };
  }
  return null;
}

function formatTotalPriceDisplay(video: GalleryVideo, copy: VideoPageCopy, locale: AppLocale): string {
  const total = getTotalPrice(video);
  if (!total) {
    return copy.details.priceTotalUnknown;
  }
  const formatted = formatCurrency(total.amount, total.currency, locale);
  return renderTemplate(copy.details.priceTotalValue, { value: formatted });
}

function formatPercentLabel(value?: number | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const normalized = value > 1 ? value : value * 100;
  const precision = Math.abs(normalized % 1) < 1e-6 ? 0 : 1;
  return `${normalized.toFixed(precision)}%`;
}

function formatTierLabel(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

function buildDiscountNote(video: GalleryVideo, copy: VideoPageCopy, locale: AppLocale): string | null {
  const snapshot = video.pricingSnapshot;
  const discount = snapshot?.discount;
  if (!snapshot || !discount || typeof discount.amountCents !== 'number' || discount.amountCents <= 0) {
    return null;
  }
  const currency = snapshot.currency ?? video.currency ?? 'USD';
  const amount = formatCurrency(discount.amountCents / 100, currency, locale);
  const percent = formatPercentLabel(discount.percentApplied);
  const tier = formatTierLabel(snapshot.membershipTier ?? discount.tier ?? null);

  const segments = [renderTemplate(copy.details.discountSavedLabel, { amount })];
  if (percent) {
    segments.push(renderTemplate(copy.details.discountPercentLabel, { percent }));
  }
  if (tier) {
    segments.push(renderTemplate(copy.details.discountTierLabel, { tier }));
  }
  return `${copy.details.discountAppliedLabel} — ${segments.join(' · ')}`;
}

function buildSeoContent(video: GalleryVideo, copy: VideoPageCopy, locale: AppLocale) {
  const promptStyle = getPromptStyle(video, copy);
  const durationLabel = formatDurationSeo(video.durationSec, locale, copy);
  const aspectLabel = formatAspectSeo(video.aspectRatio, copy);
  const audioState = describeAudio(video.hasAudio, copy);
  const engineName = video.engineLabel ?? video.engineId ?? copy.hero.titleFallback;
  const templateValues = {
    promptStyle,
    promptTone: promptStyle,
    engineName,
    durationLabel,
    aspectRatioLabel: aspectLabel,
    audioState,
  };
  const paragraph = copy.seo.sentences.map((sentence) => renderTemplate(sentence, templateValues)).join(' ').trim();
  return {
    paragraph,
    description: formatPrompt(paragraph, 300),
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const video = await fetchVideo(params.id);
  const { locale, dictionary } = await resolveDictionary();
  const copy = resolveVideoCopy(dictionary);
  if (!isRenderable(video)) {
    const canonical = `${SITE}/video/${encodeURIComponent(params.id)}`;
    return {
      title: `${copy.unavailable.title} — MaxVideoAI`,
      description: copy.unavailable.message,
      robots: { index: false, follow: false },
      alternates: { canonical },
    };
  }
  const seoContent = buildSeoContent(video, copy, locale);

  const engineLabel = video.engineLabel ?? 'MaxVideoAI';
  const promptHeading =
    video.promptExcerpt ||
    video.prompt ||
    `${engineLabel} example (${video.durationSec ?? 'short'}s)`;
  const metaPrimary = `${promptHeading} · ${engineLabel} [${formatJobSuffix(video.id)}]`;
  const metaTitle = buildMetaTitle(metaPrimary);
  const description = seoContent.description;
  const canonical = `${SITE}/video/${encodeURIComponent(video.id)}`;
  const thumbnail = toAbsoluteUrl(video.thumbUrl) ?? FALLBACK_THUMB;
  const videoUrl = toAbsoluteUrl(video.videoUrl) ?? canonical;
  const isJobId = params.id.toLowerCase().startsWith('job_');

  const metadata: Metadata = {
    title: metaTitle,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'video.other',
      siteName: 'MaxVideoAI',
      url: canonical,
      title: metaTitle,
      description,
      videos: [
        {
          url: videoUrl,
          secureUrl: videoUrl,
          type: 'video/mp4',
          width: 1280,
          height: 720,
        },
      ],
      images: [{ url: thumbnail, width: 1280, height: 720, alt: metaTitle }],
    },
    twitter: {
      card: 'player',
      title: metaTitle,
      description,
      images: [thumbnail],
      site: '@MaxVideoAI',
      creator: '@MaxVideoAI',
    },
  };
  if (isJobId) {
    metadata.robots = { index: false, follow: true };
  }
  return metadata;
}

export default async function VideoPage({ params, searchParams }: PageProps) {
  const video = await fetchVideo(params.id);
  if (!video) notFound();

  const { locale, dictionary } = await resolveDictionary();
  const copy = resolveVideoCopy(dictionary);
  const supportedLocale = locale as SupportedLocale;
  const examplesPath = localizePathFromEnglish(supportedLocale, '/examples');
  const referer = headers().get('referer');
  const canonical = `${SITE}/video/${encodeURIComponent(video.id)}`;
  const fromParam = searchParams?.from;
  let backHref = examplesPath;
  const candidateFrom = fromParam && fromParam.startsWith('/') ? fromParam : null;
  if (candidateFrom) {
    backHref = candidateFrom;
  } else if (referer) {
    try {
      const url = referer.startsWith('http') ? new URL(referer) : new URL(referer, SITE);
      const candidatePath = `${url.pathname}${url.search}${url.hash}`;
      const canonicalPath = new URL(canonical).pathname;
      const isSamePage = candidatePath.replace(/\/+$/, '') === canonicalPath.replace(/\/+$/, '');
      if (!isSamePage && !candidatePath.startsWith('/api') && candidatePath.startsWith('/')) {
        backHref = candidatePath || examplesPath;
      }
    } catch {
      // ignore bad referer values
    }
  }

  if (!isRenderable(video)) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        <div className="mb-6 text-xs uppercase tracking-micro text-text-muted">
          <BackLink href={backHref} label={copy.backLink} className="transition hover:text-text-secondary" />
        </div>
        <div className="rounded-card border border-border bg-surface px-6 py-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-text-primary">{copy.unavailable.title}</h1>
          <p className="mt-4 text-base text-text-secondary">{copy.unavailable.message}</p>
          <div className="mt-6 flex justify-center">
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 rounded-full bg-text-primary px-4 py-2 text-sm font-semibold text-on-inverse transition hover:bg-text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copy.unavailable.cta}
            </Link>
          </div>
        </div>
      </div>
    );
  }
  const seoContent = buildSeoContent(video, copy, locale);

  const prompt = video.prompt ?? video.promptExcerpt ?? '';
  const videoUrl = toAbsoluteUrl(video.videoUrl) ?? video.videoUrl ?? canonical;
  const thumbnailUrl = toAbsoluteUrl(video.thumbUrl) ?? FALLBACK_THUMB;
  const poster = video.thumbUrl ?? FALLBACK_POSTER;
  const optimizedPoster = buildOptimizedPosterUrl(poster);
  const playbackPoster = optimizedPoster ?? poster;
  const aspect = parseAspectRatio(video.aspectRatio);
  const isPortrait = aspect ? aspect.width < aspect.height : false;
  const engineEntry = resolveEngineEntry(video.engineId);
  const engineLabel = video.engineLabel ?? copy.hero.titleFallback;
  const heroHeading = video.promptExcerpt || video.prompt || engineLabel;
  const heroTitle = engineLabel || heroHeading || copy.hero.titleFallback;
  const engineDescription = engineEntry?.seo?.description ?? copy.details.engineDescriptionFallback;
  const engineSlug = engineEntry?.modelSlug ?? normalizeEngineId(video.engineId ?? '') ?? '';
  const engineLink = engineSlug
    ? localizePathFromEnglish(supportedLocale, `/models/${engineSlug}`)
    : null;
  const pricingPath = localizePathFromEnglish(supportedLocale, '/pricing');
  const blogPath = localizePathFromEnglish(supportedLocale, '/blog');
  const totalPriceDisplay = formatTotalPriceDisplay(video, copy, locale);
  const discountNote = buildDiscountNote(video, copy, locale);
  const durationDisplay = formatDurationDisplay(video.durationSec, locale, copy);
  const aspectDisplay = formatAspectDisplay(video.aspectRatio, copy);
  const createdDisplay = formatDateDisplay(video.createdAt, locale);
  const audioDisplay = describeAudio(video.hasAudio, copy);
  const promptPreview = formatPromptPreview(video.promptExcerpt || video.prompt || '', copy.hero.promptFallback, 220);

  const heroMaxHeightVh = 50;
  const containerStyle: CSSProperties = {
    maxHeight: `${heroMaxHeightVh}vh`,
    width: '100%',
  };
  if (aspect) {
    containerStyle.aspectRatio = `${aspect.width} / ${aspect.height}`;
    const maxWidth = heroMaxHeightVh * (aspect.width / aspect.height);
    containerStyle.maxWidth = `${maxWidth.toFixed(2)}vh`;
    containerStyle.margin = '0 auto';
  }

  const videoJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name:
      video.promptExcerpt ||
      video.prompt ||
      `${video.engineLabel ?? 'MaxVideoAI'} example`,
    description: seoContent.paragraph,
    thumbnailUrl: [thumbnailUrl],
    uploadDate: new Date(video.createdAt).toISOString(),
    duration: toDurationIso(video.durationSec),
    contentUrl: videoUrl,
    embedUrl: canonical,
    caption: prompt && prompt !== seoContent.paragraph ? prompt : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'MaxVideoAI',
      url: SITE,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE}/favicon-512.png`,
      },
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <Head>
        <link rel="preload" as="image" href={playbackPoster} fetchPriority="high" />
      </Head>
      <div className="mb-6 text-xs uppercase tracking-micro text-text-muted">
        <BackLink href={backHref} label={copy.backLink} className="transition hover:text-text-secondary" />
      </div>
      <article className="space-y-12">
        <section className="mx-auto w-full max-w-5xl rounded-[32px] border border-surface-on-media-20 bg-surface-glass-95 p-4 shadow-float">
          <div className="border-b border-hairline pb-4">
            <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-micro text-text-muted">
                  {engineLink ? (
                    <Link
                      href={engineLink}
                      className="inline-flex items-center gap-1 rounded-full bg-surface-glass-90 px-2 py-0.5 text-[11px] font-semibold text-brand shadow-sm transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span>{copy.details.engineCta}</span>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path
                          d="M4 12L12 4M5 4h7v7"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Link>
                  ) : null}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">{heroTitle}</h1>
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end sm:text-right">
                <span className="text-[11px] text-text-secondary">{copy.recreate.microcopy}</span>
                <ButtonLink
                  href={`/app?from=${encodeURIComponent(video.id)}`}
                  size="sm"
                  className="rounded-pill px-4 py-2 text-xs font-semibold uppercase tracking-micro whitespace-nowrap"
                >
                  {copy.recreate.cta}
                </ButtonLink>
              </div>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-3xl border border-hairline bg-black" style={containerStyle}>
            {video.videoUrl ? (
              <video
                controls
                poster={playbackPoster}
                className="h-full w-full object-contain"
                playsInline
                preload="metadata"
                style={aspect ? { aspectRatio: `${aspect.width} / ${aspect.height}` } : undefined}
              >
                <source src={video.videoUrl} type="video/mp4" />
              </video>
            ) : (
              <Image
                src={playbackPoster}
                alt={heroTitle}
                fill
                className="object-contain"
                style={aspect ? { aspectRatio: `${aspect.width} / ${aspect.height}` } : undefined}
                sizes="(min-width: 1024px) 720px, 100vw"
              />
            )}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl space-y-6">
          <div className="rounded-card border border-border bg-surface-glass-90 p-6 shadow-card backdrop-blur">
            <h2 className="text-lg font-semibold text-text-primary">{copy.details.title}</h2>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-micro text-text-muted">{copy.details.priceTotalLabel}</span>
                <span className="font-semibold text-text-primary">{totalPriceDisplay}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-micro text-text-muted">{copy.details.durationLabel}</span>
                <span className="font-semibold text-text-primary">{durationDisplay}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-micro text-text-muted">{copy.details.aspectLabel}</span>
                <span className="font-semibold text-text-primary">{aspectDisplay}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-micro text-text-muted">{copy.details.audioLabel}</span>
                <span className="font-semibold text-text-primary">
                  {audioDisplay.charAt(0).toUpperCase() + audioDisplay.slice(1)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-micro text-text-muted">{copy.details.createdLabel}</span>
                <span className="font-semibold text-text-primary">{createdDisplay}</span>
              </div>
            </div>
            {discountNote ? <p className="mt-2 text-xs font-semibold text-brand">{discountNote}</p> : null}
            <div className="mt-5 border-t border-hairline pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-micro text-text-muted">{copy.hero.promptLabel}</p>
                <CopyPromptButton prompt={prompt} copyLabel={copy.hero.copy} copiedLabel={copy.hero.copied} />
              </div>
              <p className="mt-2 text-sm text-text-secondary">{promptPreview}</p>
              <details className="group mt-3">
                <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-micro text-text-muted">
                  <span className="group-open:hidden">{copy.hero.showMore}</span>
                  <span className="hidden group-open:inline">{copy.hero.showLess}</span>
                </summary>
                <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">
                  {prompt || copy.hero.promptFallback}
                </p>
              </details>
            </div>
            <div className="mt-5 border-t border-hairline pt-4">
              {engineLink ? (
                <Link
                  href={engineLink}
                  className="block rounded-lg border border-hairline bg-bg p-4 transition hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="text-xs uppercase tracking-micro text-text-muted">{copy.details.engineLabel}</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{engineLabel}</p>
                  <p className="mt-1 text-sm text-text-secondary">{engineDescription}</p>
                  <span className="mt-3 inline-flex items-center text-sm font-semibold text-brand">
                    {copy.details.engineCta} →
                  </span>
                </Link>
              ) : (
                <div className="rounded-lg border border-hairline bg-bg p-4">
                  <p className="text-xs uppercase tracking-micro text-text-muted">{copy.details.engineLabel}</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{copy.details.engineUnavailable}</p>
                  <p className="mt-1 text-sm text-text-secondary">{engineDescription}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-card border border-border bg-surface-glass-90 p-6 shadow-card backdrop-blur">
            <p className="text-xs uppercase tracking-micro text-text-muted">{copy.recreate.title}</p>
            <p className="mt-2 text-sm text-text-secondary">{copy.recreate.body}</p>
            <ButtonLink href={`/app?from=${encodeURIComponent(video.id)}`} size="lg" className="mt-4 w-full">
              {copy.recreate.cta}
            </ButtonLink>
            <p className="mt-2 text-xs text-text-secondary">{copy.recreate.microcopy}</p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl">
          <div className="grid grid-gap-lg lg:grid-cols-3">
            <div className="rounded-card border border-border bg-surface-glass-90 p-6 shadow-card backdrop-blur">
              <p className="text-xs uppercase tracking-micro text-text-muted">{copy.create.title}</p>
              <h3 className="mt-1 text-lg font-semibold text-text-primary">{copy.create.subtitle}</h3>
              <p className="mt-2 text-sm text-text-secondary">{copy.create.body}</p>
              <ButtonLink href={`/app?from=${encodeURIComponent(video.id)}`} size="lg" className="mt-4 w-full">
                {copy.create.cta}
              </ButtonLink>
            </div>
            <div className="rounded-card border border-border bg-surface-glass-90 p-6 shadow-card backdrop-blur">
              <h3 className="text-lg font-semibold text-text-primary">{copy.details.cta}</h3>
              <p className="mt-2 text-sm text-text-secondary">{copy.details.ctaDescription}</p>
              <ButtonLink href={pricingPath} variant="outline" className="mt-4 w-full">
                {copy.details.cta}
              </ButtonLink>
            </div>
            <div className="rounded-card border border-border bg-surface-glass-90 p-6 shadow-card backdrop-blur">
              <h3 className="text-lg font-semibold text-text-primary">{copy.blog.title}</h3>
              <p className="mt-2 text-sm text-text-secondary">{copy.blog.message}</p>
              <ButtonLink href={blogPath} variant="outline" className="mt-4 w-full">
                {copy.blog.cta}
              </ButtonLink>
            </div>
          </div>
        </section>
      </article>
      <Script id={`video-jsonld-${video.id}`} type="application/ld+json">
        {JSON.stringify(videoJsonLd)}
      </Script>
    </div>
  );
}
