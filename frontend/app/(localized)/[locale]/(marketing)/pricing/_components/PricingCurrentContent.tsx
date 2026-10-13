import { DeferredMarketingContent } from '@/components/marketing/DeferredMarketingContent';
import type { AppLocale } from '@/i18n/locales';
import type { PricingHubData } from '../_lib/pricingHubData';
import { PricingCreditsRefundsSection } from './PricingCreditsRefundsSection';
import { PricingOtherSurfacesSection } from './PricingOtherSurfacesSection';
import { PricingPopularChecksSection } from './PricingPopularChecksSection';
import { PricingQuickStart } from './PricingQuickStart';
import { PricingRefundsFaqSection } from './PricingRefundsFaqSection';
import { PricingVideoMatrixSection } from './PricingVideoMatrixSection';
import type { ComponentProps } from 'react';

type CurrentPricingProps = { pricingHub: Promise<PricingHubData> };

/** Both boundaries consume the same complete current hub; neither starts another quote. */
export async function PricingCurrentQuickStart({ pricingHub, title, note }: CurrentPricingProps & { title: string; note: string }) {
  const data = await pricingHub;
  return <PricingQuickStart highlights={data.video.highlights} title={title} note={note} />;
}

export async function PricingCurrentSections({
  pricingHub, locale, faq, faqEntries,
}: CurrentPricingProps & { locale: AppLocale } & ComponentProps<typeof PricingRefundsFaqSection>) {
  const data = await pricingHub;
  return (
    <>
      <DeferredMarketingContent>
        <PricingVideoMatrixSection video={data.video} locale={locale} />
      </DeferredMarketingContent>
      <DeferredMarketingContent>
        <PricingPopularChecksSection checks={data.popularChecks} locale={locale} />
      </DeferredMarketingContent>
      <DeferredMarketingContent>
        <PricingOtherSurfacesSection data={data.otherSurfaces} locale={locale} />
      </DeferredMarketingContent>
      <DeferredMarketingContent>
        <PricingCreditsRefundsSection locale={locale} />
      </DeferredMarketingContent>
      <DeferredMarketingContent>
        <PricingRefundsFaqSection faq={faq} faqEntries={faqEntries} />
      </DeferredMarketingContent>
    </>
  );
}
