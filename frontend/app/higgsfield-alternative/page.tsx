import HiggsfieldAlternativePage, { generateMetadata as localizedMetadata } from '../(localized)/[locale]/(marketing)/higgsfield-alternative/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
export const revalidate = 86400;
export const generateMetadata = () => localizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });
export default function HiggsfieldAlternativeDefaultPage() {
  return <DefaultMarketingLayout><HiggsfieldAlternativePage params={Promise.resolve({ locale: DEFAULT_LOCALE })} /></DefaultMarketingLayout>;
}
