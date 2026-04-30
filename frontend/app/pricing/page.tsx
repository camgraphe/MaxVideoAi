import PricingPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/pricing/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const revalidate = 600;

export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function PricingDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <PricingPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} />
    </DefaultMarketingLayout>
  );
}
