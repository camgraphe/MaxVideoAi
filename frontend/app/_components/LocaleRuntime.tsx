import type { ReactNode } from 'react';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { AnalyticsScripts } from '@/components/analytics/AnalyticsScripts';
import ConsentModeBootstrap from '@/components/analytics/ConsentModeBootstrap';
import GA4EventBridge from '@/components/analytics/GA4EventBridge';
import GA4RouteTracker from '@/components/analytics/GA4RouteTracker';
import { CookieBanner } from '@/components/legal/CookieBanner';
import { JsonLd } from '@/components/SeoJsonLd';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { localeRegions, type AppLocale } from '@/i18n/locales';
import {
  pickClientMessageNamespaces,
  type ClientMessageNamespace,
} from '@/lib/i18n/client-message-namespaces';
import { deserializeMessages } from '@/lib/i18n/server';
import { SITE_ORIGIN } from '@/lib/siteOrigin';

type LocaleRuntimeProps = {
  children: ReactNode;
  locale: AppLocale;
  clientMessageNamespaces?: readonly ClientMessageNamespace[];
};

export async function LocaleRuntime({ children, locale, clientMessageNamespaces }: LocaleRuntimeProps) {
  setRequestLocale(locale);

  const fullMessages = deserializeMessages(await getMessages({ locale }));
  const messages = pickClientMessageNamespaces(fullMessages, clientMessageNamespaces);
  const fallbackMessages = messages;
  const homeUrl = `${SITE_ORIGIN}/`;
  const logoUrl = `${SITE_ORIGIN}/favicon-512.png`;
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MaxVideoAI',
    url: homeUrl,
    logo: logoUrl,
    sameAs: [
      'https://x.com/MaxVideoAI',
      'https://www.linkedin.com/company/maxvideoai/',
      'https://github.com/camgraphe/maxvideoai',
      'https://www.producthunt.com/products/maxvideoai',
    ],
  };

  const enableSearchSchema = process.env.NEXT_PUBLIC_ENABLE_SEARCH_SCHEMA === 'true';
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: homeUrl,
    name: 'MaxVideoAI',
    inLanguage: localeRegions[locale],
    ...(enableSearchSchema
      ? {
          potentialAction: {
            '@type': 'SearchAction',
            target: `${homeUrl}search?q={query}`,
            'query-input': 'required name=query',
          },
        }
      : {}),
  };

  return (
    <>
      <ConsentModeBootstrap />
      <GA4RouteTracker />
      <GA4EventBridge />
      <I18nProvider locale={locale} dictionary={messages} fallback={fallbackMessages}>
        {children}
      </I18nProvider>
      {process.env.NODE_ENV === 'production' ? <VercelAnalytics /> : null}
      <AnalyticsScripts />
      <CookieBanner />
      <JsonLd json={orgSchema} />
      <JsonLd json={websiteSchema} />
    </>
  );
}
