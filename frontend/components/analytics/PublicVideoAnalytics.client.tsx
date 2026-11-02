'use client';

import { useEffect } from 'react';
import { pageview } from '@vercel/analytics';

/** No visual/media effect. Approval comes from the server's public watch projection. */
export function PublicVideoAnalytics({ watchPath, analyticsPath, videoId }: { watchPath: string; analyticsPath?: string | null; videoId?: string }) {
  const idPath = videoId ? `/video/${encodeURIComponent(videoId)}` : undefined;
  useEffect(() => {
    if (window.location.pathname === watchPath || window.location.pathname === idPath) {
      // Automatic navigation may precede the async detail. beforeSend deduplicates
      // this request with the SDK's automatic view using the mounted marker.
      pageview({ path: window.location.href });
    }
  }, [watchPath, analyticsPath, idPath]);
  return <span hidden data-video-watch-path={watchPath} data-video-watch-id-path={idPath} data-video-analytics-path={analyticsPath ?? ''} />;
}
