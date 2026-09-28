import Link from 'next/link';
import { ExampleReaderContent } from '@/components/examples/ExampleReaderContent';
import { readerCopy } from '@/components/examples/example-reader-copy';
import styles from '@/components/examples/example-reader.module.css';
import { buildExampleWatchDetail } from '@/server/example-watch-detail-loader';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { FALLBACK_POSTER, FALLBACK_THUMB, SITE, serializeJsonLd, toAbsoluteUrl, toDurationIso, type WatchPageData } from '../_lib/video-watch-page-utils';
import { VideoWatchRelatedExamples } from './VideoWatchRelatedExamples';
import { VideoUnavailableState } from './VideoUnavailableState';
import { VideoWatchPosterPreload } from './VideoWatchPosterPreload.client';

export async function VideoWatchContent({ page }: { page: WatchPageData }) {
  const { video, signals, related, isEligible } = page;
  const canonical = signals.canonicalUrl;
  const videoUrl = toAbsoluteUrl(video.videoUrl) ?? video.videoUrl ?? canonical;
  const thumbnailUrl = toAbsoluteUrl(video.thumbUrl) ?? FALLBACK_THUMB;
  const playbackPoster = buildOptimizedPosterUrl(video.thumbUrl ?? FALLBACK_POSTER, { width: 1200, quality: 72 }) ?? video.thumbUrl ?? FALLBACK_POSTER;
  const detail = await buildExampleWatchDetail(video, signals);
  if (!detail) return <VideoUnavailableState backHref={signals.parentPath ?? '/examples'}/>;
  const videoJsonLd = isEligible
    ? {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        url: canonical,
        mainEntityOfPage: canonical,
        name: signals.videoObjectName,
        description: signals.metaDescription,
        thumbnailUrl: [thumbnailUrl],
        uploadDate: new Date(page.entry?.publishedAt ?? video.createdAt).toISOString(),
        duration: toDurationIso(signals.durationSec ?? video.durationSec),
        contentUrl: videoUrl,
        publisher: {
          '@type': 'Organization',
          name: 'MaxVideoAI',
          url: SITE,
          logo: {
            '@type': 'ImageObject',
            url: `${SITE}/favicon-512.png`,
          },
        },
      }
    : null;

  const breadcrumbJsonLd = isEligible
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: signals.breadcrumbs.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.label,
          ...(item.href ? { item: `${SITE}${item.href === '/' ? '' : item.href}` } : {}),
        })),
      }
    : null;


  return <div className="mx-auto w-full max-w-[1440px] px-0 pb-16 pt-4 sm:px-6">
    <VideoWatchPosterPreload poster={playbackPoster} />
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 px-5 text-xs text-text-secondary sm:px-0">
      {signals.breadcrumbs.map((crumb,index) => <span key={`${crumb.label}-${index}`}>
        {index > 0 && <span aria-hidden className="mr-2">›</span>}
        {crumb.href ? <Link href={crumb.href} prefetch={false}>{crumb.label}</Link> : <span>{crumb.label}</span>}
      </span>)}
    </nav>
    <article className={`${styles.dialog} ${styles.standalone}`}>
      <ExampleReaderContent detail={{...detail,posterUrl:playbackPoster}} copy={readerCopy('en')} locale="en" headingLevel="h1"/>
    </article>
    {related.length > 0 && <div className="mt-8 px-5 sm:px-0"><VideoWatchRelatedExamples related={related}/></div>}
    {videoJsonLd && <script id={`video-jsonld-${video.id}`} type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd(videoJsonLd)}}/>}
    {breadcrumbJsonLd && <script id={`video-breadcrumb-jsonld-${video.id}`} type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd(breadcrumbJsonLd)}}/>}
  </div>;
}
