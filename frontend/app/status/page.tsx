import StatusPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/status/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });

export default function StatusDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <StatusPage />
    </LocaleLayout>
  );
}
