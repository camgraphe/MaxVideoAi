import OpenClawIntegrationPage, { generateMetadata as generateLocalizedMetadata } from '../../(localized)/[locale]/(marketing)/integrations/openclaw/page';
import DefaultMarketingLayout from '../../default-marketing-layout';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';

export const revalidate = 3600;
export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function OpenClawIntegrationDefaultPage() {
  return <DefaultMarketingLayout><OpenClawIntegrationPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} /></DefaultMarketingLayout>;
}
