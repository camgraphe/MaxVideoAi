import type { Metadata, Viewport } from 'next';
import { SITE_ORIGIN } from '@/lib/siteOrigin';

const NORMALIZED_SITE_URL = SITE_ORIGIN;

export const metadata: Metadata = {
  metadataBase: new URL(`${NORMALIZED_SITE_URL}/`),
  title: {
    default: 'MaxVideoAI — AI Video Generator Hub',
    template: '%s — MaxVideoAI',
  },
  description: 'Create AI videos, images and audio in MaxVideoAI’s web workspace or through MCP integrations. Compare models, see the price before generating and pay as you go.',
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
