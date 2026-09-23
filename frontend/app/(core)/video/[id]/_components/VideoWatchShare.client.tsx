'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Share2 } from 'lucide-react';
import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';

const VideoSharePanel = dynamic(
  () => import('@/components/library/VideoSharePanel.client').then(module => module.VideoSharePanel),
  { ssr: false }
);

export function VideoWatchShare({ videoId, videoUrl, watchUrl }: { videoId: string; videoUrl: string; watchUrl: string }) {
  const [open, setOpen] = useState(false);
  const asset: AssetBrowserAsset = { id: videoId, jobId: videoId, url: videoUrl, kind: 'video', source: 'gallery' };

  return <div className="app-experience" style={{ background: 'transparent', paddingBottom: 0 }}>
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} data-analytics-event={open ? undefined : 'cta_click'} data-analytics-cta-name="video_share_open" data-analytics-cta-location="watch_page" className="inline-flex min-h-9 items-center gap-2 rounded-input border border-hairline px-3 text-xs font-semibold text-text-secondary hover:bg-surface-2">
      <Share2 size={15} aria-hidden />Share this video
    </button>
    {open ? <VideoSharePanel asset={asset} locale="en" fixedShareUrl={watchUrl} /> : null}
  </div>;
}
