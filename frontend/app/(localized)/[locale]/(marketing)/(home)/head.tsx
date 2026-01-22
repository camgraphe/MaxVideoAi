import { buildNextImageProxyUrl } from '@/lib/media-helpers';
import { getHomepageSlots } from '@/server/homepage';

const DEFAULT_LCP_POSTER = '/hero/sora2.jpg';

export default async function Head() {
  const homepageSlots = await getHomepageSlots();
  const rawPosterSrc = homepageSlots.hero[0]?.video?.thumbUrl ?? DEFAULT_LCP_POSTER;
  const lcpPosterSrc = buildNextImageProxyUrl(rawPosterSrc, { width: 1200, quality: 80 }) ?? rawPosterSrc;

  return (
    <>
      <link rel="preconnect" href="https://videohub-uploads-us.s3.amazonaws.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://v3b.fal.media" crossOrigin="anonymous" />
      {lcpPosterSrc ? (
        <link rel="preload" as="image" href={lcpPosterSrc} fetchPriority="high" crossOrigin="anonymous" />
      ) : null}
    </>
  );
}
