'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { Locale } from '@/lib/i18n/types';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';

const FLAG_MAP: Record<Locale, string> = {
  en: '🇺🇸',
  fr: '🇫🇷',
  es: '🇪🇸',
};

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
        router.replace(`/models/${slugValue}`, { locale: value });
        return;
      }
      const targetPath = pathname && pathname.length ? pathname : '/';
      router.replace(targetPath, { locale: value });
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
