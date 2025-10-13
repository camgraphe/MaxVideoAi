'use client';

import clsx from 'clsx';
import { useMemo } from 'react';

type ProcessingState = 'pending' | 'error';

interface ProcessingOverlayProps {
  state: ProcessingState;
  message?: string | null;
  progress?: number | null;
  tone?: 'light' | 'dark';
  className?: string;
  tileIndex?: number;
  tileCount?: number;
}

export function ProcessingOverlay({
  state,
  message,
  progress,
  tone = 'dark',
  className,
  tileIndex,
  tileCount,
}: ProcessingOverlayProps) {
  const safeProgress =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.max(0, Math.min(100, Math.round(progress)))
      : null;

  const ariaLabel = useMemo(() => {
    const segments: string[] = [];
    if (typeof tileIndex === 'number' && typeof tileCount === 'number') {
      segments.push(`Rendering preview ${tileIndex} of ${tileCount}`);
    } else {
      segments.push('Rendering preview');
    }
    if (state === 'error') {
      segments.push('failed');
    } else if (safeProgress != null) {
      segments.push(`${safeProgress}%`);
    }
    if (message) segments.push(message);
    return segments.join(' — ');
  }, [tileIndex, tileCount, state, safeProgress, message]);

  return (
    <>
      <div
        className={clsx(
          'processing-overlay absolute inset-0 grid place-items-center rounded-[18px]',
          `processing-overlay--${tone}`,
          className
        )}
        role={state === 'error' ? 'status' : 'progressbar'}
        aria-valuemin={state === 'error' ? undefined : 0}
        aria-valuemax={state === 'error' ? undefined : 100}
        aria-valuenow={state === 'error' ? undefined : safeProgress ?? undefined}
        aria-label={ariaLabel}
      >
        <div
          className="processing-overlay__content flex flex-col items-center gap-2 px-6 py-4 text-center"
          aria-live={state === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          <div className="processing-overlay__spinner" aria-hidden />
          <span className="processing-overlay__title text-xs font-semibold uppercase tracking-micro">
            {state === 'error' ? 'Generation failed' : 'Processing…'}
          </span>
          {message ? (
            <span className="processing-overlay__message text-[12px]">{message}</span>
          ) : null}
          {safeProgress != null && state !== 'error' ? (
            <span className="processing-overlay__progress text-sm font-semibold">{safeProgress}%</span>
          ) : null}
        </div>
      </div>
      <style jsx>{`
        .processing-overlay {
          --overlay-bg: rgba(12, 18, 31, 0.84);
          --overlay-ink: rgba(226, 232, 240, 0.92);
          --overlay-muted: rgba(203, 213, 225, 0.8);
          backdrop-filter: blur(6px);
        }
        .processing-overlay--light {
          --overlay-bg: rgba(245, 247, 252, 0.92);
          --overlay-ink: rgba(30, 41, 59, 0.92);
          --overlay-muted: rgba(100, 116, 139, 0.78);
        }
        .processing-overlay::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: var(--overlay-bg);
        }
        .processing-overlay__content {
          position: relative;
          z-index: 1;
          color: var(--overlay-muted);
        }
        .processing-overlay__title,
        .processing-overlay__progress {
          color: var(--overlay-ink);
        }
        .processing-overlay__spinner {
          width: 32px;
          height: 32px;
          border-radius: 9999px;
          border: 3px solid rgba(255, 255, 255, 0.22);
          border-top-color: rgba(255, 255, 255, 0.85);
          animation: spinner 0.8s linear infinite;
        }
        .processing-overlay--light .processing-overlay__spinner {
          border: 3px solid rgba(148, 163, 184, 0.3);
          border-top-color: rgba(51, 94, 234, 0.9);
        }
        @keyframes spinner {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .processing-overlay__spinner {
            animation: none;
          }
        }
      `}</style>
    </>
  );
}
