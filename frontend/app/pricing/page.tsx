import PricingPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/pricing/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const revalidate = 60 * 10;

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function PricingDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <PricingPage params={{ locale: DEFAULT_LOCALE }} />
    </DefaultMarketingLayout>
  );
}
