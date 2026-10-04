import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
import { getSharedVideo } from '@/server/video-shares';
import './share-video.css';

type PageProps = { params: Promise<{ token: string }> };
const readVideo = cache(async (token: string) => getSharedVideo(token));

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const video = await readVideo(token);
  if (!video) return { title: 'Video unavailable', robots: { index: false, follow: false } };
  const pageUrl = new URL(`/s/${token}`, SITE_ORIGIN).toString();
  const image = video.thumbUrl ? new URL(video.thumbUrl, SITE_ORIGIN).toString() : undefined;
  return {
    title: { absolute: 'Video shared with you | MaxVideoAI' },
    description: 'A video shared by a MaxVideoAI creator.',
    referrer: 'no-referrer',
    robots: { index: false, follow: false },
    openGraph: {
      type: 'video.other',
      title: 'Video shared with you | MaxVideoAI',
      description: 'A video shared by a MaxVideoAI creator.',
      url: pageUrl,
      images: image ? [image] : undefined,
      videos: [{ url: new URL(video.url, SITE_ORIGIN).toString(), type: 'video/mp4' }],
    },
    twitter: { card: 'summary_large_image', images: image ? [image] : undefined },
  };
}

export default async function SharedVideoPage({ params }: PageProps) {
  const { token } = await params;
  const video = await readVideo(token);
  if (!video) notFound();
  return <div className="shared-video-page">
    <nav className="shared-video-breadcrumb" aria-label="Breadcrumb">
      <Link href="/">Home</Link><span aria-hidden>›</span><span>Shared video</span>
    </nav>
    <div className="shared-video-grid">
      <article className="shared-video-card">
        <video controls playsInline preload="none" poster={video.thumbUrl ?? undefined} src={video.url} aria-label="Shared MaxVideoAI video" />
        <div className="shared-video-details">
          <p className="shared-video-eyebrow">Created with MaxVideoAI</p>
          <h1>Video shared with you</h1>
          <p>Watch this video shared by a MaxVideoAI creator.</p>
        </div>
      </article>
      <aside className="shared-video-aside">
        <h2>Create your own video</h2>
        <p>Explore AI video models and make something of your own on MaxVideoAI.</p>
        <Link className="shared-video-primary-link" href="/app">Start creating</Link>
        <Link className="shared-video-secondary-link" href="/examples">Explore video examples</Link>
      </aside>
    </div>
  </div>;
}
