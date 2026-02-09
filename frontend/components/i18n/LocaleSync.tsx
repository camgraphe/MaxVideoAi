'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { locales } from '@/i18n/locales';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import { useI18n } from '@/lib/i18n/I18nProvider';

const NEXT_LOCALE_COOKIE = 'NEXT_LOCALE';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function normalizeLocale(value: string | null): string | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  return (locales as readonly string[]).includes(lower) ? lower : null;
}

export function LocaleSync() {
  const { locale } = useI18n();
  const router = useRouter();
  const didSyncRef = useRef(false);

  useEffect(() => {
    if (didSyncRef.current) return;
    const cookieLocale = normalizeLocale(readCookie(LOCALE_COOKIE) ?? readCookie(NEXT_LOCALE_COOKIE));
    if (!cookieLocale || cookieLocale === locale) {
      return;
    }
    didSyncRef.current = true;
    router.refresh();
  }, [locale, router]);

  return null;
}
