import type { Metadata } from 'next';
import './globals.css';
import { resolveLocale } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'MaxVideo AI',
  description: 'Professional AI video, price before you generate. One hub for every shot.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  metadataBase: new URL('https://www.maxvideo.ai'),
  alternates: {
    canonical: 'https://www.maxvideo.ai/',
    languages: {
      en: 'https://www.maxvideo.ai/',
      fr: 'https://www.maxvideo.ai/?lang=fr',
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = resolveLocale();
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MaxVideo AI',
    url: 'https://www.maxvideo.ai/',
    logo: 'https://www.maxvideo.ai/og/price-before.png',
  };

  return (
    <html lang={locale}>
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
      </body>
    </html>
  );
}
