import Page from '../(localized)/[locale]/(marketing)/ai-video-engines/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export { metadata } from '../(localized)/[locale]/(marketing)/ai-video-engines/page';

export default function AiVideoEnginesDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <Page />
    </LocaleLayout>
  );
}
