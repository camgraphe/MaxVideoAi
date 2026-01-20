'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Globe } from 'lucide-react';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPendingLocale((current) => (current === locale ? current : locale));
  }, [locale]);

  const options = useMemo(() => OPTIONS, []);

  const handleChange = (value: Locale) => {
    setPendingLocale(value);
    setMenuOpen(false);
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `NEXT_LOCALE=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
    startTransition(() => {
      router.push(pathname ?? '/');
      router.refresh();
    });
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const currentLabel = options.find((option) => option.locale === pendingLocale)?.label ?? pendingLocale.toUpperCase();

  return (
    <div className="relative text-xs font-medium text-text-secondary">
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={t('workspace.languageToggle.ariaLabel', 'Select language')}
        title={currentLabel}
        className="h-9 w-9 p-0 text-text-primary hover:bg-surface-2"
      >
        <span className="inline-flex h-4 w-4 items-center justify-center">
          <UIIcon icon={Globe} size={16} strokeWidth={1.75} />
        </span>
      </Button>
      {menuOpen ? (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 mt-2 w-44 rounded-card border border-hairline bg-surface p-2 text-sm text-text-primary shadow-card"
        >
          {options.map((option) => {
            const isActive = option.locale === pendingLocale;
            return (
              <button
                key={option.locale}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => handleChange(option.locale)}
                className={clsx(
                  'flex w-full items-center justify-between rounded-input px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive ? 'bg-surface-2 text-text-primary' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                )}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden>{FLAG_MAP[option.locale]}</span>
                  <span>{option.label}</span>
                </span>
                {isActive ? <span className="text-xs text-text-muted">Active</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
