import StatusPage, { generateMetadata } from '../(localized)/[locale]/(marketing)/status/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export { generateMetadata };

export default function StatusDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <StatusPage />
    </LocaleLayout>
  );
}
