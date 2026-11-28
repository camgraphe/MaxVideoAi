import GlamaIntegrationPage, { generateMetadata as generateLocalizedMetadata } from '../../(localized)/[locale]/(marketing)/integrations/glama/page';
import DefaultMarketingLayout from '../../default-marketing-layout';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';

export const revalidate = 3600;
export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function GlamaIntegrationDefaultPage() {
  return <DefaultMarketingLayout><GlamaIntegrationPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} /></DefaultMarketingLayout>;
}
