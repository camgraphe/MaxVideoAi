import AboutPage, { generateMetadata } from '../(localized)/[locale]/(marketing)/about/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export { generateMetadata };

export default function AboutDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <AboutPage />
    </LocaleLayout>
  );
}
