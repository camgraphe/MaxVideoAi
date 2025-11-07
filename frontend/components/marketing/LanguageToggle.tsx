'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { Locale } from '@/lib/i18n/types';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';

export function LanguageToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const options = t('footer.languages', []) as Array<{ locale: Locale; label: string }>;
  const label = t('footer.languageLabel', 'Language');
  const [pendingLocale, setPendingLocale] = useState<Locale>(locale);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPendingLocale(locale);
  }, [locale]);

  const handleChange = (value: Locale) => {
    setPendingLocale(value);
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    startTransition(() => {
      router.replace(pathname, { locale: value });
    });
  };

  return (
    <div className="flex items-center gap-2 text-sm text-text-muted">
      <span>{label}</span>
      <select
        value={pendingLocale}
        onChange={(event) => handleChange(event.target.value as Locale)}
        className="rounded-input border border-hairline bg-bg px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.locale} value={option.locale}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
