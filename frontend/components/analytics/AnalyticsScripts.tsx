'use client';

import { usePathname } from 'next/navigation';
import { ConsentScriptGate } from '@/components/legal/ConsentScriptGate';
import { Clarity } from '@/components/analytics/Clarity';
import { GoogleAds } from '@/components/analytics/GoogleAds';
import { SpeedInsights } from '@vercel/speed-insights/next';

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
