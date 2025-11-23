import NextLink, { type LinkProps as NextLinkProps } from 'next/link';
import type { PropsWithChildren, ReactElement, ReactNode, ComponentType, ComponentProps } from 'react';
import { createNavigation } from 'next-intl/navigation';
import { routing } from '@/i18n/routing';

const BYPASS_PREFIXES = ['/app', '/dashboard', '/jobs', '/billing', '/settings', '/generate', '/login', '/legal'];
const EXTERNAL_HREF_PATTERN = /^(?:[a-z][a-z0-9+\-.]*:|\/\/)/i;

const { Link: LocalizedLink, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

export type LocalizedLinkHref =
  | NextLinkProps['href']
  | {
      pathname: string;
      params?: Record<string, string | number>;
      query?: Record<string, string | number | undefined>;
    };

type LocalizedLinkProps = PropsWithChildren<
  Omit<NextLinkProps, 'href' | 'hrefLang'> & {
    href: LocalizedLinkHref;
    className?: string;
    rel?: string;
    hrefLang?: string | null | false;
  }
>;

function extractHref(href: LocalizedLinkHref): string | null {
  if (typeof href === 'string') {
    return href;
  }
  if ('pathname' in href && href.pathname) {
    return href.pathname.toString();
  }
  return null;
}

function shouldBypassLocalization(href: LocalizedLinkHref): boolean {
  const value = extractHref(href);
  if (!value) {
    return false;
  }
  if (EXTERNAL_HREF_PATTERN.test(value)) {
    return true;
  }
  return BYPASS_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function Link({ children, className, rel, hrefLang, ...rest }: LocalizedLinkProps): ReactElement {
  const normalizedHrefLang =
    typeof hrefLang === 'string' && hrefLang.trim().length ? hrefLang : undefined;

  if (shouldBypassLocalization(rest.href)) {
    return (
      <NextLink
        {...(rest as unknown as NextLinkProps)}
        className={className}
        rel={rel}
        hrefLang={normalizedHrefLang}
      >
        {children}
      </NextLink>
    );
  }

  const Localized = LocalizedLink as unknown as ComponentType<
    ComponentProps<typeof LocalizedLink> & { className?: string; rel?: string }
  >;

  return (
    <Localized
      {...(rest as unknown as ComponentProps<typeof LocalizedLink>)}
      className={className}
      rel={rel}
      hrefLang={normalizedHrefLang}
    >
      {children}
    </Localized>
  );
}

export { redirect, usePathname, useRouter, getPathname };
