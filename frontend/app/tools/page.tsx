import ToolsPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/tools/page';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function ToolsDefaultPage() {
  return <ToolsPage params={{ locale: DEFAULT_LOCALE }} />;
}
