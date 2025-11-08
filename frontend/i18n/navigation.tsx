import NextLink, { type LinkProps as NextLinkProps } from 'next/link';
import type { PropsWithChildren, ReactElement, ReactNode, ComponentType, ComponentProps } from 'react';
import { createNavigation } from 'next-intl/navigation';
import { routing } from '@/i18n/routing';

const BYPASS_PREFIXES = ['/app', '/dashboard', '/jobs', '/billing', '/settings', '/generate', '/login'];

const { Link: LocalizedLink, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

type LocalizedLinkHref =
  | NextLinkProps['href']
  | {
      pathname: string;
      params?: Record<string, string | number>;
      query?: Record<string, string | number | undefined>;
    };

type LocalizedLinkProps = PropsWithChildren<
  Omit<NextLinkProps, 'href'> & { href: LocalizedLinkHref; className?: string }
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
  return BYPASS_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function Link({ children, className, ...rest }: LocalizedLinkProps): ReactElement {
  if (shouldBypassLocalization(rest.href)) {
    return (
      <NextLink {...(rest as unknown as NextLinkProps)} className={className}>
        {children}
      </NextLink>
    );
  }

  const Localized = LocalizedLink as unknown as ComponentType<
    ComponentProps<typeof LocalizedLink> & { className?: string }
  >;

  return (
    <Localized {...(rest as unknown as ComponentProps<typeof LocalizedLink>)} className={className}>
      {children}
    </Localized>
  );
}

export { redirect, usePathname, useRouter, getPathname };
