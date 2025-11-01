import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

type LegacyVideoPageProps = {
  params: { videoId: string };
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maxvideoai.com').replace(/\/$/, '');

export async function generateMetadata({ params }: LegacyVideoPageProps): Promise<Metadata> {
  const canonical = `${SITE}/video/${encodeURIComponent(params.videoId)}`;
  return {
    title: 'Redirecting…',
    alternates: { canonical },
    robots: { index: false, follow: true },
  };
}

export default function LegacyVideoPage({ params }: LegacyVideoPageProps) {
  redirect(`/video/${encodeURIComponent(params.videoId)}`);
}
