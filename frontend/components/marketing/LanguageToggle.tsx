'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { Locale } from '@/lib/i18n/types';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import localizedSlugConfig from '@/config/localized-slugs.json';

const FLAG_MAP: Record<Locale, string> = {
  en: '🇺🇸',
  fr: '🇫🇷',
  es: '🇪🇸',
};

const LOCALE_BYPASS_PREFIXES = ['/video'];
const LOCALE_PREFIXES: Record<Locale, string> = { en: '', fr: 'fr', es: 'es' } as const;
const LOCALIZED_SEGMENT_TO_EN: Record<string, string> = Object.values(localizedSlugConfig).reduce(
  (map, value) => {
    Object.values(value).forEach((segment) => {
      if (segment) {
        map[segment] = value.en;
      }
    });
    return map;
  },
  {} as Record<string, string>
);

function shouldBypassLocale(pathname: string | null | undefined) {
  if (!pathname) return false;
  return LOCALE_BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function LanguageToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { locale, t } = useI18n();
  const defaultOptions: Array<{ locale: Locale; label: string }> = [
    { locale: 'en', label: 'English' },
    { locale: 'fr', label: 'Français' },
    { locale: 'es', label: 'Español' },
  ];
  const maybeOptions = t('footer.languages', defaultOptions);
  const options = Array.isArray(maybeOptions) && maybeOptions.length ? maybeOptions : defaultOptions;
  const label = t('footer.languageLabel', 'Language') ?? 'Language';
  const [pendingLocale, setPendingLocale] = useState<Locale>(locale);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPendingLocale(locale);
  }, [locale]);

  const handleChange = (value: Locale) => {
    setPendingLocale(value);
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    startTransition(() => {
      const slugParam = params?.slug;
      let slugValue = Array.isArray(slugParam) ? slugParam[0] : slugParam;
      if (!slugValue && typeof pathname === 'string') {
        const m = pathname.match(/^\/(?:en|fr|es)?\/(?:models|modeles|modelos)\/([^\/?#]+)/i);
        if (m && m[1]) slugValue = m[1];
      }
      if (slugValue) {
        router.replace({ pathname: '/models/[slug]', params: { slug: slugValue } }, { locale: value });
        return;
      }
      const targetPath = pathname && pathname.length ? pathname : '/';
      if (shouldBypassLocale(pathname)) {
        router.refresh();
        return;
      }
      if (value === 'en') {
        const englishPath = resolveEnglishPath(targetPath, locale as Locale);
        router.replace(englishPath as never, { locale: value });
        return;
      }
      router.replace(targetPath as never, { locale: value });
    });
  };

function resolveEnglishPath(pathname: string, currentLocale: Locale): string {
  if (currentLocale === 'en') {
    return pathname || '/';
  }
  const prefix = LOCALE_PREFIXES[currentLocale];
  if (!prefix) {
    return pathname || '/';
  }
  const normalized = pathname?.split('?')[0] ?? '/';
  const prefixed = normalized.startsWith('/') ? normalized : `/${normalized}`;
  const prefixToken = `/${prefix}`;
  if (!prefixed.startsWith(prefixToken)) {
    return prefixed || '/';
  }
  let remainder = prefixed.slice(prefixToken.length);
  if (!remainder || remainder === '/') {
    return '/';
  }
  if (remainder.startsWith('/')) {
    remainder = remainder.slice(1);
  }
  const segments = remainder.split('/').filter(Boolean);
  if (!segments.length) {
    return '/';
  }
  const [first, ...rest] = segments;
  const englishFirst = LOCALIZED_SEGMENT_TO_EN[first] ?? first;
  return `/${[englishFirst, ...rest].join('/')}`;
}

  const displayFor = (code: Locale) => FLAG_MAP[code] ?? code.toUpperCase();

  return (
    <div className="text-xs font-medium text-text-secondary">
      <div className="relative">
        <select
          value={pendingLocale}
          onChange={(event) => handleChange(event.target.value as Locale)}
          className="appearance-none rounded-full border border-[#dce4ff] bg-gradient-to-r from-white via-[#f7f9ff] to-white px-4 py-1.5 pr-8 text-xs font-semibold text-text-primary shadow-[0_2px_8px_rgba(15,23,42,0.08)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={label}
        >
          {options.map((option) => (
            <option key={option.locale} value={option.locale}>
              {displayFor(option.locale as Locale)}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted"
        >
          ▾
        </span>
      </div>
    </div>
  );
}
