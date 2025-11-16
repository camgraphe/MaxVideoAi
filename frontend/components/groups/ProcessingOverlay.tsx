'use client';

import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';

type ProcessingState = 'pending' | 'error';

interface ProcessingOverlayProps {
  state: ProcessingState;
  message?: string | null;
  tone?: 'light' | 'dark';
  className?: string;
  tileIndex?: number;
  tileCount?: number;
}

const DEFAULT_PROCESSING_COPY = {
  title: 'Processing…',
  errorTitle: 'Generation failed',
  phrases: [
    'Routing your render through providers…',
    'Warming up motion cues…',
    'Stitching frames into a preview…',
    'Running safety checks before delivery…',
  ],
} as const;

const ROTATION_INTERVAL_MS = 10_000;

export function ProcessingOverlay({
  state,
  message,
  tone = 'dark',
  className,
  tileIndex,
  tileCount,
}: ProcessingOverlayProps) {
  const { t } = useI18n();
  const processingCopy = (t('workspace.generate.processing', DEFAULT_PROCESSING_COPY) ??
    DEFAULT_PROCESSING_COPY) as typeof DEFAULT_PROCESSING_COPY;
  const phrases = Array.isArray(processingCopy.phrases) && processingCopy.phrases.length > 0
    ? processingCopy.phrases
    : DEFAULT_PROCESSING_COPY.phrases;
  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  const isPlaceholderMessage =
    normalizedMessage.length === 0 ||
    normalizedMessage === DEFAULT_PROCESSING_COPY.title ||
    normalizedMessage === DEFAULT_PROCESSING_COPY.errorTitle ||
    normalizedMessage === 'Processing...' ||
    normalizedMessage === processingCopy.title;
  const shouldRotate = state !== 'error' && isPlaceholderMessage && phrases.length > 0;
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (!shouldRotate) return undefined;
    const id = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % phrases.length);
    }, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [shouldRotate, phrases.length]);

  useEffect(() => {
    setPhraseIndex(0);
  }, [shouldRotate, phrases.length]);

  const rotatingMessage = shouldRotate ? phrases[phraseIndex % phrases.length] : null;

  const resolvedMessage =
    state === 'error'
      ? normalizedMessage.length
        ? normalizedMessage
        : processingCopy.errorTitle
      : shouldRotate
        ? rotatingMessage
        : normalizedMessage.length
          ? normalizedMessage
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
    }
    if (resolvedMessage) segments.push(resolvedMessage);
    return segments.join(' — ');
  }, [tileIndex, tileCount, state, resolvedMessage]);

  return (
    <>
      <div
        className={clsx(
          'processing-overlay absolute inset-0 grid place-items-center rounded-[18px]',
          `processing-overlay--${tone}`,
          className
        )}
        role="status"
        aria-label={ariaLabel}
      >
        <div
          className="processing-overlay__content flex flex-col items-center gap-2 px-6 py-4 text-center"
          aria-live={state === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          <div className="processing-overlay__spinner" aria-hidden />
          <span className="processing-overlay__title text-xs font-semibold uppercase tracking-micro" role="presentation">
            {state === 'error' ? processingCopy.errorTitle : processingCopy.title}
          </span>
          {resolvedMessage ? (
            <span className="processing-overlay__message text-[12px]">{resolvedMessage}</span>
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
        .processing-overlay__title {
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
