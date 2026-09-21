import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import { locales, defaultLocale, type AppLocale } from '@/i18n/locales';
import { safeRecoveryNext, recoveryEmailDestination } from '@/lib/password-recovery';
import { PasswordRecoveryForm } from './_components/PasswordRecoveryForm.client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'MaxVideoAI — Reset password',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function PasswordRecoveryPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const emailDestination = recoveryEmailDestination(typeof params.redirect_to === 'string' ? params.redirect_to : undefined);
  const locale = [params.lang, emailDestination.locale, cookieStore.get(LOCALE_COOKIE)?.value, cookieStore.get('NEXT_LOCALE')?.value].find(
    (value): value is AppLocale => typeof value === 'string' && locales.includes(value as AppLocale)
  ) ?? defaultLocale;
  return <PasswordRecoveryForm locale={locale} next={safeRecoveryNext(typeof params.next === 'string' ? params.next : emailDestination.next)} />;
}
