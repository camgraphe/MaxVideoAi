import ContactPage, { generateMetadata } from '../(localized)/[locale]/(marketing)/contact/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export { generateMetadata };

export default function ContactDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <ContactPage params={{ locale: DEFAULT_LOCALE }} />
    </LocaleLayout>
  );
}
