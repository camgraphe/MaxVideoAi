'use client';

import clsx from 'clsx';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface SnackbarAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost';
}

export interface SnackbarState {
  message: string;
  actions?: SnackbarAction[];
  duration?: number;
}

export function GalleryRailSnackbar({ state, onClose }: { state: SnackbarState | null; onClose: () => void }) {
  useEffect(() => {
    if (!state?.duration) return undefined;
    const timeout = window.setTimeout(onClose, state.duration);
    return () => window.clearTimeout(timeout);
  }, [state, onClose]);

  useEffect(() => {
    if (!state) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [state, onClose]);

  if (!state) return null;

  const actions = state.actions ?? [];

  return createPortal(
    <div className="fixed inset-x-0 bottom-6 z-[9998] flex justify-center px-4">
      <div className="inline-flex max-w-xl flex-wrap items-center gap-4 rounded-card border border-surface-on-media-15 bg-surface-on-media-dark-80 px-4 py-3 text-[13px] text-on-inverse shadow-lg backdrop-blur">
        <span>{state.message}</span>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                type="button"
                onClick={() => {
                  onClose();
                  action.onClick();
                }}
                variant="outline"
                size="sm"
                className={clsx(
                  'rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-micro',
                  action.variant === 'primary'
                    ? 'border-transparent bg-brand text-on-brand hover:bg-brandHover'
                    : 'border border-surface-on-media-30 bg-transparent text-on-inverse hover:bg-surface-on-media-10'
                )}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
