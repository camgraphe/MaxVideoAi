import type { Metadata } from 'next';
import LocaleLayout from '../(localized)/[locale]/layout';
import HomePage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/(home)/page';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export async function generateMetadata(): Promise<Metadata> {
  return generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });
}

export default function RootPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <HomePage params={{ locale: DEFAULT_LOCALE }} />
    </LocaleLayout>
  );
}
