import { cookies } from 'next/headers';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import { LoginPageClient } from './_components/LoginPageClient';
import {
  resolveInitialAuthLocale,
  resolveInitialAuthMode,
} from './_lib/login-route-state';

export const dynamic = 'force-dynamic';

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);

  return (
    <LoginPageClient
      initialMode={resolveInitialAuthMode(params.mode)}
      initialLocale={resolveInitialAuthLocale(
        cookieStore.get(LOCALE_COOKIE)?.value,
        cookieStore.get('NEXT_LOCALE')?.value
      )}
    />
  );
}
