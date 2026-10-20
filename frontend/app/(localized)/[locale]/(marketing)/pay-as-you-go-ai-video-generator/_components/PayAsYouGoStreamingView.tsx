import { Suspense } from 'react';
import type { PayAsYouGoContent } from '../_content/types';
import type { PayAsYouGoHeroData, PayAsYouGoPageData } from '../_lib/payg-page-data';
import { resolvePayAsYouGoRead, type PayAsYouGoReadResult } from '../_lib/payg-read-result';
import type { PayAsYouGoShowcaseVideo } from '../_lib/payg-video-showcase';
import { PayAsYouGoHeroSection } from './PayAsYouGoHeroSections';
import { PayAsYouGoHeroQuoteCard, PayAsYouGoHeroQuotePending } from './PayAsYouGoHeroQuoteCard';
import { PayAsYouGoPageSections } from './PayAsYouGoPageView';
import { PayAsYouGoAnchorRestore } from './PayAsYouGoAnchorRestore.client';

type CurrentData = Promise<PayAsYouGoReadResult<PayAsYouGoPageData>>;
type Props = {
  hero: PayAsYouGoHeroData;
  data: CurrentData;
  showcaseCopy: PayAsYouGoContent['showcase']['section'];
  showcaseVideos: Promise<PayAsYouGoReadResult<PayAsYouGoShowcaseVideo[]>>;
};

const DETAILS_ANCHORS = ['compare-price-per-model'];

async function CurrentHeroQuote({ data }: { data: CurrentData }) {
  return <PayAsYouGoHeroQuoteCard data={await resolvePayAsYouGoRead(data)} />;
}

async function CurrentPageSections({ data, showcaseCopy, showcaseVideos }: Omit<Props, 'hero'>) {
  const [currentData, videos] = await Promise.all([
    resolvePayAsYouGoRead(data), resolvePayAsYouGoRead(showcaseVideos),
  ]);
  return <PayAsYouGoPageSections data={currentData} showcaseCopy={showcaseCopy} showcaseVideos={videos} />;
}

export function PayAsYouGoStreamingView({ hero, data, showcaseCopy, showcaseVideos }: Props) {
  return (
    <div className="bg-bg">
      <PayAsYouGoAnchorRestore anchorIds={DETAILS_ANCHORS} />
      <PayAsYouGoHeroSection data={hero} quoteCard={
        <Suspense fallback={<PayAsYouGoHeroQuotePending data={hero} />}>
          <CurrentHeroQuote data={data} />
        </Suspense>
      } />
      <Suspense fallback={<div className="min-h-screen" aria-hidden="true" />}>
        <CurrentPageSections data={data} showcaseCopy={showcaseCopy} showcaseVideos={showcaseVideos} />
      </Suspense>
    </div>
  );
}
