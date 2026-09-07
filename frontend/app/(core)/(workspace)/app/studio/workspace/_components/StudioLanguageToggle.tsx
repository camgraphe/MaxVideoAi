'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, Globe } from 'lucide-react';
import { localeLabels, type AppLocale } from '@/i18n/locales';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import { useI18n } from '@/lib/i18n/I18nProvider';
import shellStyles from '../_styles/shell.module.css';

const LANGUAGE_FLAGS: Record<AppLocale, string> = {
  en: '🇺🇸',
  fr: '🇫🇷',
  es: '🇪🇸',
};

function normalizeLocale(value: string): AppLocale {
  return value === 'fr' || value === 'es' ? value : 'en';
}

export function StudioLanguageToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingLocale, setPendingLocale] = useState<AppLocale>(normalizeLocale(locale));
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPendingLocale(normalizeLocale(locale));
  }, [locale]);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer, { passive: true });
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const options = useMemo(
    () =>
      (Object.entries(localeLabels) as Array<[AppLocale, string]>).map(([localeKey, label]) => ({
        label,
        locale: localeKey,
      })),
    []
  );
  const currentLabel = localeLabels[pendingLocale] ?? pendingLocale.toUpperCase();
  const ariaLabel = t('workspace.languageToggle.ariaLabel', 'Select language') ?? 'Select language';

  const handleLocaleChange = (nextLocale: AppLocale) => {
    setPendingLocale(nextLocale);
    setMenuOpen(false);
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=${maxAge}; SameSite=Lax`;
    startTransition(() => {
      router.push(pathname ?? '/');
      router.refresh();
    });
  };

  return (
    <div className={shellStyles.studioLanguageShell}>
      <button
        ref={buttonRef}
        type="button"
        className={shellStyles.studioLanguageButton}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={ariaLabel}
        title={currentLabel}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Globe size={16} strokeWidth={1.75} />
      </button>
      {menuOpen ? (
        <div ref={menuRef} role="menu" className={shellStyles.studioLanguageMenu}>
          {options.map((option) => {
            const isActive = option.locale === pendingLocale;
            return (
              <button
                key={option.locale}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                className={`${shellStyles.studioLanguageOption} ${isActive ? shellStyles.studioLanguageOptionActive : ''}`}
                onClick={() => handleLocaleChange(option.locale)}
              >
                <span className={shellStyles.studioLanguageOptionLabel}>
                  <span aria-hidden="true">{LANGUAGE_FLAGS[option.locale]}</span>
                  <span>{option.label}</span>
                </span>
                {isActive ? <Check size={14} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
