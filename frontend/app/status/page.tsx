<<<<<<< HEAD
import StatusPage, { metadata as localizedMetadata } from '../(localized)/[locale]/(marketing)/status/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const metadata = localizedMetadata;
=======
import StatusPage from '../(localized)/[locale]/(marketing)/status/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
export { metadata } from '../(localized)/[locale]/(marketing)/status/page';
>>>>>>> parent of 34c79f0 (fix(i18n): restore metadata generation for default pages)

export default function StatusDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <StatusPage />
    </LocaleLayout>
  );
}
