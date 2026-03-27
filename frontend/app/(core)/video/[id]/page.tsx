import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { cache } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { CopyPromptButton } from '@/components/CopyPromptButton';
import { ButtonLink } from '@/components/ui/Button';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { getVideoWatchPageDataById } from '@/server/video-seo';

type PageProps = {
  params: { id: string };
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maxvideoai.com').replace(/\/$/, '');
const FALLBACK_THUMB = `${SITE}/og/price-before.png`;
const FALLBACK_POSTER = `${SITE}/og/price-before.png`;
const TITLE_SUFFIX = ' — MaxVideoAI';
const META_TITLE_LIMIT = 60;

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

function buildMetaTitle(primary: string) {
  const available = Math.max(10, META_TITLE_LIMIT - TITLE_SUFFIX.length);
  const safePrimary = primary && primary.trim().length ? primary.trim() : 'Video example';
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
      title: `Video unavailable${TITLE_SUFFIX}`,
      description: 'This video is no longer available on MaxVideoAI.',
      robots: { index: false, follow: true },
      alternates: { canonical },
    };
  }

  const { video, signals, isEligible } = page;
  const metaTitle = buildMetaTitle(signals.title);
  const description = signals.metaDescription;
  const thumbnail = toAbsoluteUrl(video.thumbUrl) ?? FALLBACK_THUMB;
  const videoUrl = toAbsoluteUrl(video.videoUrl) ?? canonical;
  const aspect = parseAspectRatio(signals.aspectRatio ?? video.aspectRatio);
  const width = aspect ? Math.round((aspect.width / aspect.height) * 720) : 1280;
  const height = aspect ? 720 : 720;

  return {
    title: metaTitle,
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
    maxHeight: '54vh',
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

  return (
    <div className="relative mx-auto max-w-6xl overflow-hidden px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <link rel="preload" as="image" href={playbackPoster} fetchPriority="high" />
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          {signals.breadcrumbs.map((crumb, index) => (
            <li key={`${crumb.label}-${index}`} className="inline-flex items-center gap-2">
              {index > 0 ? <span aria-hidden>/</span> : null}
              {crumb.href ? (
                <Link href={crumb.href} prefetch={false} className="font-medium hover:text-text-primary">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-text-primary">{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <article className="relative space-y-8">
        <section className="mx-auto w-full max-w-5xl rounded-[28px] border border-border bg-[linear-gradient(180deg,var(--surface-glass-95),var(--surface-2))] p-4 shadow-[0_20px_48px_rgba(15,23,42,0.08)] dark:border-white/10 dark:shadow-[0_24px_56px_rgba(0,0,0,0.3)]">
          <div className="border-b border-hairline pb-4">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-micro text-text-secondary">
                {signals.badges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-hairline bg-surface-glass-90 px-2.5 py-1 text-[10px] text-text-secondary shadow-[0_8px_18px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-white/5 dark:shadow-none"
                  >
                    {badge}
                  </span>
                ))}
              </div>
              <h1 className="text-[1.65rem] font-semibold tracking-tight text-text-primary sm:text-[2rem]">{signals.title}</h1>
              <p className="max-w-3xl text-[13px] leading-6 text-text-secondary sm:text-sm">{signals.intro}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {signals.parentPath ? (
                  <Link
                    href={signals.parentPath}
                    prefetch={false}
                    className="inline-flex items-center rounded-full border border-hairline px-3.5 py-1.5 text-[13px] font-semibold text-text-primary transition hover:border-text-muted hover:bg-surface-2"
                  >
                    {signals.parentLabel}
                  </Link>
                ) : null}
                {signals.modelPath ? (
                  <Link
                    href={signals.modelPath}
                    prefetch={false}
                    className="inline-flex items-center rounded-full border border-hairline px-3.5 py-1.5 text-[13px] font-semibold text-text-primary transition hover:border-text-muted hover:bg-surface-2"
                  >
                    {signals.modelLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-[24px] border border-hairline bg-black" style={containerStyle}>
            <video
              controls
              poster={playbackPoster}
              className="h-full w-full object-contain"
              playsInline
              preload="none"
              style={aspect ? { aspectRatio: `${aspect.width} / ${aspect.height}` } : undefined}
            >
              <source src={video.videoUrl} type="video/mp4" />
            </video>
          </div>

          <div className="mt-3 rounded-[22px] border border-hairline bg-surface-glass-90 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">Prompt</p>
                <p className="mt-1 text-[13px] leading-5 text-text-secondary">{signals.promptPreview}</p>
              </div>
              <CopyPromptButton prompt={signals.promptText} copyLabel="Copy prompt" copiedLabel="Copied!" />
            </div>
            <details className="group mt-3 rounded-2xl border border-border bg-surface-2 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
              <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary transition hover:text-text-primary">
                <span className="group-open:hidden">Show full prompt</span>
                <span className="hidden group-open:inline">Hide full prompt</span>
              </summary>
              <p className="mt-3 whitespace-pre-line text-[13px] leading-6 text-text-secondary">{signals.promptText}</p>
            </details>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-text-primary">Render details</h2>
          </div>

          <div className="grid items-start gap-2.5 sm:gap-3 xl:grid-cols-2">
            <div className="space-y-2.5 sm:space-y-3">
              <div className="rounded-[20px] border border-border bg-[linear-gradient(180deg,var(--surface-glass-95),var(--surface-2))] p-3 shadow-[0_14px_30px_rgba(15,23,42,0.06)] dark:border-white/10 dark:shadow-[0_18px_36px_rgba(0,0,0,0.24)] sm:rounded-[24px] sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary">Workflow</p>
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-3">
                  {signals.whatThisShows.map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-xl border border-border bg-surface px-2.5 py-2.5 dark:border-white/10 dark:bg-white/5 sm:rounded-2xl sm:px-3 sm:py-3">
                      <p className="text-[12px] font-medium leading-4.5 text-text-primary sm:text-[13px] sm:leading-5">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {hasControls ? (
                <div className="rounded-[20px] border border-border bg-[linear-gradient(180deg,var(--surface-glass-95),var(--surface-2))] p-3 shadow-[0_14px_30px_rgba(15,23,42,0.06)] dark:border-white/10 dark:shadow-[0_18px_36px_rgba(0,0,0,0.24)] sm:rounded-[24px] sm:p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary">Controls</p>
                  <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-3">
                    {signals.promptRows.map((row) => (
                      <div key={row.key} className="rounded-xl border border-border bg-surface px-2.5 py-2.5 dark:border-white/10 dark:bg-white/5 sm:rounded-2xl sm:px-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">{row.label}</p>
                        <p className="mt-1 text-[12px] font-medium leading-4.5 text-text-primary sm:mt-1.5 sm:text-[13px] sm:leading-5">{row.value}</p>
                      </div>
                    ))}
                    {signals.inputRows.map((row) => (
                      <div key={row.key} className="rounded-xl border border-border bg-surface px-2.5 py-2.5 dark:border-white/10 dark:bg-white/5 sm:rounded-2xl sm:px-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">{row.label}</p>
                        <p className="mt-1 text-[12px] font-medium leading-4.5 text-text-primary sm:mt-1.5 sm:text-[13px] sm:leading-5">{row.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-[20px] border border-border bg-[linear-gradient(180deg,var(--surface-glass-95),var(--surface-2))] p-3 shadow-[0_14px_30px_rgba(15,23,42,0.06)] dark:border-white/10 dark:shadow-[0_18px_36px_rgba(0,0,0,0.24)] sm:rounded-[24px] sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary">Engine</p>
                <h3 className="mt-1 text-base font-semibold text-text-primary">{signals.engineLabel}</h3>
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-text-secondary sm:mt-2 sm:text-[13px] sm:leading-6 sm:line-clamp-none">
                  {signals.engineDescription}
                </p>
                {signals.engineBadges.length ? (
                  <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-3">
                    {signals.engineBadges.map((badge) => (
                      <div key={badge} className="rounded-xl border border-border bg-surface px-2.5 py-2.5 text-[11px] font-medium text-text-primary dark:border-white/10 dark:bg-white/5 sm:rounded-2xl sm:px-3 sm:text-[12px]">
                        {badge}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2 sm:mt-4 sm:flex-col">
                  {signals.modelPath ? (
                    <Link
                      href={signals.modelPath}
                      prefetch={false}
                      className="inline-flex items-center justify-center rounded-pill bg-text-primary px-4 py-2.5 text-[13px] font-semibold text-surface transition hover:bg-text-primary/90 dark:text-bg"
                    >
                      {signals.modelLabel}
                    </Link>
                  ) : null}
                  {signals.parentPath ? (
                    <Link
                      href={signals.parentPath}
                      prefetch={false}
                      className="inline-flex items-center justify-center rounded-pill border border-hairline bg-surface px-4 py-2.5 text-[13px] font-semibold text-text-primary transition hover:border-text-muted hover:bg-surface-2 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      {signals.parentLabel}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-2.5 sm:space-y-3">
              <div className="rounded-[20px] border border-border bg-[linear-gradient(180deg,var(--surface-glass-95),var(--surface-2))] p-3 shadow-[0_14px_30px_rgba(15,23,42,0.06)] dark:border-white/10 dark:shadow-[0_18px_36px_rgba(0,0,0,0.24)] sm:rounded-[24px] sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-secondary">Specs</p>
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-3">
                  {signals.detailRows.map((row) => (
                    <div key={row.key} className="rounded-xl border border-border bg-surface px-2.5 py-2.5 dark:border-white/10 dark:bg-white/5 sm:rounded-2xl sm:px-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">{row.label}</p>
                      <p className="mt-1 text-[13px] font-semibold leading-5 text-text-primary sm:mt-1.5 sm:text-[15px]">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {related.length ? (
          <section className="mx-auto w-full max-w-5xl rounded-[26px] border border-border bg-[linear-gradient(180deg,var(--surface-glass-95),var(--surface-2))] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:shadow-[0_22px_48px_rgba(0,0,0,0.28)] [content-visibility:auto] [contain-intrinsic-size:420px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-text-primary">Related examples</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {related.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[20px] border border-border bg-surface shadow-[0_12px_28px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.09)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_16px_34px_rgba(0,0,0,0.24)] dark:hover:shadow-[0_22px_44px_rgba(0,0,0,0.32)]"
                >
                  <Link href={item.href} prefetch={false} className="block">
                    <div className="relative aspect-video bg-surface-on-media-dark-5">
                      {item.thumbUrl ? (
                        <Image src={item.thumbUrl} alt={item.title} fill className="object-cover" sizes="(min-width: 1280px) 260px, (min-width: 768px) 40vw, 100vw" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-micro text-text-secondary">
                          No preview
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 px-3.5 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-micro text-text-secondary">{item.reason}</p>
                      <h3 className="text-[13px] font-semibold leading-5 text-text-primary">{item.title}</h3>
                      <p className="line-clamp-2 text-[12px] leading-5 text-text-secondary">{item.subtitle}</p>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mx-auto w-full max-w-5xl rounded-[26px] border border-border bg-[linear-gradient(180deg,var(--surface-glass-95),var(--surface-2))] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:shadow-[0_22px_48px_rgba(0,0,0,0.28)] [content-visibility:auto] [contain-intrinsic-size:260px]">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-micro text-text-secondary">Recreate</p>
              <h2 className="mt-1 text-lg font-semibold text-text-primary">Load this render in the workspace</h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-6 text-text-secondary">
                Start from the same prompt and settings, then remix duration, aspect ratio, references, or audio.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink href={signals.recreatePath} prefetch={false}>
                  Recreate in workspace
                </ButtonLink>
                {signals.parentPath ? (
                  <Link
                    href={signals.parentPath}
                    prefetch={false}
                    className="inline-flex items-center rounded-pill border border-hairline bg-surface px-3.5 py-2 text-[13px] font-semibold text-text-primary transition hover:border-text-muted hover:bg-surface-2 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    {signals.parentLabel}
                  </Link>
                ) : null}
                {signals.modelPath ? (
                  <Link
                    href={signals.modelPath}
                    prefetch={false}
                    className="inline-flex items-center rounded-pill border border-hairline bg-surface px-3.5 py-2 text-[13px] font-semibold text-text-primary transition hover:border-text-muted hover:bg-surface-2 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    {signals.modelLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </section>
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
