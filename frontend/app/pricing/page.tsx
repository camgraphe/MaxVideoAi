import PricingPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/pricing/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const revalidate = 60 * 10;

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function PricingDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <PricingPage params={{ locale: DEFAULT_LOCALE }} />
    </LocaleLayout>
  );
}
