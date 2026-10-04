import { safeInternalReturnTarget as normalizeInternalTarget } from './auth-return-target';
import type { AppLocale } from '@/i18n/locales';

export type AuthEntryMode = 'signup' | 'signin';

type SearchParamsLike = Pick<URLSearchParams, 'toString'>;


export function buildAuthReturnTarget(
  pathname: string | null | undefined,
  searchParams?: SearchParamsLike | string | null
): string {
  const safePathname = normalizeInternalTarget(pathname);
  const rawSearch = typeof searchParams === 'string' ? searchParams : searchParams?.toString() ?? '';
  const normalizedSearch = rawSearch.replace(/^\?+/, '').trim();
  return normalizedSearch ? `${safePathname}?${normalizedSearch}` : safePathname;
}

export function buildLoginHref({ mode, nextPath, locale }: { mode: AuthEntryMode; nextPath: string; locale?: AppLocale }): string {
  const safeNextPath = normalizeInternalTarget(nextPath);
  return `/login?mode=${mode}&next=${encodeURIComponent(safeNextPath)}${locale ? `&lang=${locale}` : ''}`;
}
