import localFont from 'next/font/local';
import { AppExperienceRoot } from '@/components/AppExperienceRoot';
import '@/styles/app-experience.css';
import '@/styles/app-shell.css';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { AnalyticsScripts } from '@/components/analytics/AnalyticsScripts';
import ConsentModeBootstrap from '@/components/analytics/ConsentModeBootstrap';
import GA4EventBridge from '@/components/analytics/GA4EventBridge';
import GA4RouteTracker from '@/components/analytics/GA4RouteTracker';
import { CookieBanner } from '@/components/legal/CookieBanner';
import { JsonLd } from '@/components/SeoJsonLd';
import { SessionWatchdog } from '@/components/auth/SessionWatchdog';
import { SWRFocusResync } from '@/components/swr/SWRFocusResync';
import { SWRProvider } from '@/components/swr/SWRProvider';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { defaultLocale, locales, type AppLocale } from '@/i18n/locales';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import { resolveDictionary } from '@/lib/i18n/server';
import { pickClientMessageNamespaces, type ClientMessageNamespace } from '@/lib/i18n/client-message-namespaces';
import { LocaleSync } from '@/components/i18n/LocaleSync';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
import { buildSiteOrganizationSchema } from '@/lib/seo/site-organization-schema';
const appFont = localFont({ src: '../(core)/_fonts/GeistLatin.woff2', variable: '--font-app', display: 'swap', weight: '100 900', preload: false });
const NORMALIZED_SITE_URL = SITE_ORIGIN;

type AppRuntimeProps = {
  children: ReactNode;
  clientMessageNamespaces?: readonly ClientMessageNamespace[];
};

export async function AppRuntime({ children, clientMessageNamespaces }: AppRuntimeProps) {
  const cookieStore = await cookies();
  const locale = [cookieStore.get(LOCALE_COOKIE)?.value, cookieStore.get('NEXT_LOCALE')?.value].find(
    (candidate): candidate is AppLocale =>
      typeof candidate === 'string' && (locales as readonly string[]).includes(candidate)
  ) ?? defaultLocale;
  const { dictionary: fullDictionary, fallback: fullFallback } = await resolveDictionary({ locale });
  const dictionary = pickClientMessageNamespaces(fullDictionary, clientMessageNamespaces);
  const fallback = fullFallback === fullDictionary
    ? dictionary
    : pickClientMessageNamespaces(fullFallback, clientMessageNamespaces);

  const homeUrl = `${NORMALIZED_SITE_URL}/`;
  const orgSchema = buildSiteOrganizationSchema();

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: homeUrl,
    name: 'MaxVideoAI',
  };

  return (
    <>
      <ConsentModeBootstrap />
      <GA4RouteTracker />
      <GA4EventBridge />
      <I18nProvider locale={locale} dictionary={dictionary} fallback={fallback}>
        <SWRProvider>
          <LocaleSync />
          <SessionWatchdog />
          <SWRFocusResync />
          <AppExperienceRoot fontClass={appFont.variable}>{children}</AppExperienceRoot>
        </SWRProvider>
      </I18nProvider>
      {process.env.NODE_ENV === 'production' ? <VercelAnalytics /> : null}
      <AnalyticsScripts />
      <CookieBanner />
      <JsonLd json={orgSchema} />
      <JsonLd json={websiteSchema} />
    </>
  );
}
