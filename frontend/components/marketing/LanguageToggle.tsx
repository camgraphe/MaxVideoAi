'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import clsx from 'clsx';
import { Globe } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { Locale } from '@/lib/i18n/types';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import localizedSlugConfig from '@/config/localized-slugs.json';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';

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

type LanguageToggleVariant = 'select' | 'icon';

export function LanguageToggle({ variant = 'select' }: { variant?: LanguageToggleVariant }) {
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
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPendingLocale(locale);
  }, [locale]);

  const handleChange = (value: Locale) => {
    setPendingLocale(value);
    setMenuOpen(false);
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `NEXT_LOCALE=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
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
  const currentLabel = options.find((option) => option.locale === pendingLocale)?.label ?? pendingLocale.toUpperCase();

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

  if (variant === 'select') {
    return (
      <div className="text-xs font-medium text-text-secondary">
        <div className="relative">
          <select
            value={pendingLocale}
            onChange={(event) => handleChange(event.target.value as Locale)}
            className="appearance-none rounded-full border border-hairline bg-gradient-to-r from-surface via-surface-2 to-surface px-4 py-1.5 pr-8 text-xs font-semibold text-text-primary shadow-[0_2px_8px_rgba(15,23,42,0.08)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
        aria-label={label}
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
                  <span aria-hidden>{displayFor(option.locale as Locale)}</span>
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
