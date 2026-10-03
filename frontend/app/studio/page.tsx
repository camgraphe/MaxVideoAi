import StudioPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/studio/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const revalidate = 3600;
export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function StudioDefaultPage() {
  return <DefaultMarketingLayout><StudioPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} /></DefaultMarketingLayout>;
}
