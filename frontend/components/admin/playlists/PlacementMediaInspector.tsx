'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { VideoSeoStatus } from '@/config/video-seo-editorial';
import { authFetch } from '@/lib/authFetch';
import { curationItemFormat, type CurationItem } from '@/lib/admin/playlist-curation';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';

type SeoState = { status: VideoSeoStatus | 'not_selected'; inVideoSitemap: boolean };
const seoLabels: Record<VideoSeoStatus | 'not_selected', string> = {
  candidate: 'Candidate for Video SEO', draft: 'Video SEO draft', needs_edits: 'Video SEO needs edits',
  approved: 'Video SEO approved', disabled: 'Video SEO disabled', not_selected: 'Not selected for Video SEO',
};

export function PlacementMediaInspector({ item, onClose, onRemove, onExclude }: {
  item: CurationItem;
  onClose: () => void;
  onRemove: () => void;
  onExclude: () => void;
}) {
  const { dialogRef, onDialogKeyDown } = useAccessibleModal<HTMLElement>({ onClose });
  const [play, setPlay] = useState(false);
  const [seo, setSeo] = useState<SeoState | null>(null);
  const [seoError, setSeoError] = useState(false);
  const format = curationItemFormat(item);

  useEffect(() => {
    let active = true;
    setSeo(null); setSeoError(false); setPlay(false);
    void authFetch(`/api/admin/video-seo/${encodeURIComponent(item.id)}/status`)
      .then(async response => {
        const payload = await response.json();
        if (!response.ok || !payload?.ok) throw new Error('Video SEO status unavailable');
        if (active) setSeo({ status: payload.status, inVideoSitemap: Boolean(payload.inVideoSitemap) });
      }).catch(() => { if (active) setSeoError(true); });
    return () => { active = false; };
  }, [item.id]);

  return <div data-media-inspector className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 sm:items-center sm:p-4">
    <button type="button" aria-label="Close details backdrop" className="absolute inset-0" onClick={onClose} />
    <section ref={dialogRef} onKeyDown={onDialogKeyDown} role="dialog" aria-modal="true" aria-label="Video details" tabIndex={-1}
      className="relative z-10 flex max-h-[100dvh] w-full max-w-6xl flex-col overflow-y-auto rounded-t-2xl bg-surface shadow-2xl outline-none sm:max-h-[95vh] sm:rounded-2xl lg:flex-row">
      <div className="flex min-h-64 flex-1 items-center justify-center bg-slate-950 p-3 sm:p-5">
        <div className={`relative w-full overflow-hidden rounded-lg bg-black ${format === '9:16' ? 'max-w-[min(38vh,360px)] aspect-[9/16]' : 'aspect-video max-w-4xl'}`}>
          {play ? <video src={item.videoUrl} poster={item.thumbUrl ?? undefined} controls playsInline autoPlay preload="none"
            className="absolute inset-0 h-full w-full object-contain" />
            : <>
              {item.thumbUrl ? <Image src={item.thumbUrl} alt="" fill unoptimized sizes="(max-width: 640px) 100vw, 60vw" className="object-contain" />
                : <span className="absolute inset-0 grid place-items-center text-sm text-white/60">Poster unavailable</span>}
              <button type="button" onClick={() => setPlay(true)}
                className="absolute inset-0 flex items-center justify-center text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                <span className="rounded-full border border-white/50 bg-white/20 px-6 py-4 text-sm font-semibold backdrop-blur-sm">Play video</span>
              </button>
            </>}
        </div>
      </div>
      <div className="flex w-full flex-col gap-5 p-4 sm:p-6 lg:w-[360px] lg:shrink-0">
        <header className="flex items-start justify-between gap-3">
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Gallery video</p>
            <h2 className="mt-1 text-lg font-semibold text-text-primary">{item.engineLabel ?? item.engineId}</h2></div>
          <button type="button" data-modal-initial-focus="true" onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-surface-2">Close details</button>
        </header>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-brand/10 px-3 py-1.5 font-semibold text-brand">In this gallery draft</span>
          <span className="rounded-full bg-surface-2 px-3 py-1.5 text-text-secondary">{format ?? 'Unknown format'}</span>
          {item.outputWidth && item.outputHeight ? <span className="rounded-full bg-surface-2 px-3 py-1.5 text-text-secondary">{item.outputWidth} × {item.outputHeight}</span> : null}
        </div>
        <div className="rounded-lg border border-border bg-surface-2/60 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Video SEO</p>
          <p role="status" className="mt-1 font-medium text-text-primary">{seoError ? 'Status unavailable' : seo ? seoLabels[seo.status] : 'Checking status…'}</p>
          {seo ? <p className="mt-1 text-xs text-text-secondary">Video sitemap: {seo.inVideoSitemap ? 'Included' : 'Not included'}</p> : null}
          <a href={`/admin/video-seo?video=${encodeURIComponent(item.id)}`} className="mt-3 inline-flex rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/5">Open Video SEO</a>
        </div>
        <div><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Prompt</p>
          <p className="mt-1 max-h-44 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{item.prompt || 'No prompt available.'}</p></div>
        <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4 text-xs">
          <button type="button" onClick={() => { onRemove(); onClose(); }} className="rounded-lg border border-border px-3 py-2 font-semibold hover:bg-surface-2">Remove from selection</button>
          <button type="button" onClick={() => { onExclude(); onClose(); }} className="rounded-lg border border-amber-300 px-3 py-2 font-semibold text-amber-900 hover:bg-amber-50">Exclude from page</button>
        </div>
      </div>
    </section>
  </div>;
}
