import Page, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/ai-video-engines/page';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function AiVideoEnginesDefaultPage() {
  return <Page />;
}
