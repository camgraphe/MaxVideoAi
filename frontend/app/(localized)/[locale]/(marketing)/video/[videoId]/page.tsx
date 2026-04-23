import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SITE_ORIGIN } from '@/lib/siteOrigin';

type LocalizedVideoPageProps = {
  params: { videoId: string };
};

const SITE = SITE_ORIGIN.replace(/\/$/, '');

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
