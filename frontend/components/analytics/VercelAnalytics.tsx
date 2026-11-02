'use client';

import { useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { createVercelAnalyticsBeforeSend } from '@/lib/analytics/vercel-context';

export default function VercelAnalytics() {
  const [beforeSend] = useState(createVercelAnalyticsBeforeSend);
  return <Analytics beforeSend={beforeSend} />;
}
