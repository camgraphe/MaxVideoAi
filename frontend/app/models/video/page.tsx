import ModelsCatalogPage, { generateModelsMetadata as generateLocalizedMetadata } from '../../(localized)/[locale]/(marketing)/models/ModelsCatalogPage';
import LocaleLayout from '../../(localized)/[locale]/layout';
import MarketingLayout from '../../(localized)/[locale]/(marketing)/layout';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE }, scope: 'video' });

export default function VideoModelsDefaultPage() {
  return (
    <LocaleLayout params={Promise.resolve({ locale: DEFAULT_LOCALE })}>
      <MarketingLayout>
        <ModelsCatalogPage scope="video" />
      </MarketingLayout>
    </LocaleLayout>
  );
}
