import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { getVideoById } from '@/server/videos';
import { VideoPromptCard } from '@/components/VideoPromptCard';

type PageProps = {
  params: { id: string };
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maxvideoai.com').replace(/\/$/, '');
const FALLBACK_THUMB = `${SITE}/og/price-before.png`;
const FALLBACK_POSTER = `${SITE}/og/price-before.png`;
const TITLE_SUFFIX = ' — MaxVideoAI';
const META_TITLE_LIMIT = 60;

export const revalidate = 60 * 30; // 30 minutes

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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const video = await fetchVideo(params.id);
  if (!video) {
    return {
      title: 'Video not found — MaxVideoAI',
      description: 'The requested video is unavailable.',
      robots: { index: false, follow: false },
    };
  }

  const primaryTitle =
    video.promptExcerpt ||
    video.prompt ||
    `${video.engineLabel ?? 'MaxVideoAI'} example (${video.durationSec}s)`;
  const metaTitle = buildMetaTitle(primaryTitle);
  const description = formatPrompt(video.promptExcerpt ?? video.prompt);
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

  const canonical = `${SITE}/video/${encodeURIComponent(video.id)}`;
  const prompt = video.prompt ?? video.promptExcerpt ?? '';
  const description = formatPrompt(prompt);
  const videoUrl = toAbsoluteUrl(video.videoUrl) ?? video.videoUrl ?? canonical;
  const thumbnailUrl = toAbsoluteUrl(video.thumbUrl) ?? FALLBACK_THUMB;
  const poster = video.thumbUrl ?? FALLBACK_POSTER;
  const aspect = parseAspectRatio(video.aspectRatio);
  const isPortrait = aspect ? aspect.width < aspect.height : false;

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
    description,
    thumbnailUrl: [thumbnailUrl],
    uploadDate: new Date(video.createdAt).toISOString(),
    duration: toDurationIso(video.durationSec),
    contentUrl: videoUrl,
    embedUrl: canonical,
    caption: prompt && prompt !== description ? prompt : undefined,
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
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <div className="mb-6 text-xs uppercase tracking-micro text-text-muted">
        <Link href="/examples" className="transition hover:text-text-secondary">
          ← Back to examples
        </Link>
      </div>
      <article className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <div
            className="relative overflow-hidden rounded-card border border-border bg-black"
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
                alt={description}
                fill
                className="object-contain"
                style={aspect ? { aspectRatio: `${aspect.width} / ${aspect.height}` } : undefined}
                sizes="(min-width: 1024px) 640px, 100vw"
              />
            )}
          </div>
          <div className="rounded-card border border-border bg-white p-6 shadow-card">
            <h1 className="text-2xl font-semibold text-text-primary">
              {video.engineLabel ?? 'MaxVideoAI Render'}
            </h1>
            <p className="mt-2 text-sm text-text-secondary">{description}</p>
            <dl className="mt-4 grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-micro text-text-muted">Duration</dt>
                <dd>{video.durationSec ? `${video.durationSec} seconds` : 'Unknown'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-micro text-text-muted">Aspect ratio</dt>
                <dd>{video.aspectRatio ?? 'Auto'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-micro text-text-muted">Created</dt>
                <dd>{new Date(video.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-micro text-text-muted">Audio</dt>
                <dd>{video.hasAudio ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </div>
        </section>
        <aside className="space-y-4">
          <VideoPromptCard prompt={prompt} videoId={video.id} />
          <div className="rounded-card border border-border bg-white p-5 shadow-card text-sm text-text-secondary">
            <h3 className="text-sm font-semibold text-text-primary">Details</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <span className="text-xs uppercase tracking-micro text-text-muted">Engine</span>
                <div>{video.engineLabel ?? video.engineId ?? 'Unknown'}</div>
              </li>
              <li>
                <span className="text-xs uppercase tracking-micro text-text-muted">Visibility</span>
                <div>{video.visibility === 'public' ? 'Public' : 'Private'}</div>
              </li>
              <li>
                <span className="text-xs uppercase tracking-micro text-text-muted">Indexable</span>
                <div>{video.indexable ? 'Enabled' : 'Disabled'}</div>
              </li>
            </ul>
          </div>
        </aside>
      </article>
      <Script id={`video-jsonld-${video.id}`} type="application/ld+json">
        {JSON.stringify(videoJsonLd)}
      </Script>
    </div>
  );
}
