import NextLink, { type LinkProps as NextLinkProps } from 'next/link';
import type {
  PropsWithChildren,
  ReactElement,
  ReactNode,
  ComponentType,
  ComponentProps,
  AnchorHTMLAttributes,
} from 'react';
import { createNavigation } from 'next-intl/navigation';
import { routing } from '@/i18n/routing';
import { defaultLocale, localePathnames, type AppLocale } from '@/i18n/locales';
import { applyNofollowRel } from '@/lib/seo/nofollow';

const BYPASS_PREFIXES = [
  '/app',
  '/dashboard',
  '/jobs',
  '/billing',
  '/settings',
  '/generate',
  '/login',
  '/legal',
  '/return-policy',
  '/refund-policy',
  '/video',
  '/v',
];
const EXTERNAL_HREF_PATTERN = /^(?:[a-z][a-z0-9+\-.]*:|\/\/)/i;
const LOCALE_PREFIXES = Object.values(localePathnames).filter((prefix): prefix is string => Boolean(prefix && prefix.length));
const LOCALE_PREFIX_REGEX = LOCALE_PREFIXES.length ? new RegExp(`^/(${LOCALE_PREFIXES.join('|')})(/|$)`, 'i') : null;
const DEFAULT_LOCALE_SEGMENT = defaultLocale;
const SHOULD_STRIP_DEFAULT =
  (!localePathnames[defaultLocale] || localePathnames[defaultLocale] === '') && Boolean(DEFAULT_LOCALE_SEGMENT);
const DEFAULT_LOCALE_REGEX = SHOULD_STRIP_DEFAULT
  ? new RegExp(`^/${DEFAULT_LOCALE_SEGMENT}(/|$)`, 'i')
  : null;

const { Link: LocalizedLink, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

export type LocalizedLinkHref =
  | NextLinkProps['href']
  | {
      pathname: string;
      params?: Record<string, string | number>;
      query?: Record<string, string | number | undefined>;
    };

type LocalizedLinkProps = PropsWithChildren<
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'hrefLang'> &
    Omit<NextLinkProps, 'href' | 'hrefLang'> & {
    href: LocalizedLinkHref;
    currentLocale?: AppLocale;
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
  if (LOCALE_PREFIX_REGEX && LOCALE_PREFIX_REGEX.test(value)) {
    return true;
  }
  return BYPASS_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function stripDefaultLocalePrefix(pathname: string): string {
  if (!DEFAULT_LOCALE_REGEX) {
    return pathname;
  }
  if (!DEFAULT_LOCALE_REGEX.test(pathname)) {
    return pathname;
  }
  const stripped = pathname.replace(DEFAULT_LOCALE_REGEX, '/');
  return stripped === '' ? '/' : stripped;
}

function normalizeHref(href: LocalizedLinkHref): LocalizedLinkHref {
  if (typeof href === 'string') {
    return stripDefaultLocalePrefix(href);
  }
  if ('pathname' in href && typeof href.pathname === 'string') {
    return { ...href, pathname: stripDefaultLocalePrefix(href.pathname) };
  }
  return href;
}

// A page that already knows its locale can publish the final href directly to NextLink.
// Use the router's own path compiler and keep query/hash handling with NextLink.
function resolveCurrentLocaleHref(href: LocalizedLinkHref, locale: AppLocale): NextLinkProps['href'] {
  const path = extractHref(href);
  if (!path || !path.startsWith('/')) return href;
  if (typeof href === 'object' && (('host' in href && href.host) || ('hostname' in href && href.hostname))) return href;
  const params = typeof href === 'object' && 'params' in href ? href.params : undefined;
  const pathname = getPathname({ locale, href: { pathname: path, params } as Parameters<typeof getPathname>[0]['href'] });
  if (typeof href === 'string') return pathname;
  const { params: _params, ...url } = href as Exclude<LocalizedLinkHref, string> & { params?: unknown };
  return { ...url, pathname };
}

export function Link({ children, className, rel, hrefLang, currentLocale, ...rest }: LocalizedLinkProps): ReactElement {
  const normalizedHrefLang =
    typeof hrefLang === 'string' && hrefLang.trim().length ? hrefLang : undefined;
  const normalizedHref = normalizeHref(rest.href);
  const resolvedRel = applyNofollowRel(rel, normalizedHref);
  const normalizedRest = { ...rest, href: normalizedHref };

  const bypass = shouldBypassLocalization(normalizedHref);
  if (bypass || (currentLocale && normalizedRest.locale == null)) {
    const { locale: _locale, ...nextLinkRest } = normalizedRest;
    return (
      <NextLink
        {...(nextLinkRest as unknown as NextLinkProps)}
        href={currentLocale && !bypass ? resolveCurrentLocaleHref(normalizedHref, currentLocale) : normalizedHref}
        className={className}
        rel={resolvedRel}
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
      {...(normalizedRest as unknown as ComponentProps<typeof LocalizedLink>)}
      className={className}
      rel={resolvedRel}
      hrefLang={normalizedHrefLang}
    >
      {children}
    </Localized>
  );
}

export { redirect, usePathname, useRouter, getPathname };
