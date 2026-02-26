import CompanyPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/company/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function CompanyDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <CompanyPage params={{ locale: DEFAULT_LOCALE }} />
    </LocaleLayout>
  );
}
