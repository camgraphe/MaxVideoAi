import { getHomepageSlotsCached } from '@/server/homepage';

const DEFAULT_LCP_POSTER = '/hero/sora2.jpg';

export default async function Head() {
  const homepageSlots = await getHomepageSlotsCached();
  const lcpPosterSrc = homepageSlots.hero[0]?.video?.thumbUrl ?? DEFAULT_LCP_POSTER;

  return (
    <>
      <link rel="preconnect" href="https://media.maxvideoai.com" crossOrigin="anonymous" />
      {lcpPosterSrc ? (
        <link rel="preload" as="image" href={lcpPosterSrc} fetchPriority="high" crossOrigin="anonymous" />
      ) : null}
    </>
  );
}
