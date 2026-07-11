'use client';

import { LayoutPanelTop, X } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';

export type StoryboardLaunchModalProps = {
  open: boolean;
  selectedEngineId: string;
  selectedEngineLabel: string;
  onClose: () => void;
};

function resolveTarget(engineId: string): 'seedance' | 'kling' | null {
  const normalized = engineId.toLowerCase();
  if (normalized.includes('seedance')) return 'seedance';
  if (normalized.includes('kling')) return 'kling';
  return null;
}

export function StoryboardLaunchModal({
  open,
  selectedEngineId,
  selectedEngineLabel,
  onClose,
}: StoryboardLaunchModalProps) {
  if (!open) return null;

  const target = resolveTarget(selectedEngineId);
  const href = target ? `/app/tools/storyboard?target=${target}` : '/app/tools/storyboard';

  return (
    <div
      className="fixed inset-0 z-[10040] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="storyboard-launch-title"
    >
      <div className="absolute inset-0" role="presentation" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-modal border border-border bg-surface p-5 shadow-float">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-input bg-surface-2 text-brand">
              <LayoutPanelTop className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{selectedEngineLabel}</p>
              <h2 id="storyboard-launch-title" className="mt-1 text-lg font-semibold text-text-primary">
                Open Storyboarder
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                Build a hidden Storyboarder reference board first, then use it as image direction for the selected
                video model.
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-card border border-border bg-bg p-4">
            <p className="text-sm font-semibold text-text-primary">Seedance</p>
            <p className="mt-1 text-xs text-text-secondary">
              Product, cooking, film props, animation, stylized or non-human boards. Real people are excluded.
            </p>
          </div>
          <div className="rounded-card border border-border bg-bg p-4">
            <p className="text-sm font-semibold text-text-primary">Kling</p>
            <p className="mt-1 text-xs text-text-secondary">
              Best when the storyboard needs real people or realistic human scenes.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Keep editing video
          </Button>
          <ButtonLink href={href} onClick={onClose}>
            Open Storyboarder
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
