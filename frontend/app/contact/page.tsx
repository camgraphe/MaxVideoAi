<<<<<<< HEAD
import ContactPage, { metadata as localizedMetadata } from '../(localized)/[locale]/(marketing)/contact/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const metadata = localizedMetadata;
=======
import ContactPage from '../(localized)/[locale]/(marketing)/contact/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
export { metadata } from '../(localized)/[locale]/(marketing)/contact/page';
>>>>>>> parent of 34c79f0 (fix(i18n): restore metadata generation for default pages)

export default function ContactDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <ContactPage />
    </LocaleLayout>
  );
}
