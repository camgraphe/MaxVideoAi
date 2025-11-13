import Page, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/ai-video-engines/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function AiVideoEnginesDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <Page />
    </LocaleLayout>
  );
}
