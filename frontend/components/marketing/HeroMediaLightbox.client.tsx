'use client';

import { useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';

type HeroMediaLightboxCopy = {
  dialogAria?: string;
  modelPage?: string;
  generateLikeThis?: string;
  viewDetails?: string;
  closePreview?: string;
};

type HeroMediaDetailMeta = {
  prompt?: string | null;
  engineLabel?: string | null;
  durationSec?: number | null;
} | null;

export function HeroMediaLightbox({
  label,
  priceLabel,
  alt,
  detailHref,
  generateHref,
  modelHref,
  detailMeta,
  videoSrc,
  posterSrc,
  lightboxCopy,
  onClose,
}: {
  label: string;
  priceLabel: string;
  alt: string;
  detailHref: string;
  generateHref?: string | null;
  modelHref?: string | null;
  detailMeta?: HeroMediaDetailMeta;
  videoSrc: string;
  posterSrc: string;
  lightboxCopy?: HeroMediaLightboxCopy;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-surface-on-media-dark-80 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={(lightboxCopy?.dialogAria ?? '{label} preview').replace('{label}', label)}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-4xl rounded-[32px] border border-surface-on-media-20 bg-surface-glass-95 p-4 text-left shadow-float"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4 pr-14">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-micro text-text-muted">
              <span>{detailMeta?.engineLabel ?? label}</span>
              {modelHref ? (
                <Link
                  href={modelHref}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-glass-90 px-2 py-0.5 text-[11px] font-semibold text-brand shadow-sm transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>{lightboxCopy?.modelPage ?? 'Model page'}</span>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path
                      d="M4 12L12 4M5 4h7v7"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              ) : null}
            </div>
            <h3 className="text-xl font-semibold text-text-primary">{label}</h3>
            {detailMeta?.prompt ? <p className="text-sm text-text-secondary">{detailMeta.prompt}</p> : null}
            <p className="text-xs font-medium text-text-muted">
              {priceLabel}
              {typeof detailMeta?.durationSec === 'number' ? ` · ${detailMeta.durationSec}s` : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {generateHref ? (
              <Link
                href={generateHref}
                prefetch={false}
                className="inline-flex rounded-pill bg-brand px-4 py-2 text-xs font-semibold uppercase tracking-micro text-on-brand transition hover:bg-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {lightboxCopy?.generateLikeThis ?? 'Generate like this'}
              </Link>
            ) : null}
            <Link
              href={detailHref}
              className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-primary transition hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {lightboxCopy?.viewDetails ?? 'View details'}
            </Link>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-3xl border border-hairline bg-black">
          <video
            key={videoSrc}
            className="h-full w-full object-contain"
            controls
            autoPlay
            muted
            playsInline
            preload="metadata"
            poster={posterSrc}
            aria-label={alt}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="absolute right-4 top-4 h-11 w-11 min-h-0 rounded-full bg-surface-glass-95 p-0 text-text-primary shadow-lg ring-1 ring-border hover:bg-surface"
          aria-label={lightboxCopy?.closePreview ?? 'Close preview'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Button>
      </div>
    </div>
  );
}
