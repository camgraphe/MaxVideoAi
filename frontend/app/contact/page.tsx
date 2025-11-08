import ContactPage, { metadata as localizedMetadata } from '../(localized)/[locale]/(marketing)/contact/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const metadata = localizedMetadata;

export default function ContactDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <ContactPage />
    </LocaleLayout>
  );
}
