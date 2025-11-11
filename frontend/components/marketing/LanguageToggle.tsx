'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { Locale } from '@/lib/i18n/types';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import { englishPathFromLocale } from '@/lib/i18n/paths';

const FLAG_MAP: Record<Locale, string> = {
  en: '🇺🇸',
  fr: '🇫🇷',
  es: '🇪🇸',
};

const LOCALE_BYPASS_PREFIXES = ['/video'];

function shouldBypassLocale(pathname: string | null | undefined) {
  if (!pathname) return false;
  return LOCALE_BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function LanguageToggle() {
  const router = useRouter();
  const pathname = usePathname();
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
      const currentPath = typeof pathname === 'string' && pathname.length ? pathname : '/';
      if (shouldBypassLocale(currentPath)) {
        router.refresh();
        return;
      }
      const englishPath = englishPathFromLocale(locale as Locale, currentPath) || '/';
      const routerOptions = value === 'en' ? undefined : { locale: value };
      router.replace(englishPath as never, routerOptions as never);
    });
  };

  const displayFor = (code: Locale) => FLAG_MAP[code] ?? code.toUpperCase();

  return (
    <div className="text-sm text-text-muted">
      <select
        value={pendingLocale}
        onChange={(event) => handleChange(event.target.value as Locale)}
        className="rounded-input border border-hairline bg-bg px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.locale} value={option.locale}>
            {displayFor(option.locale as Locale)}
          </option>
        ))}
      </select>
    </div>
  );
}
