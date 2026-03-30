'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { ConsentScriptGate } from '@/components/legal/ConsentScriptGate';
import { getAnalyticsRouteContext } from '@/lib/analytics-route';

const Clarity = dynamic(() => import('@/components/analytics/Clarity').then((mod) => mod.Clarity), { ssr: false });
const GoogleAds = dynamic(() => import('@/components/analytics/GoogleAds').then((mod) => mod.GoogleAds), {
  ssr: false,
});
const SpeedInsights = dynamic(() => import('@vercel/speed-insights/next').then((mod) => mod.SpeedInsights), {
  ssr: false,
});

export function AnalyticsScripts() {
  const pathname = usePathname();

  if (!pathname) {
    return null;
  }

  const routeContext = getAnalyticsRouteContext(pathname);
  if (routeContext.family !== 'marketing' && routeContext.family !== 'public_tools') {
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
