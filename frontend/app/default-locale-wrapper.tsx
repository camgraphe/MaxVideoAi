import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import LocaleLayout from './(localized)/[locale]/layout';
import type { AppLocale } from '@/i18n/locales';
import { defaultLocale } from '@/i18n/locales';

export const DEFAULT_LOCALE = defaultLocale as AppLocale;

type PageParams = Record<string, string | string[]>;

type PageComponent<P extends { params?: PageParams } = { params?: PageParams }> = (
  props?: P
) => Promise<ReactElement> | ReactElement;

export function withDefaultLocalePage<P extends { params?: PageParams }>(Component: PageComponent<P>) {
  return function DefaultLocalePage(props?: P) {
    const params = { ...((props?.params as PageParams) ?? {}), locale: DEFAULT_LOCALE };
    const nextProps = { ...(props ?? ({} as P)), params } as P;
    return (
      <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
        <Component {...nextProps} />
      </LocaleLayout>
    );
  };
}

export function buildDefaultLocaleMetadata<P extends PageParams = PageParams>(
  generator: (args: { params: P & { locale: AppLocale } }) => Promise<Metadata> | Metadata
) {
  return (args?: { params?: P }) =>
    generator({
      params: { ...((args?.params as P) ?? ({} as P)), locale: DEFAULT_LOCALE } as P & { locale: AppLocale },
    });
}
