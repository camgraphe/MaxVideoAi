import CalculatorPage, { metadata as localizedMetadata } from '../(localized)/[locale]/(marketing)/pricing-calculator/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const metadata = localizedMetadata;

export default function PricingCalculatorDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <CalculatorPage />
    </LocaleLayout>
  );
}
