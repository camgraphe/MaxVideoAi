import { PayAsYouGoContents } from './PayAsYouGoContents';
import { PayAsYouGoReadingNotes } from './PayAsYouGoSectionPrimitives';
import { PAYG_FILM_PROGRAMME } from '../_lib/payg-film-programme';
import type { PayAsYouGoContent } from '../_content/types';
import type { PayAsYouGoPageData } from '../_lib/payg-page-data';
import type { PayAsYouGoShowcaseVideo } from '../_lib/payg-video-showcase';
import {
  PayAsYouGoModelTestingOrderSection,
  PayAsYouGoHeroSection,
  PayAsYouGoNaturalQuestionsSection,
} from './PayAsYouGoHeroSections';
import {
  PayAsYouGoAudienceFitSection,
  PayAsYouGoMcpPlanningSection,
  PayAsYouGoMeaningSection,
  PayAsYouGoQuoteFactorsSection,
  PayAsYouGoSubscriptionComparisonSection,
  PayAsYouGoWorkflowSection,
} from './PayAsYouGoGuideSections';
import {
  PayAsYouGoExampleCostsSection,
  PayAsYouGoPriceLookupShortcutsSection,
  PayAsYouGoPricePerModelSection,
} from './PayAsYouGoPricingSections';
import { PayAsYouGoFaqSection, PayAsYouGoRefundPolicySection } from './PayAsYouGoTrustSections';
import { PayAsYouGoVideoShowcase } from './PayAsYouGoVideoShowcase';
import { PayAsYouGoHeroQuoteCard } from './PayAsYouGoHeroQuoteCard';

export type PayAsYouGoPageViewProps = {
  data: PayAsYouGoPageData;
  showcaseCopy: PayAsYouGoContent['showcase']['section'];
  showcaseVideos: PayAsYouGoShowcaseVideo[];
};

export function PayAsYouGoPageView({ data, showcaseCopy, showcaseVideos }: PayAsYouGoPageViewProps) {
  return (
    <div className="bg-bg">
      <PayAsYouGoHeroSection data={data} quoteCard={<PayAsYouGoHeroQuoteCard data={data} />} />
      <PayAsYouGoPageSections data={data} showcaseCopy={showcaseCopy} showcaseVideos={showcaseVideos} />
    </div>
  );
}

export function PayAsYouGoPageSections({ data, showcaseCopy, showcaseVideos }: PayAsYouGoPageViewProps) {
  const productFilm = PAYG_FILM_PROGRAMME.find(film => film.model === 'minimax-h3');
  const productExample = showcaseVideos.find(video => video.engineId === productFilm?.model && productFilm.prints.some(print => print.id === video.id));
  return (
    <>
      <PayAsYouGoContents chapters={data.common.chapters} hasFilms={showcaseVideos.length > 0} />
      <PayAsYouGoWorkflowSection data={data} />
      <PayAsYouGoVideoShowcase videos={showcaseVideos} copy={showcaseCopy} />
      <PayAsYouGoNaturalQuestionsSection data={data} />
      <PayAsYouGoModelTestingOrderSection data={data} videos={showcaseVideos} />
      <PayAsYouGoMeaningSection data={data} example={productExample} />
      <PayAsYouGoReadingNotes label={data.meaning.compare}>
        <PayAsYouGoAudienceFitSection data={data} />
        <PayAsYouGoSubscriptionComparisonSection data={data} />
      </PayAsYouGoReadingNotes>
      <PayAsYouGoMcpPlanningSection data={data} />
      <PayAsYouGoQuoteFactorsSection data={data} />
      <PayAsYouGoPricePerModelSection data={data} />
      <PayAsYouGoPriceLookupShortcutsSection data={data} />
      <PayAsYouGoExampleCostsSection data={data} />
      <PayAsYouGoRefundPolicySection data={data} />
      <PayAsYouGoFaqSection data={data} />
    </>
  );
}
