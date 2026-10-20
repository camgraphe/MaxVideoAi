'use client';

import { Analytics } from '@vercel/analytics/react';
import { sanitizeVercelAnalyticsEvent } from '@/lib/analytics/vercel-context';

export default function VercelAnalytics() {
  return <Analytics beforeSend={sanitizeVercelAnalyticsEvent} />;
}
