import type { ReactNode } from 'react';
import LocaleLayout from '../(localized)/[locale]/layout';
import MarketingLayout from '../(localized)/[locale]/(marketing)/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export default function AiVideoEnginesDefaultLayout({ children }: { children: ReactNode }) {
  return (
    <LocaleLayout params={Promise.resolve({ locale: DEFAULT_LOCALE })}>
      <MarketingLayout>{children}</MarketingLayout>
    </LocaleLayout>
  );
}
