import CalculatorPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../(localized)/[locale]/(marketing)/pricing-calculator/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function PricingCalculatorDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <CalculatorPage />
    </LocaleLayout>
  );
}
