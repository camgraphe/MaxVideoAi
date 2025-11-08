<<<<<<< HEAD
import AboutPage, { metadata as localizedMetadata } from '../(localized)/[locale]/(marketing)/about/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const metadata = localizedMetadata;
=======
import AboutPage from '../(localized)/[locale]/(marketing)/about/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
export { metadata } from '../(localized)/[locale]/(marketing)/about/page';
>>>>>>> parent of 34c79f0 (fix(i18n): restore metadata generation for default pages)

export default function AboutDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <AboutPage />
    </LocaleLayout>
  );
}
