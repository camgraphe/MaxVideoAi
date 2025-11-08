import DocsIndexPage from '../(localized)/[locale]/(marketing)/docs/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
export { generateMetadata } from '../(localized)/[locale]/(marketing)/docs/page';

export default function DocsDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <DocsIndexPage />
    </LocaleLayout>
  );
}
