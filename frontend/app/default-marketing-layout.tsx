import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import LocaleLayout from './(localized)/[locale]/layout';
import MarketingLayout from './(localized)/[locale]/(marketing)/layout';
import { DEFAULT_LOCALE } from './default-locale-wrapper';

export default function DefaultMarketingLayout({ children }: { children: ReactNode }) {
  setRequestLocale(DEFAULT_LOCALE);

  return (
    <LocaleLayout params={Promise.resolve({ locale: DEFAULT_LOCALE })}>
      <MarketingLayout>{children}</MarketingLayout>
    </LocaleLayout>
  );
}
