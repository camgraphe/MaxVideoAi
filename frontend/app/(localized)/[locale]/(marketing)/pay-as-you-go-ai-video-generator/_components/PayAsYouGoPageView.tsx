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

export type PayAsYouGoPageViewProps = {
  data: PayAsYouGoPageData;
  showcaseCopy: PayAsYouGoContent['showcase']['section'];
  showcaseVideos: PayAsYouGoShowcaseVideo[];
};

export function PayAsYouGoPageView({ data, showcaseCopy, showcaseVideos }: PayAsYouGoPageViewProps) {
  return (
    <main className="bg-bg">
      <PayAsYouGoHeroSection data={data} />
      <PayAsYouGoVideoShowcase videos={showcaseVideos} copy={showcaseCopy} />
      <PayAsYouGoNaturalQuestionsSection data={data} />
      <PayAsYouGoModelTestingOrderSection data={data} />
      <PayAsYouGoMeaningSection data={data} />
      <PayAsYouGoAudienceFitSection data={data} />
      <PayAsYouGoSubscriptionComparisonSection data={data} />
      <PayAsYouGoWorkflowSection data={data} />
      <PayAsYouGoQuoteFactorsSection data={data} />
      <PayAsYouGoPricePerModelSection data={data} />
      <PayAsYouGoPriceLookupShortcutsSection data={data} />
      <PayAsYouGoExampleCostsSection data={data} />
      <PayAsYouGoRefundPolicySection data={data} />
      <PayAsYouGoFaqSection data={data} />
    </main>
  );
}
