import AboutPage, { metadata as localizedMetadata } from '../(localized)/[locale]/(marketing)/about/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const metadata = localizedMetadata;

export default function AboutDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <AboutPage />
    </LocaleLayout>
  );
}
