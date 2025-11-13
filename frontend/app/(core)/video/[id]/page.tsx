import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { getVideoById, type GalleryVideo } from '@/server/videos';
import { PromptPreview } from '@/components/video/PromptPreview';
import { resolveDictionary } from '@/lib/i18n/server';
import type { Dictionary } from '@/lib/i18n/types';
import { localeRegions, type AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish, type SupportedLocale } from '@/lib/i18n/paths';
import { getFalEngineById, getFalEngineBySlug, type FalEngineEntry } from '@/config/falEngines';
import { normalizeEngineId } from '@/lib/engine-alias';

type PageProps = {
  params: { id: string };
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maxvideoai.com').replace(/\/$/, '');
const FALLBACK_THUMB = `${SITE}/og/price-before.png`;
const FALLBACK_POSTER = `${SITE}/og/price-before.png`;
const TITLE_SUFFIX = ' — MaxVideoAI';
const META_TITLE_LIMIT = 60;

export const revalidate = 60 * 30; // 30 minutes

const DEFAULT_VIDEO_COPY = {
  backLink: '← Back to examples',
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
  blog: {
    title: 'Keep leveling up',
    message: 'Learn more about AI video creation — visit our blog for tips, engine comparisons, and creative use cases.',
    cta: 'Visit the blog',
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
  const video = await getVideoById(id);
  if (!video) return null;
  if (video.visibility !== 'public') return null;
  if (!video.indexable) return null;
  if (!video.videoUrl) return null;
  return video;
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
  if (!video) {
    return {
      title: 'Video not found — MaxVideoAI',
      description: 'The requested video is unavailable.',
      robots: { index: false, follow: false },
    };
  }

  const { locale, dictionary } = await resolveDictionary();
  const copy = resolveVideoCopy(dictionary);
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

  return {
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
    },
  };
}

export default async function VideoPage({ params }: PageProps) {
  const video = await fetchVideo(params.id);
  if (!video) {
    notFound();
  }

  const { locale, dictionary } = await resolveDictionary();
  const copy = resolveVideoCopy(dictionary);
  const seoContent = buildSeoContent(video, copy, locale);
  const supportedLocale = locale as SupportedLocale;

  const canonical = `${SITE}/video/${encodeURIComponent(video.id)}`;
  const prompt = video.prompt ?? video.promptExcerpt ?? '';
  const videoUrl = toAbsoluteUrl(video.videoUrl) ?? video.videoUrl ?? canonical;
  const thumbnailUrl = toAbsoluteUrl(video.thumbUrl) ?? FALLBACK_THUMB;
  const poster = video.thumbUrl ?? FALLBACK_POSTER;
  const aspect = parseAspectRatio(video.aspectRatio);
  const isPortrait = aspect ? aspect.width < aspect.height : false;
  const engineEntry = resolveEngineEntry(video.engineId);
  const engineLabel = video.engineLabel ?? copy.hero.titleFallback;
  const heroHeading = video.promptExcerpt || video.prompt || engineLabel;
  const heroIntro = renderTemplate(copy.hero.intro, { engine: engineLabel });
  const engineDescription = engineEntry?.seo?.description ?? copy.details.engineDescriptionFallback;
  const engineSlug = engineEntry?.modelSlug ?? normalizeEngineId(video.engineId ?? '') ?? '';
  const engineLink = engineSlug
    ? localizePathFromEnglish(supportedLocale, `/models/${engineSlug}`)
    : null;
  const examplesPath = localizePathFromEnglish(supportedLocale, '/examples');
  const pricingPath = localizePathFromEnglish(supportedLocale, '/pricing');
  const blogPath = localizePathFromEnglish(supportedLocale, '/blog');
  const totalPriceDisplay = formatTotalPriceDisplay(video, copy, locale);
  const discountNote = buildDiscountNote(video, copy, locale);
  const durationDisplay = formatDurationDisplay(video.durationSec, locale, copy);
  const aspectDisplay = formatAspectDisplay(video.aspectRatio, copy);
  const createdDisplay = formatDateDisplay(video.createdAt, locale);
  const audioDisplay = describeAudio(video.hasAudio, copy);

  const containerStyle: CSSProperties = {};
  if (aspect) {
    containerStyle.aspectRatio = `${aspect.width} / ${aspect.height}`;
  }
  if (isPortrait) {
    containerStyle.maxWidth = '50%';
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
      <div className="mb-6 text-xs uppercase tracking-micro text-text-muted">
        <Link href={examplesPath} className="transition hover:text-text-secondary">
          {copy.backLink}
        </Link>
      </div>
      <article className="space-y-12">
        <section className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <div className="lg:order-1">
            <div
              className="relative overflow-hidden rounded-card border border-border bg-black shadow-card"
              style={containerStyle}
            >
              {video.videoUrl ? (
                <video
                  controls
                  poster={poster}
                  className="h-full w-full object-contain"
                  playsInline
                  preload="metadata"
                  style={aspect ? { aspectRatio: `${aspect.width} / ${aspect.height}` } : undefined}
                >
                  <source src={video.videoUrl} type="video/mp4" />
                </video>
              ) : (
                <Image
                  src={poster}
                  alt={heroHeading}
                  fill
                  className="object-contain"
                  style={aspect ? { aspectRatio: `${aspect.width} / ${aspect.height}` } : undefined}
                  sizes="(min-width: 1024px) 640px, 100vw"
                />
              )}
            </div>
          </div>
          <div className="space-y-4 lg:order-none">
            <p className="text-sm font-semibold uppercase tracking-micro text-text-muted">
              {engineLabel ?? video.engineId ?? 'MaxVideoAI'}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-text-primary">{heroHeading}</h1>
            <p className="text-base leading-relaxed text-text-secondary">{heroIntro}</p>
            <PromptPreview
              prompt={prompt}
              promptLabel={copy.hero.promptLabel}
              promptFallback={copy.hero.promptFallback}
              showMoreLabel={copy.hero.showMore}
              showLessLabel={copy.hero.showLess}
              copyLabel={copy.hero.copy}
              copiedLabel={copy.hero.copied}
            />
          </div>
        </section>
        <section className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <div className="rounded-card border border-border bg-white/90 p-6 shadow-card backdrop-blur">
            <div className="space-y-4">
              {engineLink ? (
                <Link
                  href={engineLink}
                  className="block rounded-lg border border-hairline bg-bg p-4 transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <p className="text-xs uppercase tracking-micro text-text-muted">{copy.details.engineLabel}</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{engineLabel}</p>
                  <p className="mt-1 text-sm text-text-secondary">{engineDescription}</p>
                  <span className="mt-3 inline-flex items-center text-sm font-semibold text-accent">
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
              <dl className="grid gap-4 text-sm text-text-secondary sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-micro text-text-muted">{copy.details.priceTotalLabel}</dt>
                  <dd className="mt-1 text-base font-medium text-text-primary">{totalPriceDisplay}</dd>
                  {discountNote ? (
                    <p className="mt-1 text-xs font-semibold text-accent">{discountNote}</p>
                  ) : null}
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-micro text-text-muted">{copy.details.durationLabel}</dt>
                  <dd className="mt-1 text-base font-medium text-text-primary">{durationDisplay}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-micro text-text-muted">{copy.details.aspectLabel}</dt>
                  <dd className="mt-1 text-base font-medium text-text-primary">{aspectDisplay}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-micro text-text-muted">{copy.details.createdLabel}</dt>
                  <dd className="mt-1 text-base font-medium text-text-primary">{createdDisplay}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-micro text-text-muted">{copy.details.audioLabel}</dt>
                  <dd className="mt-1 text-base font-medium text-text-primary">
                    {audioDisplay.charAt(0).toUpperCase() + audioDisplay.slice(1)}
                  </dd>
                </div>
              </dl>
              <div>
                <Link
                  href={pricingPath}
                  className="inline-flex w-full items-center justify-center rounded-pill border border-hairline bg-white px-5 py-2 text-sm font-semibold text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  {copy.details.cta}
                </Link>
                <p className="mt-2 text-xs text-text-secondary">{copy.details.ctaDescription}</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-card border border-border bg-white/90 p-6 shadow-card backdrop-blur">
              <p className="text-xs uppercase tracking-micro text-text-muted">{copy.create.title}</p>
              <h3 className="mt-1 text-lg font-semibold text-text-primary">{copy.create.subtitle}</h3>
              <p className="mt-2 text-sm text-text-secondary">{copy.create.body}</p>
              <Link
                href={`/generate?from=${encodeURIComponent(video.id)}`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-pill bg-accent px-5 py-3 text-sm font-semibold uppercase tracking-micro text-white transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {copy.create.cta}
              </Link>
            </div>
            <div className="rounded-card border border-border bg-white/90 p-6 shadow-card backdrop-blur">
              <h3 className="text-lg font-semibold text-text-primary">{copy.blog.title}</h3>
              <p className="mt-2 text-sm text-text-secondary">{copy.blog.message}</p>
              <Link
                href={blogPath}
                className="mt-4 inline-flex w-full items-center justify-center rounded-pill border border-hairline px-5 py-2 text-sm font-semibold text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {copy.blog.cta}
              </Link>
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
