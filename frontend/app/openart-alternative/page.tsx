import OpenArtAlternativePage, { generateMetadata as localizedMetadata } from '../(localized)/[locale]/(marketing)/openart-alternative/page';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
import DefaultMarketingLayout from '../default-marketing-layout';

export const revalidate = 86400;
export const generateMetadata = () => localizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function OpenArtAlternativeDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <OpenArtAlternativePage params={Promise.resolve({ locale: DEFAULT_LOCALE })} />
    </DefaultMarketingLayout>
  );
}
