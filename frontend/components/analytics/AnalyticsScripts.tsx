'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { ConsentScriptGate } from '@/components/legal/ConsentScriptGate';

const Clarity = dynamic(() => import('@/components/analytics/Clarity').then((mod) => mod.Clarity), { ssr: false });
const GoogleAds = dynamic(() => import('@/components/analytics/GoogleAds').then((mod) => mod.GoogleAds), {
  ssr: false,
});
const SpeedInsights = dynamic(() => import('@vercel/speed-insights/next').then((mod) => mod.SpeedInsights), {
  ssr: false,
});

const PRIVATE_PATH_PREFIXES = [
  '/admin',
  '/dashboard',
  '/generate',
  '/jobs',
  '/settings',
  '/billing',
  '/app',
  '/connect',
  '/api',
  '/auth',
  '/studio',
  '/login',
];

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function AnalyticsScripts() {
  const pathname = usePathname();

  if (!pathname) {
    return null;
  }

  if (isPrivatePath(pathname)) {
    return null;
  }

  return (
    <ConsentScriptGate categories="analytics">
      <Clarity />
      <GoogleAds />
      <SpeedInsights />
    </ConsentScriptGate>
  );
}
