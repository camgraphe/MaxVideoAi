import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { cache } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import {
  ArrowRight,
  BadgeDollarSign,
  Box,
  CalendarDays,
  Clock3,
  ExternalLink,
  Film,
  GalleryHorizontal,
  Monitor,
  Sparkles,
  Tag,
  TextCursorInput,
  Volume2,
  WandSparkles,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { CopyPromptButton } from '@/components/CopyPromptButton';
import { ButtonLink } from '@/components/ui/Button';
import { WatchVideoPlayer } from '@/components/watch/WatchVideoPlayer';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
import { getVideoWatchPageDataById } from '@/server/video-seo';

type PageProps = {
  params: { id: string };
};

const SITE = SITE_ORIGIN.replace(/\/$/, '');
const FALLBACK_THUMB = `${SITE}/og/price-before.png`;
const FALLBACK_POSTER = `${SITE}/og/price-before.png`;
const TITLE_SUFFIX = ' — MaxVideoAI';
const META_TITLE_LIMIT = 60;
const TRAILING_BRAND_SUFFIX = /\s+[—-]\s*MaxVideo\s*AI\s*$/i;

const getWatchPageData = cache(async (id: string) => getVideoWatchPageDataById(id));
type WatchPageData = NonNullable<Awaited<ReturnType<typeof getVideoWatchPageDataById>>>;

export const revalidate = 60 * 30;

function truncateForMeta(title: string, limit: number) {
  if (title.length <= limit) return title;
  const slice = title.slice(0, Math.max(1, limit - 1));
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > Math.floor(limit * 0.6)) {
    return `${slice.slice(0, lastSpace).trim()}…`;
  }
  return `${slice.trim()}…`;
}

function normalizeTitlePrimary(primary: string) {
  let normalized = primary.trim();
  while (TRAILING_BRAND_SUFFIX.test(normalized)) {
    normalized = normalized.replace(TRAILING_BRAND_SUFFIX, '').trim();
  }
  return normalized;
}

function buildMetaTitle(primary: string) {
  const available = Math.max(10, META_TITLE_LIMIT - TITLE_SUFFIX.length);
  const normalizedPrimary = primary ? normalizeTitlePrimary(primary) : '';
  const safePrimary = normalizedPrimary.length ? normalizedPrimary : 'Video example';
  return `${truncateForMeta(safePrimary, available)}${TITLE_SUFFIX}`;
}

function toDurationIso(seconds?: number | null): string {
  const safe = Math.max(1, Math.round(Number(seconds ?? 0) || 1));
  return `PT${safe}S`;
}

function toAbsoluteUrl(value?: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `${SITE}${value}`;
  return `${SITE}/${value.replace(/^\/+/, '')}`;
}

type AspectRatio = { width: number; height: number } | null;
type DetailRow = { key: string; label: string; value: string };
type HighlightTone = 'blue' | 'green' | 'rose' | 'amber' | 'slate';

function parseAspectRatio(value?: string | null): AspectRatio {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const [w, h] = trimmed.split(':');
    const width = Number.parseFloat(w);
    const height = Number.parseFloat(h);
    if (Number.isFinite(width) && Number.isFinite(height) && height > 0) return { width, height };
    return null;
  }
  const numeric = Number.parseFloat(trimmed);
  if (Number.isFinite(numeric) && numeric > 0) {
    return { width: numeric, height: 1 };
  }
  return null;
}

function getDetailValue(rows: DetailRow[], key: string): string | null {
  return rows.find((row) => row.key === key)?.value ?? null;
}

function getDetailIcon(key: string): LucideIcon {
  switch (key) {
    case 'engine':
      return Film;
    case 'mode':
      return WandSparkles;
    case 'duration':
      return Clock3;
    case 'aspectRatio':
      return Monitor;
    case 'resolution':
      return GalleryHorizontal;
    case 'audio':
      return Volume2;
    case 'cost':
      return BadgeDollarSign;
    case 'created':
      return CalendarDays;
    default:
      return Box;
  }
}

function formatWatchDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function humanizeTag(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildHighlightItems(signals: WatchPageData['signals']): Array<{
  title: string;
  body: string;
  tone: HighlightTone;
  Icon: LucideIcon;
}> {
  const items = signals.whatThisShows.slice(0, 5).map((item, index) => {
    const lower = item.toLowerCase();
    const isAudio = lower.includes('audio');
    const isCamera = lower.includes('camera') || lower.includes('push') || lower.includes('tracking') || lower.includes('drone');
    const isFrame = lower.includes('frame') || lower.includes('image');
    const isStyle = lower.includes('style') || lower.includes('scene');
    return {
      title: item,
      body: isCamera
        ? 'Camera and movement cue'
        : isAudio
          ? 'Audio-driven atmosphere'
          : isFrame
            ? 'Source or framing control'
            : isStyle
              ? 'Visual direction'
              : 'Generation signal',
      tone: (isCamera ? 'blue' : isAudio ? 'slate' : isFrame ? 'green' : isStyle ? 'amber' : 'rose') as HighlightTone,
      Icon: isCamera ? Waves : isAudio ? Volume2 : isFrame ? GalleryHorizontal : isStyle ? Sparkles : WandSparkles,
      index,
    };
  });

  if (items.length) return items;

  return signals.capabilityTags.slice(0, 5).map((tag) => ({
    title: humanizeTag(tag),
    body: 'Detected workflow signal',
    tone: 'blue' as HighlightTone,
    Icon: WandSparkles,
  }));
}

function getHighlightToneClass(tone: HighlightTone): string {
  switch (tone) {
    case 'green':
      return 'bg-success-bg text-success';
    case 'rose':
      return 'bg-error-bg text-error';
    case 'amber':
      return 'bg-warning-bg text-warning';
    case 'slate':
      return 'bg-surface-3 text-text-secondary';
    case 'blue':
    default:
      return 'bg-[var(--brand-soft)] text-brand';
  }
}

function WatchCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-card border border-hairline bg-surface shadow-card ${className}`}>
      {children}
    </section>
  );
}

function isRenderable(page: Awaited<ReturnType<typeof getVideoWatchPageDataById>>): page is WatchPageData {
  if (!page?.video) return false;
  if (page.video.visibility !== 'public') return false;
  if (!page.video.indexable) return false;
  if (!page.video.videoUrl) return false;
  return true;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = await getWatchPageData(params.id);
  const canonical = `${SITE}/video/${encodeURIComponent(params.id)}`;

  if (!isRenderable(page)) {
    return {
      title: { absolute: `Video unavailable${TITLE_SUFFIX}` },
      description: 'This video is no longer available on MaxVideoAI.',
      robots: { index: false, follow: true },
      alternates: { canonical },
    };
  }

  const { video, signals, isEligible } = page;
  const metaTitle = buildMetaTitle(signals.metaTitle);
  const description = signals.metaDescription;
  const thumbnail = toAbsoluteUrl(video.thumbUrl) ?? FALLBACK_THUMB;
  const videoUrl = toAbsoluteUrl(video.videoUrl) ?? canonical;
  const aspect = parseAspectRatio(signals.aspectRatio ?? video.aspectRatio);
  const width = aspect ? Math.round((aspect.width / aspect.height) * 720) : 1280;
  const height = aspect ? 720 : 720;

  return {
    title: { absolute: metaTitle },
    description,
    robots: { index: isEligible, follow: true },
    alternates: { canonical },
    openGraph: {
      type: 'video.other',
      siteName: 'MaxVideoAI',
      url: canonical,
      title: metaTitle,
      description,
      videos: [{ url: videoUrl, secureUrl: videoUrl, type: 'video/mp4', width, height }],
      images: [{ url: thumbnail, width, height, alt: signals.title }],
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
}

export default async function VideoPage({ params }: PageProps) {
  const page = await getWatchPageData(params.id);
  if (!page) notFound();

  const { video, signals, related, isEligible } = page;
  const canonical = `${SITE}/video/${encodeURIComponent(video.id)}`;
  const playbackPoster =
    buildOptimizedPosterUrl(video.thumbUrl ?? FALLBACK_POSTER, { width: 1200, quality: 72 }) ??
    video.thumbUrl ??
    FALLBACK_POSTER;
  const videoUrl = toAbsoluteUrl(video.videoUrl) ?? video.videoUrl ?? canonical;
  const thumbnailUrl = toAbsoluteUrl(video.thumbUrl) ?? FALLBACK_THUMB;
  const aspect = parseAspectRatio(signals.aspectRatio ?? video.aspectRatio);
  const backHref = signals.parentPath ?? signals.modelPath ?? '/examples';
  const hasControls = Boolean(signals.promptRows.length || signals.inputRows.length);

  if (!isRenderable(page)) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        <Link href={backHref} prefetch={false} className="text-xs font-semibold uppercase tracking-micro text-text-secondary hover:text-text-primary">
          Back
        </Link>
        <div className="mt-6 rounded-card border border-border bg-surface px-6 py-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-text-primary">Video unavailable</h1>
          <p className="mt-4 text-base text-text-secondary">
            This video is no longer available. It may have been removed or the primary asset is missing.
          </p>
          <div className="mt-6 flex justify-center">
            <ButtonLink href={backHref} size="sm" prefetch={false}>
              Browse examples
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  const containerStyle: CSSProperties = {
    maxHeight: '62vh',
    width: '100%',
  };
  if (aspect) {
    containerStyle.aspectRatio = `${aspect.width} / ${aspect.height}`;
    const maxWidth = 54 * (aspect.width / aspect.height);
    containerStyle.maxWidth = `${maxWidth.toFixed(2)}vh`;
    containerStyle.margin = '0 auto';
  }

  const videoJsonLd = isEligible
    ? {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        url: canonical,
        mainEntityOfPage: canonical,
        name: signals.title,
        description: signals.videoDescription,
        thumbnailUrl: [thumbnailUrl],
        uploadDate: new Date(video.createdAt).toISOString(),
        duration: toDurationIso(signals.durationSec ?? video.durationSec),
        contentUrl: videoUrl,
        publisher: {
          '@type': 'Organization',
          name: 'MaxVideoAI',
          url: SITE,
          logo: {
            '@type': 'ImageObject',
            url: `${SITE}/favicon-512.png`,
          },
        },
      }
    : null;

  const breadcrumbJsonLd = isEligible
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: signals.breadcrumbs.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.label,
          ...(item.href ? { item: `${SITE}${item.href === '/' ? '' : item.href}` } : {}),
        })),
      }
    : null;

  const detailRows = signals.detailRows;
  const workflowLabel = getDetailValue(detailRows, 'mode') ?? signals.modeLabel;
  const durationLabel =
    getDetailValue(detailRows, 'duration') ??
    (signals.durationSec ? `${signals.durationSec} seconds` : null);
  const aspectLabel = getDetailValue(detailRows, 'aspectRatio') ?? signals.aspectRatio;
  const resolutionLabel = getDetailValue(detailRows, 'resolution') ?? signals.resolution;
  const audioLabel = getDetailValue(detailRows, 'audio') ?? (signals.hasAudio ? 'Enabled' : 'Off');
  const costLabel = getDetailValue(detailRows, 'cost');
  const createdLabel = formatWatchDate(video.createdAt);
  const sidebarDetailRows = detailRows.some((row) => row.key === 'created')
    ? detailRows
    : [...detailRows, { key: 'created', label: 'Created', value: createdLabel }];
  const highlightItems = buildHighlightItems(signals);
  const cameraHighlights = signals.capabilityTags
    .filter((tag) => ['push-in', 'tracking', 'drone', 'close-up', 'transition', 'camera-lock'].includes(tag))
    .map(humanizeTag);
  const promptBreakdownRows = [
    { label: 'Subject', value: signals.promptPreview },
    { label: 'Workflow', value: workflowLabel },
    { label: 'Camera', value: cameraHighlights.length ? cameraHighlights.join(', ') : humanizeTag(signals.primaryIntent) },
    { label: 'Output', value: [durationLabel, aspectLabel, resolutionLabel].filter(Boolean).join(' · ') },
    { label: 'Audio', value: audioLabel },
    { label: 'Constraints', value: signals.negativePrompt ?? signals.capabilityTags.slice(0, 3).map(humanizeTag).join(', ') },
  ].filter((row) => row.value);
  const heroChips = [
    { key: 'engine', label: signals.engineLabel, Icon: Film },
    { key: 'workflow', label: workflowLabel, Icon: TextCursorInput },
    { key: 'duration', label: durationLabel, Icon: Clock3 },
    { key: 'aspect', label: aspectLabel, Icon: Monitor },
    { key: 'audio', label: audioLabel, Icon: Volume2 },
    { key: 'cost', label: costLabel, Icon: Tag },
  ].filter((chip): chip is { key: string; label: string; Icon: LucideIcon } => Boolean(chip.label));
  const keyFrames = [
    { label: 'Opening frame', position: 'object-left' },
    { label: 'Motion beat', position: 'object-center' },
    { label: 'Final shot', position: 'object-right' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-20 pt-5 sm:px-6 lg:px-8">
      <link rel="preload" as="image" href={playbackPoster} fetchPriority="high" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            {signals.breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="inline-flex items-center gap-2">
                {index > 0 ? <span aria-hidden>›</span> : null}
                {crumb.href ? (
                  <Link href={crumb.href} prefetch={false} className="font-medium hover:text-text-primary">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-text-primary">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <ButtonLink href={signals.recreatePath} size="sm" prefetch={false} className="bg-text-primary text-bg shadow-card hover:bg-text-primary/90">
          <Sparkles className="h-4 w-4" aria-hidden />
          Start a render
        </ButtonLink>
      </div>

      <article className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <WatchCard className="overflow-hidden">
            <WatchVideoPlayer
              src={videoUrl}
              poster={playbackPoster}
              title={signals.title}
              engineLabel={signals.engineLabel}
              hasAudio={signals.hasAudio}
              containerStyle={containerStyle}
              videoStyle={aspect ? { aspectRatio: `${aspect.width} / ${aspect.height}` } : undefined}
            />

            <div className="p-5 sm:p-6">
              <div className="max-w-3xl">
                <h1 className="text-[1.75rem] font-semibold tracking-tight text-text-primary sm:text-[2.1rem]">{signals.title}</h1>
                <p className="mt-2 text-sm leading-6 text-text-secondary sm:text-[15px]">{signals.intro}</p>
              </div>

              {heroChips.length ? (
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {heroChips.map(({ key, label, Icon }) => (
                    <span
                      key={key}
                      className="inline-flex min-h-[36px] items-center gap-2 rounded-input border border-hairline bg-surface-2 px-3 text-xs font-semibold text-text-secondary"
                    >
                      <Icon className="h-4 w-4 text-text-muted" aria-hidden />
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}

              {signals.badges.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {signals.badges.map((badge) => (
                    <span key={badge} className="rounded-pill bg-[var(--brand-soft)] px-2.5 py-1 text-[11px] font-semibold text-brand">
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ButtonLink href={signals.recreatePath} size="lg" prefetch={false} className="w-full bg-text-primary text-bg hover:bg-text-primary/90">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Recreate this video
                </ButtonLink>
                {signals.modelPath ? (
                  <ButtonLink href={signals.modelPath} variant="outline" size="lg" prefetch={false} className="w-full">
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Open model page
                  </ButtonLink>
                ) : signals.parentPath ? (
                  <ButtonLink href={signals.parentPath} variant="outline" size="lg" prefetch={false} className="w-full">
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Open examples
                  </ButtonLink>
                ) : null}
              </div>
            </div>
          </WatchCard>

          <WatchCard className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2">
                  <TextCursorInput className="h-4 w-4 text-brand" aria-hidden />
                  <h2 className="text-lg font-semibold text-text-primary">Prompt breakdown</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-text-secondary">Text-to-video prompt used to generate this render.</p>
              </div>
              <CopyPromptButton prompt={signals.promptText} copyLabel="Copy full prompt" copiedLabel="Copied!" />
            </div>

            <div className="mt-5 overflow-hidden rounded-input border border-hairline">
              <div className="border-b border-hairline bg-surface-2 px-4 py-3 text-sm leading-6 text-text-primary">{signals.promptPreview}</div>
              <div className="grid divide-y divide-hairline md:grid-cols-2 md:divide-x md:divide-y-0">
                {promptBreakdownRows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[110px_minmax(0,1fr)] divide-x divide-hairline">
                    <p className="bg-surface-2 px-3 py-3 text-[11px] font-semibold uppercase tracking-micro text-text-secondary">{row.label}</p>
                    <p className="px-3 py-3 text-xs leading-5 text-text-secondary">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {hasControls ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[...signals.promptRows, ...signals.inputRows].slice(0, 6).map((row) => (
                  <div key={row.key} className="rounded-input border border-hairline bg-surface-2 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-micro text-text-muted">{row.label}</p>
                    <p className="mt-1 text-xs font-semibold text-text-primary">{row.value}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <details className="group mt-4 rounded-input border border-hairline bg-surface px-4 py-3">
              <summary className="cursor-pointer list-none text-xs font-semibold text-brand transition hover:text-brandHover">
                <span className="group-open:hidden">Show full prompt</span>
                <span className="hidden group-open:inline">Hide full prompt</span>
              </summary>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-text-secondary">{signals.promptText}</p>
            </details>
          </WatchCard>

          <WatchCard className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-text-primary">Why {signals.engineLabel} fits this shot</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{signals.engineDescription}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(signals.engineBadges.length ? signals.engineBadges : signals.whatThisShows).slice(0, 4).map((badge, index) => (
                <div key={`${badge}-${index}`} className="rounded-input border border-hairline bg-surface-2 px-4 py-3">
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-input bg-[var(--brand-soft)] text-brand">
                    <Box className="h-4 w-4" aria-hidden />
                  </div>
                  <p className="text-sm font-semibold text-text-primary">{badge}</p>
                </div>
              ))}
            </div>
          </WatchCard>

          <WatchCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-text-primary">Key frames</h2>
              <ArrowRight className="h-4 w-4 text-text-muted" aria-hidden />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {keyFrames.map((frame) => (
                <figure key={frame.label} className="overflow-hidden rounded-input border border-hairline bg-surface-2">
                  <div className="relative aspect-video bg-surface-on-media-dark-5">
                    <Image
                      src={thumbnailUrl}
                      alt={`${signals.title} - ${frame.label}`}
                      fill
                      className={`object-cover ${
                        frame.position === 'object-left' ? 'object-left' : frame.position === 'object-right' ? 'object-right' : 'object-center'
                      }`}
                      sizes="(min-width: 1280px) 250px, (min-width: 640px) 30vw, 100vw"
                    />
                  </div>
                  <figcaption className="px-3 py-2 text-center text-xs text-text-secondary">{frame.label}</figcaption>
                </figure>
              ))}
            </div>
          </WatchCard>

          {related.length ? (
            <WatchCard className="p-5 sm:p-6 [content-visibility:auto] [contain-intrinsic-size:360px]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-text-primary">Related examples</h2>
                <Link href="/examples" prefetch={false} className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary hover:text-brand">
                  View all examples
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {related.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-input border border-hairline bg-surface-2 transition hover:-translate-y-0.5 hover:shadow-card">
                    <Link href={item.href} prefetch={false} className="block">
                      <div className="relative aspect-video bg-surface-on-media-dark-5">
                        {item.thumbUrl ? (
                          <Image
                            src={item.thumbUrl}
                            alt={item.title}
                            fill
                            className="object-cover"
                            sizes="(min-width: 1280px) 190px, (min-width: 640px) 45vw, 100vw"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-micro text-text-secondary">
                            No preview
                          </div>
                        )}
                        <span className="absolute left-2 top-2 rounded-pill bg-surface-on-media-dark-70 px-2 py-1 text-[10px] font-semibold text-on-inverse">
                          {signals.engineLabel}
                        </span>
                      </div>
                      <div className="space-y-1 px-3 py-3">
                        <h3 className="line-clamp-1 text-sm font-semibold text-text-primary">{item.title}</h3>
                        <p className="line-clamp-2 text-xs leading-5 text-text-secondary">{item.subtitle}</p>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </WatchCard>
          ) : null}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-[calc(var(--header-height)+24px)] lg:self-start">
          <WatchCard className="p-5">
            <h2 className="text-lg font-semibold text-text-primary">Render details</h2>
            <div className="mt-5 divide-y divide-hairline">
              {sidebarDetailRows.map((row) => {
                const DetailIcon = getDetailIcon(row.key);
                const label = row.key === 'mode' ? 'Workflow' : row.label;
                const value = row.key === 'created' ? createdLabel : row.value;
                return (
                  <div key={row.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="inline-flex min-w-0 items-center gap-3 text-sm text-text-secondary">
                      <DetailIcon className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                      <span>{label}</span>
                    </div>
                    <span className="text-right text-sm font-semibold text-text-primary">{value}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 space-y-2">
              <ButtonLink href={signals.recreatePath} prefetch={false} className="w-full bg-text-primary text-bg hover:bg-text-primary/90">
                <Sparkles className="h-4 w-4" aria-hidden />
                Recreate in workspace
              </ButtonLink>
              <ButtonLink href={signals.recreatePath} variant="outline" prefetch={false} className="w-full">
                <ExternalLink className="h-4 w-4" aria-hidden />
                Open in workspace
              </ButtonLink>
            </div>
          </WatchCard>

          <WatchCard className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-micro text-text-secondary">About this engine</p>
                <h2 className="mt-3 text-lg font-semibold text-text-primary">{signals.engineLabel}</h2>
              </div>
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-input bg-[var(--brand-soft)] text-brand">
                <Film className="h-5 w-5" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-text-secondary">{signals.engineDescription}</p>
            {signals.engineBadges.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {signals.engineBadges.slice(0, 4).map((badge) => (
                  <span key={badge} className="rounded-pill border border-hairline bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                    {badge}
                  </span>
                ))}
              </div>
            ) : null}
            {signals.modelPath ? (
              <Link
                href={signals.modelPath}
                prefetch={false}
                className="mt-5 inline-flex w-full items-center justify-between rounded-input bg-surface-2 px-4 py-3 text-sm font-semibold text-text-primary transition hover:bg-surface-hover"
              >
                Learn more about this engine
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : null}
          </WatchCard>

          <WatchCard className="p-5">
            <h2 className="text-lg font-semibold text-text-primary">Shot highlights</h2>
            <div className="mt-4 space-y-3">
              {highlightItems.map(({ title, body, tone, Icon }) => (
                <div key={title} className="flex gap-3">
                  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-input ${getHighlightToneClass(tone)}`}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-text-secondary">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </WatchCard>
        </aside>
      </article>

      {videoJsonLd ? (
        <Script id={`video-jsonld-${video.id}`} type="application/ld+json">
          {JSON.stringify(videoJsonLd)}
        </Script>
      ) : null}
      {breadcrumbJsonLd ? (
        <Script id={`video-breadcrumb-jsonld-${video.id}`} type="application/ld+json">
          {JSON.stringify(breadcrumbJsonLd)}
        </Script>
      ) : null}
    </div>
  );
}
