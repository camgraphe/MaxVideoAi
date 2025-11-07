'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import { useI18n } from '@/lib/i18n/I18nProvider';

const LOCALES = ['en', 'fr', 'es'] as const;
type Locale = (typeof LOCALES)[number];

const FLAG_MAP: Record<Locale, string> = {
  en: '🇺🇸',
  fr: '🇫🇷',
  es: '🇪🇸',
};

const OPTIONS: Array<{ locale: Locale; label: string }> = [
  { locale: 'en', label: 'English' },
  { locale: 'fr', label: 'Français' },
  { locale: 'es', label: 'Español' },
];

function detectInitialLocale(): Locale {
  if (typeof document !== 'undefined') {
    const langAttr = document.documentElement.lang?.slice(0, 2).toLowerCase();
    if (LOCALES.includes(langAttr as Locale)) {
      return langAttr as Locale;
    }
    const match = document.cookie.match(/(?:NEXT_LOCALE|mvid_locale)=([a-z]{2})/i);
    if (match && LOCALES.includes(match[1].toLowerCase() as Locale)) {
      return match[1].toLowerCase() as Locale;
    }
  }
  return 'en';
}

export function AppLanguageToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [pendingLocale, setPendingLocale] = useState<Locale>('en');
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPendingLocale(detectInitialLocale());
  }, []);

  const options = useMemo(() => OPTIONS, []);

  const handleChange = (value: Locale) => {
    setPendingLocale(value);
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `NEXT_LOCALE=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
    startTransition(() => {
      router.push(pathname);
      router.refresh();
    });
  };

  return (
    <select
      value={pendingLocale}
      onChange={(event) => handleChange(event.target.value as Locale)}
      className="rounded-input border border-hairline bg-white/80 px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none"
      aria-label={t('workspace.languageToggle.ariaLabel', 'Select language')}
    >
      {options.map((option) => (
        <option key={option.locale} value={option.locale} aria-label={option.label} title={option.label}>
          {FLAG_MAP[option.locale]}
        </option>
      ))}
    </select>
  );
}
