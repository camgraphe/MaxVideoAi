import ContactPage from '../(localized)/[locale]/(marketing)/contact/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
export { metadata } from '../(localized)/[locale]/(marketing)/contact/page';

export default function ContactDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <ContactPage />
    </LocaleLayout>
  );
}
