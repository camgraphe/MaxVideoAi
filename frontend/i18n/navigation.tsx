import NextLink, { type LinkProps as NextLinkProps } from 'next/link';
import type { ReactElement } from 'react';
import { createNavigation } from 'next-intl/navigation';
import { routing } from '@/i18n/routing';

const BYPASS_PREFIXES = ['/app', '/dashboard', '/jobs', '/billing', '/settings', '/generate', '/login'];

const { Link: LocalizedLink, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

function extractHref(href: NextLinkProps['href']): string | null {
  if (typeof href === 'string') {
    return href;
  }
  if ('pathname' in href && href.pathname) {
    return href.pathname.toString();
  }
  return null;
}

function shouldBypassLocalization(href: NextLinkProps['href']): boolean {
  const value = extractHref(href);
  if (!value) {
    return false;
  }
  return BYPASS_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function Link(props: NextLinkProps): ReactElement {
  if (shouldBypassLocalization(props.href)) {
    return <NextLink {...props} />;
  }
  return <LocalizedLink {...props} />;
}

export { redirect, usePathname, useRouter, getPathname };
