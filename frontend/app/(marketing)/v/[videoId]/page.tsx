import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import Link from 'next/link';
import Image from 'next/image';
import { getVideoById } from '@/server/videos';

type VideoPageProps = {
  params: { videoId: string };
};

function formatPrompt(prompt: string, maxLength = 320): string {
  const clean = prompt.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1)}…`;
}

function toDurationIso(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `PT${safe}S`;
}

async function fetchVideo(videoId: string) {
  const video = await getVideoById(videoId);
  if (!video) return null;
  if (video.visibility !== 'public') return null;
  return video;
}

export async function generateMetadata({ params }: VideoPageProps): Promise<Metadata> {
  const video = await fetchVideo(params.videoId);
  if (!video) {
    return {
      title: 'Video not found — MaxVideoAI',
      robots: { index: false, follow: false },
    };
  }

  const canonical = `https://maxvideoai.com/v/${encodeURIComponent(video.id)}`;
  const title = `${video.engineLabel} · ${video.durationSec}s · MaxVideoAI`;
  const description = formatPrompt(video.promptExcerpt ?? video.prompt);
  const robots = video.indexable
    ? { index: true, follow: true }
    : { index: false, follow: true };

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots,
    openGraph: {
      url: canonical,
      title,
      description,
      type: 'video.other',
      siteName: 'MaxVideoAI',
      images: video.thumbUrl ? [{ url: video.thumbUrl }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: video.thumbUrl ? [video.thumbUrl] : undefined,
    },
  };
}

export default async function VideoPage({ params }: VideoPageProps) {
  const video = await fetchVideo(params.videoId);
  if (!video) {
    notFound();
  }

  const canonical = `https://maxvideoai.com/v/${encodeURIComponent(video.id)}`;
  const prompt = video.prompt ?? video.promptExcerpt ?? '';
  const description = formatPrompt(prompt);
  const keywords = [video.engineLabel, video.aspectRatio ?? 'auto', 'MaxVideoAI'];

  const videoJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: `${video.engineLabel} · ${video.durationSec}s`,
    description,
    thumbnailUrl: video.thumbUrl ? [video.thumbUrl] : [],
    uploadDate: new Date(video.createdAt).toISOString(),
    duration: toDurationIso(video.durationSec),
    contentUrl: video.videoUrl ?? canonical,
    embedUrl: canonical,
    publisher: {
      '@type': 'Organization',
      name: 'MaxVideoAI',
      logo: {
        '@type': 'ImageObject',
        url: 'https://maxvideoai.com/favicon-512.png',
      },
    },
    keywords,
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <div className="mb-6 text-xs uppercase tracking-micro text-text-muted">
        <Link href="/gallery" className="hover:text-text-secondary">
          ← Back to gallery
        </Link>
      </div>
      <article className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-card border border-border bg-black" style={{ aspectRatio: '16 / 9' }}>
            {video.videoUrl ? (
              <video
                controls
                poster={video.thumbUrl}
                className="h-full w-full object-cover"
              >
                <source src={video.videoUrl} type="video/mp4" />
              </video>
            ) : video.thumbUrl ? (
              <Image
                src={video.thumbUrl}
                alt={description}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 640px, 100vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white text-sm text-text-muted">
                Preview unavailable
              </div>
            )}
          </div>
          <div className="rounded-card border border-border bg-white p-6 shadow-card">
            <h1 className="text-2xl font-semibold text-text-primary">{video.engineLabel}</h1>
            <p className="mt-2 text-sm text-text-secondary">{description}</p>
            <dl className="mt-4 grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-micro text-text-muted">Duration</dt>
                <dd>{video.durationSec} seconds</dd>
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
                <dt className="text-xs uppercase tracking-micro text-text-muted">Indexable</dt>
                <dd>{video.indexable ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </div>
        </section>
        <aside className="space-y-4">
          <div className="rounded-card border border-border bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-text-primary">Prompt</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">{prompt}</p>
            <Link
              href={`/generate?from=${encodeURIComponent(video.id)}`}
              className="mt-4 inline-flex items-center rounded-pill border border-hairline px-4 py-2 text-xs font-semibold uppercase tracking-micro text-text-primary transition hover:border-accent hover:text-accent"
            >
              Remix in workspace →
            </Link>
          </div>
          <div className="rounded-card border border-border bg-white p-5 shadow-card text-sm text-text-secondary">
            <h3 className="text-sm font-semibold text-text-primary">Details</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <span className="text-xs uppercase tracking-micro text-text-muted">Engine</span>
                <div>{video.engineLabel}</div>
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
      <link rel="canonical" href={canonical} />
    </main>
  );
}
