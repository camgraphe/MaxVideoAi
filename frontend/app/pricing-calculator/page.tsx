<<<<<<< HEAD
import CalculatorPage, { metadata as localizedMetadata } from '../(localized)/[locale]/(marketing)/pricing-calculator/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const metadata = localizedMetadata;
=======
import CalculatorPage from '../(localized)/[locale]/(marketing)/pricing-calculator/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
export { metadata } from '../(localized)/[locale]/(marketing)/pricing-calculator/page';
>>>>>>> parent of 34c79f0 (fix(i18n): restore metadata generation for default pages)

export default function PricingCalculatorDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <CalculatorPage />
    </LocaleLayout>
  );
}
