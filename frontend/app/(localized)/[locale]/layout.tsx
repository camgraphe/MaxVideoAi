import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { locales, type AppLocale } from '@/i18n/locales';
import { LocaleRuntime } from '@/app/_components/LocaleRuntime';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const NORMALIZED_SITE_URL = SITE_ORIGIN;

export const metadata: Metadata = {
  metadataBase: new URL(`${NORMALIZED_SITE_URL}/`),
  title: {
    default: 'MaxVideoAI — AI Video Generator Hub',
    template: '%s — MaxVideoAI',
  },
  description: 'Generate cinematic AI videos via Sora 2, Veo 3, Pika & more. Pay-as-you-go, no watermarks.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: ['/favicon.ico'],
    other: [{ rel: 'mask-icon', url: '/favicon.svg', color: '#4F5D75' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#4F5D75',
};

export default async function LocaleLayout(props: LocaleLayoutProps) {
  const params = await props.params;

  const { children } = props;

  const locale = params.locale as AppLocale;
  if (!locales.includes(locale)) {
    notFound();
  }

  return <LocaleRuntime locale={locale}>{children}</LocaleRuntime>;
}
