import StatusPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/status/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function StatusDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <StatusPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} />
    </DefaultMarketingLayout>
  );
}
