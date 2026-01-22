import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { listExamplesPage } from '@/server/videos';

const DEFAULT_SORT = 'playlist';

export default async function Head() {
  const pageResult = await listExamplesPage({ sort: DEFAULT_SORT, limit: 1, offset: 0 });
  const first = pageResult.items[0];
  const lcpPosterSrc = first?.thumbUrl ? buildOptimizedPosterUrl(first.thumbUrl) : null;

  return (
    <>
      <link rel="preconnect" href="https://videohub-uploads-us.s3.amazonaws.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://v3b.fal.media" crossOrigin="anonymous" />
      {lcpPosterSrc ? <link rel="preload" as="image" href={lcpPosterSrc} fetchPriority="high" /> : null}
    </>
  );
}
