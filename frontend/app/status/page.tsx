import StatusPage from '../(localized)/[locale]/(marketing)/status/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
export { metadata } from '../(localized)/[locale]/(marketing)/status/page';

export default function StatusDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <StatusPage />
    </LocaleLayout>
  );
}
