import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

type LocalizedVideoPageProps = {
  params: { videoId: string };
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maxvideoai.com').replace(/\/$/, '');

export async function generateMetadata({ params }: LocalizedVideoPageProps): Promise<Metadata> {
  const canonical = `${SITE}/video/${encodeURIComponent(params.videoId)}`;
  return {
    title: 'Redirecting…',
    alternates: { canonical },
    robots: { index: false, follow: true },
  };
}

export default function LocalizedVideoRedirect({ params }: LocalizedVideoPageProps) {
  redirect(`/video/${encodeURIComponent(params.videoId)}`);
}
