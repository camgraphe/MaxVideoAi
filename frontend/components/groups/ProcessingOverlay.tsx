'use client';

import clsx from 'clsx';
import { GenerationPendingStatus, type GenerationPendingStatusProps } from './GenerationPendingStatus';
import { useI18n } from '@/lib/i18n/I18nProvider';

type ProcessingState = 'pending' | 'error';

interface ProcessingOverlayProps extends GenerationPendingStatusProps {
  state: ProcessingState;
  message?: string | null;
  tone?: 'light' | 'dark';
  className?: string;
  tileIndex?: number;
  tileCount?: number;
}

export const DEFAULT_PROCESSING_COPY = {
  title: 'Processing…',
  errorTitle: 'Generation failed',
  takeLabel: 'Take {current}/{total}',
  phrases: [] as string[],
} as const;

export function ProcessingOverlay({
  state,
  message,
  tone = 'dark',
  className,
  tileIndex,
  tileCount,
  observation,
  startedAt,
  etaSeconds,
  etaSource,
}: ProcessingOverlayProps) {
  const { t } = useI18n();
  const processingCopy = (t('workspace.generate.processing', DEFAULT_PROCESSING_COPY) ??
    DEFAULT_PROCESSING_COPY) as typeof DEFAULT_PROCESSING_COPY;
  const resolvedMessage = state === 'error' ? message?.trim() || processingCopy.errorTitle : null;
  const ariaLabel = state === 'error' ? processingCopy.errorTitle : processingCopy.title;

  return (
    <>
      <div
        className={clsx(
          'processing-overlay absolute inset-0 grid place-items-center rounded-card',
          `processing-overlay--${tone}`,
          className
        )}
        role={state === 'error' ? 'alert' : undefined}
        aria-label={ariaLabel}
      >
        <div
          className="processing-overlay__content flex flex-col items-center gap-1 px-4 py-2 text-center"
          aria-live={state === 'error' ? 'assertive' : 'off'}
          aria-atomic="true"
        >
          <div className="processing-overlay__spinner" aria-hidden />
          {state === 'error' || (typeof tileCount === 'number' && tileCount > 1) ? <span className="processing-overlay__title text-xs font-semibold" role="presentation">
            {state === 'error' ? processingCopy.errorTitle : processingCopy.takeLabel.replace('{current}', String(tileIndex)).replace('{total}', String(tileCount))}
          </span> : null}
          {state !== 'error' ? <GenerationPendingStatus observation={observation} startedAt={startedAt} etaSeconds={etaSeconds} etaSource={etaSource} /> : null}
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
        :global([data-theme='dark']) .processing-overlay--light {
          --overlay-bg: rgba(10, 14, 23, 0.9);
          --overlay-ink: rgba(226, 232, 240, 0.95);
          --overlay-muted: rgba(203, 213, 225, 0.82);
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
          width: 20px;
          height: 20px;
          border-radius: 9999px;
          border: 3px solid rgba(255, 255, 255, 0.22);
          border-top-color: rgba(255, 255, 255, 0.85);
          animation: spinner 0.8s linear infinite;
        }
        .processing-overlay--light .processing-overlay__spinner {
          border: 3px solid rgba(148, 163, 184, 0.3);
          border-top-color: rgba(51, 94, 234, 0.9);
        }
        :global([data-theme='dark']) .processing-overlay--light .processing-overlay__spinner {
          border: 3px solid rgba(255, 255, 255, 0.22);
          border-top-color: rgba(255, 255, 255, 0.85);
        }
        :global(.app-experience) .processing-overlay {
          --overlay-bg: var(--app-panel);
          --overlay-ink: var(--app-ink);
          --overlay-muted: var(--app-muted);
        }
        :global(.app-experience) .processing-overlay .processing-overlay__spinner {
          border-color: var(--app-line);
          border-top-color: var(--app-accent);
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
