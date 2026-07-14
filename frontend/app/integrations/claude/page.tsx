import ClaudeIntegrationPage, { generateMetadata as generateLocalizedMetadata } from '../../(localized)/[locale]/(marketing)/integrations/claude/page';
import DefaultMarketingLayout from '../../default-marketing-layout';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';

export const revalidate = 3600;
export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function ClaudeIntegrationDefaultPage() {
  return <DefaultMarketingLayout><ClaudeIntegrationPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} /></DefaultMarketingLayout>;
}
