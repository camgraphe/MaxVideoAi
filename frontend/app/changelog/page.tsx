<<<<<<< HEAD
import ChangelogPage, { metadata as localizedMetadata } from '../(localized)/[locale]/(marketing)/changelog/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const metadata = localizedMetadata;
=======
import ChangelogPage from '../(localized)/[locale]/(marketing)/changelog/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
export { metadata } from '../(localized)/[locale]/(marketing)/changelog/page';
>>>>>>> parent of 34c79f0 (fix(i18n): restore metadata generation for default pages)

export default function ChangelogDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <ChangelogPage />
    </LocaleLayout>
  );
}
