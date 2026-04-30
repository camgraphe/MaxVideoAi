import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SITE_ORIGIN } from '@/lib/siteOrigin';

type LegacyVideoPageProps = {
  params: Promise<{ videoId: string }>;
};

const SITE = SITE_ORIGIN.replace(/\/$/, '');

export async function generateMetadata(props: LegacyVideoPageProps): Promise<Metadata> {
  const params = await props.params;
  const canonical = `${SITE}/video/${encodeURIComponent(params.videoId)}`;
  return {
    title: 'Redirecting…',
    alternates: { canonical },
    robots: { index: false, follow: true },
  };
}

export default async function LegacyVideoPage(props: LegacyVideoPageProps) {
  const params = await props.params;
  redirect(`/video/${encodeURIComponent(params.videoId)}`);
}
