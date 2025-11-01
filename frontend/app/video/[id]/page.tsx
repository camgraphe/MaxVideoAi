import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { CopyPromptButton } from '@/components/CopyPromptButton';
import { getVideoById } from '@/server/videos';

type PageProps = {
  params: { id: string };
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maxvideoai.com').replace(/\/$/, '');
const FALLBACK_THUMB = `${SITE}/og/price-before.png`;
const FALLBACK_POSTER = `${SITE}/og/price-before.png`;

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

async function fetchVideo(id: string) {
  const video = await getVideoById(id);
  if (!video) return null;
  if (video.visibility !== 'public') return null;
  if (!video.indexable) return null;
  if (!video.videoUrl) return null;
  return video;
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

  const title =
    video.promptExcerpt ||
    video.prompt ||
    `${video.engineLabel ?? 'MaxVideoAI'} example (${video.durationSec}s)`;
  const description = formatPrompt(video.promptExcerpt ?? video.prompt);
  const canonical = `${SITE}/video/${encodeURIComponent(video.id)}`;
  const thumbnail = toAbsoluteUrl(video.thumbUrl) ?? FALLBACK_THUMB;
  const videoUrl = toAbsoluteUrl(video.videoUrl) ?? canonical;

  return {
    title: `${title} — MaxVideoAI`,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'video.other',
      siteName: 'MaxVideoAI',
      url: canonical,
      title,
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
      images: [{ url: thumbnail, width: 1280, height: 720 }],
    },
    twitter: {
      card: 'player',
      title,
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
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <div className="mb-6 text-xs uppercase tracking-micro text-text-muted">
        <Link href="/examples" className="transition hover:text-text-secondary">
          ← Back to examples
        </Link>
      </div>
      <article className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-card border border-border bg-black" style={{ aspectRatio: '16 / 9' }}>
            {video.videoUrl ? (
              <video
                controls
                poster={poster}
                className="h-full w-full object-cover"
                playsInline
                preload="metadata"
              >
                <source src={video.videoUrl} type="video/mp4" />
              </video>
            ) : (
              <Image
                src={poster}
                alt={description}
                fill
                className="object-cover"
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
          <div className="rounded-card border border-border bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-text-primary">Prompt</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/generate?from=${encodeURIComponent(video.id)}`}
                className="inline-flex items-center rounded-pill border border-hairline px-4 py-2 text-xs font-semibold uppercase tracking-micro text-text-primary transition hover:border-accent hover:text-accent"
              >
                Remix in workspace →
              </Link>
              <CopyPromptButton prompt={prompt} />
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">
              {prompt || 'Prompt unavailable.'}
            </p>
          </div>
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
    </main>
  );
}
