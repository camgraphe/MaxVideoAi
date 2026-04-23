import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SITE_ORIGIN } from '@/lib/siteOrigin';

const DESCRIPTION =
  'Create your MaxVideoAI workspace account to generate videos with Sora, Veo, Pika, Kling and more. Sign in, manage credits, and keep every render in one hub.';

export const metadata: Metadata = {
  title: {
    absolute: 'MaxVideoAI — Log in',
  },
  description: DESCRIPTION,
  alternates: {
    canonical: `${SITE_ORIGIN}/login`,
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'MaxVideoAI — Log in',
    description: DESCRIPTION,
    url: `${SITE_ORIGIN}/login`,
  },
  twitter: {
    title: 'MaxVideoAI — Log in',
    description: DESCRIPTION,
  },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
