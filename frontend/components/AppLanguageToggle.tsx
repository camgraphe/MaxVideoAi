'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import { useI18n } from '@/lib/i18n/I18nProvider';

type Locale = 'en' | 'fr' | 'es';

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

export function AppLanguageToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const [pendingLocale, setPendingLocale] = useState<Locale>(locale);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPendingLocale((current) => (current === locale ? current : locale));
  }, [locale]);

  const options = useMemo(() => OPTIONS, []);

  const handleChange = (value: Locale) => {
    setPendingLocale(value);
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `NEXT_LOCALE=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
    startTransition(() => {
      router.push(pathname ?? '/');
      router.refresh();
    });
  };

  return (
    <div className="relative text-xs font-medium text-text-secondary">
      <select
        value={pendingLocale}
        onChange={(event) => handleChange(event.target.value as Locale)}
        className="appearance-none rounded-full border border-hairline bg-gradient-to-r from-surface via-surface-2 to-surface px-4 py-1.5 pr-8 text-xs font-semibold text-text-primary shadow-[0_2px_8px_rgba(15,23,42,0.12)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label={t('workspace.languageToggle.ariaLabel', 'Select language')}
      >
        {options.map((option) => (
          <option key={option.locale} value={option.locale} aria-label={option.label} title={option.label}>
            {FLAG_MAP[option.locale]}
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
  );
}
