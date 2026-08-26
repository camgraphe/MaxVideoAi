import ChatGptIntegrationPage, { generateMetadata as generateLocalizedMetadata } from '../../(localized)/[locale]/(marketing)/integrations/chatgpt/page';
import DefaultMarketingLayout from '../../default-marketing-layout';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';

export const revalidate = 3600;
export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function ChatGptIntegrationDefaultPage() {
  return <DefaultMarketingLayout><ChatGptIntegrationPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} /></DefaultMarketingLayout>;
}
