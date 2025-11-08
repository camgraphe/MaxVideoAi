import CalculatorPage from '../(localized)/[locale]/(marketing)/pricing-calculator/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
export { metadata } from '../(localized)/[locale]/(marketing)/pricing-calculator/page';

export default function PricingCalculatorDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <CalculatorPage />
    </LocaleLayout>
  );
}
