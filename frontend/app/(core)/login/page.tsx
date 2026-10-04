import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import { isMcpConsentTarget } from '@/lib/mcp-oauth-continuation';
import { getMcpRequestHost, isMcpApiHost } from '@/lib/mcp-host-routing';
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
  const [params, cookieStore, requestHeaders] = await Promise.all([searchParams, cookies(), headers()]);
  const requestHost = getMcpRequestHost(requestHeaders);

  return (
    <LoginPageClient
      initialMode={resolveInitialAuthMode(params.mode, params.next)}
      initialMcpConnection={isMcpConsentTarget(Array.isArray(params.next) ? params.next[0] : params.next)}
      isMcpStaging={Boolean(requestHost && isMcpApiHost(requestHost, 'maxvideoai-mcp-staging.vercel.app'))}
      initialLocale={resolveInitialAuthLocale(
        cookieStore.get(LOCALE_COOKIE)?.value,
        cookieStore.get('NEXT_LOCALE')?.value
      )}
    />
  );
}
