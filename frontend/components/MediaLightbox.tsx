 'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface MediaLightboxEntry {
  id: string;
  label: string;
  videoUrl?: string | null;
  thumbUrl?: string | null;
  aspectRatio?: string | null;
  status?: 'pending' | 'completed' | 'failed';
  progress?: number | null;
  message?: string | null;
  engineLabel?: string | null;
  durationSec?: number | null;
  createdAt?: string | null;
}

export interface MediaLightboxProps {
  title: string;
  subtitle?: string;
  prompt?: string | null;
  metadata?: Array<{ label: string; value: string }>;
  entries: MediaLightboxEntry[];
  onClose: () => void;
}

function aspectRatioClass(aspectRatio?: string | null): string {
  if (!aspectRatio) return 'aspect-[16/9]';
  const value = aspectRatio.toLowerCase();
  if (value === '9:16') return 'aspect-[9/16]';
  if (value === '1:1') return 'aspect-square';
  if (value === '4:5') return 'aspect-[4/5]';
  if (value === '16:9') return 'aspect-[16/9]';
  if (value.includes(':')) {
    const [w, h] = value.split(':').map((part) => Number(part));
    if (Number.isFinite(w) && Number.isFinite(h) && h !== 0) {
      return `aspect-[${w}/${h}]`;
    }
  }
  return 'aspect-[16/9]';
}

export function MediaLightbox({ title, subtitle, prompt, metadata = [], entries, onClose }: MediaLightboxProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = useCallback(
    async (entryId: string, url?: string | null) => {
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        setCopiedId(entryId);
        window.setTimeout(() => setCopiedId((current) => (current === entryId ? null : current)), 1800);
      } catch {
        setCopiedId((current) => (current === entryId ? null : current));
      }
    },
    []
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const hasAtLeastOneVideo = useMemo(() => entries.some((entry) => Boolean(entry.videoUrl)), [entries]);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative max-h-full w-full max-w-5xl overflow-y-auto rounded-[18px] border border-border bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-input border border-border bg-white px-3 py-1 text-sm font-medium text-text-secondary transition hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Fermer
        </button>

        <header className="pr-14">
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-text-secondary">{subtitle}</p> : null}
          {!hasAtLeastOneVideo ? (
            <p className="mt-2 rounded-input border border-dashed border-border bg-bg px-3 py-2 text-sm text-text-muted">
              Les médias seront disponibles une fois le traitement terminé.
            </p>
          ) : null}
        </header>

        {metadata.length > 0 && (
          <section className="mt-5 grid gap-3 text-sm text-text-secondary md:grid-cols-2">
            {metadata.map((item) => (
              <div key={item.label}>
                <p className="text-xs uppercase tracking-micro text-text-muted">{item.label}</p>
                <p className="mt-1 text-text-primary">{item.value}</p>
              </div>
            ))}
          </section>
        )}

        <section className="mt-6 space-y-4">
          {entries.map((entry) => {
            const aspectClass = aspectRatioClass(entry.aspectRatio);
            const videoUrl = entry.videoUrl ?? undefined;
            const thumbUrl = entry.thumbUrl ?? undefined;
            const isProcessing = entry.status === 'pending';
            const progressLabel =
              typeof entry.progress === 'number'
                ? `${Math.max(0, Math.min(100, Math.round(entry.progress)))}%`
                : isProcessing
                  ? 'En cours'
                  : undefined;

            return (
              <article
                key={entry.id}
                className="rounded-card border border-border bg-white/90 p-4 shadow-card md:flex md:items-start md:gap-4"
              >
                <div className={clsx('relative overflow-hidden rounded-[16px] bg-[#EFF3FA] md:w-[360px] md:flex-shrink-0', aspectClass)}>
                  {videoUrl ? (
                    <video
                      key={videoUrl}
                      src={videoUrl}
                      poster={thumbUrl}
                      className="absolute inset-0 h-full w-full object-cover"
                      controls
                      playsInline
                      autoPlay
                      muted
                    />
                  ) : thumbUrl ? (
                    <Image src={thumbUrl} alt="" fill className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#dfe7ff] via-white to-[#f1f4ff] text-[12px] font-medium uppercase tracking-micro text-text-muted">
                      Aperçu indisponible
                    </div>
                  )}
                  {isProcessing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 px-3 text-center text-[11px] text-white backdrop-blur-sm">
                      <span className="uppercase tracking-micro">Processing…</span>
                      {entry.message ? <span className="mt-1 line-clamp-2 text-white/80">{entry.message}</span> : null}
                      {progressLabel ? <span className="mt-1 text-[12px] font-semibold text-white">{progressLabel}</span> : null}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex-1 md:mt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-text-primary">{entry.label}</h3>
                    {entry.engineLabel ? (
                      <span className="rounded-input border border-border bg-bg px-2 py-0.5 text-xs text-text-secondary">
                        {entry.engineLabel}
                      </span>
                    ) : null}
                    {typeof entry.durationSec === 'number' ? (
                      <span className="rounded-input border border-border bg-bg px-2 py-0.5 text-xs text-text-secondary">
                        {entry.durationSec}s
                      </span>
                    ) : null}
                    {entry.createdAt ? (
                      <span className="rounded-input border border-border bg-bg px-2 py-0.5 text-xs text-text-secondary">
                        {(() => {
                          try {
                            return new Intl.DateTimeFormat(undefined, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            }).format(new Date(entry.createdAt!));
                          } catch {
                            return entry.createdAt;
                          }
                        })()}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={videoUrl ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className={clsx(
                        'rounded-input border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        videoUrl
                          ? 'border-border bg-white text-text-secondary hover:bg-bg'
                          : 'pointer-events-none border-border/60 bg-bg text-text-muted'
                      )}
                    >
                      Ouvrir
                    </a>
                    <a
                      href={videoUrl ?? undefined}
                      download
                      className={clsx(
                        'rounded-input border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        videoUrl
                          ? 'border-border bg-white text-text-secondary hover:bg-bg'
                          : 'pointer-events-none border-border/60 bg-bg text-text-muted'
                      )}
                    >
                      Télécharger
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(entry.id, videoUrl)}
                      disabled={!videoUrl}
                      className={clsx(
                        'rounded-input border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        videoUrl
                          ? 'border-border bg-white text-text-secondary hover:bg-bg disabled:cursor-not-allowed'
                          : 'cursor-not-allowed border-border/60 bg-bg text-text-muted'
                      )}
                    >
                      {copiedId === entry.id ? 'Lien copié' : 'Copier le lien'}
                    </button>
                  </div>

                  {entry.message && !isProcessing ? (
                    <p className="mt-3 text-sm text-text-secondary">{entry.message}</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>

        {prompt ? (
          <section className="mt-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-micro text-text-muted">Prompt</h3>
            <button
              type="button"
              onClick={() => {
                if (navigator?.clipboard) {
                  void navigator.clipboard.writeText(prompt).catch(() => undefined);
                }
              }}
              className="rounded-input border border-border bg-white px-3 py-1 text-xs font-medium text-text-secondary transition hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Copier
            </button>
            </div>
            <div className="mt-2 max-h-[180px] overflow-y-auto rounded-input border border-border bg-bg px-4 py-3 text-sm text-text-primary">
              <pre className="whitespace-pre-wrap break-words font-sans">{prompt}</pre>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
