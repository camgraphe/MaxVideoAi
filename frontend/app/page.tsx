import type { Metadata } from 'next';
import LocaleLayout from './(localized)/[locale]/layout';
import HomePage, { generateMetadata as generateLocalizedMetadata } from './(localized)/[locale]/(marketing)/page';
import type { AppLocale } from '@/i18n/locales';
import { defaultLocale } from '@/i18n/locales';

const DEFAULT_LOCALE = defaultLocale as AppLocale;

export async function generateMetadata(): Promise<Metadata> {
  return generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE } });
}

export default function RootPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <HomePage />
    </LocaleLayout>
  );
}
