import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import MarketingLayout from './(localized)/[locale]/(marketing)/layout';
import { DEFAULT_LOCALE } from './default-locale-wrapper';
import { LocaleRuntime } from './_components/LocaleRuntime';
import {
  MARKETING_CLIENT_MESSAGE_NAMESPACES,
  type ClientMessageNamespace,
} from '@/lib/i18n/client-message-namespaces';

type DefaultMarketingLayoutProps = {
  children: ReactNode;
  clientMessageNamespaces?: readonly ClientMessageNamespace[];
};

export default function DefaultMarketingLayout({ children, clientMessageNamespaces }: DefaultMarketingLayoutProps) {
  setRequestLocale(DEFAULT_LOCALE);

  if (clientMessageNamespaces) {
    return (
      <LocaleRuntime locale={DEFAULT_LOCALE} clientMessageNamespaces={clientMessageNamespaces}>
        <MarketingLayout>{children}</MarketingLayout>
      </LocaleRuntime>
    );
  }

  return (
    <LocaleRuntime locale={DEFAULT_LOCALE} clientMessageNamespaces={MARKETING_CLIENT_MESSAGE_NAMESPACES}>
      <MarketingLayout>{children}</MarketingLayout>
    </LocaleRuntime>
  );
}
