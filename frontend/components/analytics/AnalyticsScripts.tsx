'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { ConsentScriptGate } from '@/components/legal/ConsentScriptGate';
import { getAnalyticsRouteContext, shouldLoadMarketingAnalytics, shouldLoadSpeedInsights } from '@/lib/analytics-route';

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
  const loadSpeedInsights = shouldLoadSpeedInsights(routeContext.family);
  const loadMarketingAnalytics = shouldLoadMarketingAnalytics(routeContext.family);

  return (
    <>
      {loadSpeedInsights ? <SpeedInsights /> : null}
      {loadMarketingAnalytics ? (
        <ConsentScriptGate categories="analytics">
          <Clarity />
          <GoogleAds />
        </ConsentScriptGate>
      ) : null}
    </>
  );
}
