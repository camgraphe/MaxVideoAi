import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { getVideoWatchPageDataById } from '@/server/video-seo';
import { buildExpectedVideoCanonicalUrl, getVideoCanonicalRedirectPath } from '@/lib/video-seo-canonical';
import { VideoUnavailableState } from './_components/VideoUnavailableState';
import { VideoWatchContent } from './_components/VideoWatchContent';
import {
  FALLBACK_THUMB,
  TITLE_SUFFIX,
  buildMetaTitle,
  isRenderable,
  parseAspectRatio,
  toAbsoluteUrl,
} from './_lib/video-watch-page-utils';

type PageProps = {
  params: Promise<{ id: string }>;
};

const getWatchPageData = cache(async (id: string) => getVideoWatchPageDataById(id));

export const revalidate = 1800;

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const page = await getWatchPageData(params.id);
  const canonical = page?.isEligible ? page.signals.canonicalUrl : buildExpectedVideoCanonicalUrl(page?.video.id ?? params.id);

  if (!isRenderable(page)) {
    return {
      title: { absolute: `Video unavailable${TITLE_SUFFIX}` },
      description: 'This video is no longer available on MaxVideoAI.',
      robots: { index: false, follow: true },
      alternates: { canonical },
    };
  }

  const { video, signals, isEligible } = page;
  const metaTitle = buildMetaTitle(signals.metaTitle);
  const description = signals.metaDescription;
  const thumbnail = toAbsoluteUrl(video.thumbUrl) ?? FALLBACK_THUMB;
  const videoUrl = toAbsoluteUrl(video.videoUrl) ?? canonical;
  const aspect = parseAspectRatio(signals.aspectRatio ?? video.aspectRatio);
  const width = aspect ? Math.round((aspect.width / aspect.height) * 720) : 1280;
  const height = 720;

  return {
    title: { absolute: metaTitle },
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

export default async function VideoPage(props: PageProps) {
  const params = await props.params;
  const page = await getWatchPageData(params.id);
  if (!page) notFound();

  const backHref = page.signals.parentPath ?? page.signals.modelPath ?? '/examples';
  const redirectPath = getVideoCanonicalRedirectPath({
    requestedIdentifier: params.id,
    videoId: page.video.id,
    canonicalSlug: page.signals.canonicalSlug,
    isEligible: page.isEligible,
  });
  if (redirectPath) {
    permanentRedirect(redirectPath);
  }

  if (!isRenderable(page)) {
    return <VideoUnavailableState backHref={backHref} />;
  }

  return <VideoWatchContent page={page} />;
}
