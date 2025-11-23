import ModelsPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/models/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import MarketingLayout from '../(localized)/[locale]/(marketing)/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function ModelsDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <MarketingLayout>
        <ModelsPage />
      </MarketingLayout>
    </LocaleLayout>
  );
}
