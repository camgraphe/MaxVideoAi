import BlogIndexPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/blog/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function BlogDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <BlogIndexPage />
    </LocaleLayout>
  );
}
