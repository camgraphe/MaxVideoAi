import AboutPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/about/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function AboutDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <AboutPage params={{ locale: DEFAULT_LOCALE }} />
    </DefaultMarketingLayout>
  );
}
