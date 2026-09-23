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
    title: 'Shared video · MaxVideoAI',
    description: 'A video shared by a MaxVideoAI creator.',
    referrer: 'no-referrer',
    robots: { index: false, follow: false },
    openGraph: {
      type: 'video.other',
      title: 'Shared video · MaxVideoAI',
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
  return <main className="shared-video-page">
    <div className="shared-video-page-inner">
      <Link className="shared-video-brand" href="/" aria-label="MaxVideoAI home">MaxVideoAI</Link>
      <video controls playsInline preload="none" poster={video.thumbUrl ?? undefined} src={video.url} />
      <div className="shared-video-footer">
        <p>Video created with MaxVideoAI</p>
        <Link href="/app">Create your own video</Link>
      </div>
    </div>
  </main>;
}
