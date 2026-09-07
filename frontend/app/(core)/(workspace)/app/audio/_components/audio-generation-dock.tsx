'use client';

import { AudioLines, Clock3, Coins } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AudioWorkspaceCopy } from '../copy';

export function AudioGenerationDock({
  activeProgress,
  canGenerate,
  copy,
  durationLabel,
  generationHint,
  onGenerate,
  priceLabel,
}: {
  activeProgress: number | null;
  canGenerate: boolean;
  copy: AudioWorkspaceCopy;
  durationLabel: string | null;
  generationHint: string;
  onGenerate: () => void;
  priceLabel: string;
}) {
  return (
    <div className="app-audio-generation-dock fixed bottom-0 left-0 right-0 z-30 border-t border-hairline bg-bg px-4 py-3 shadow-[0_-18px_44px_rgba(15,23,42,0.08)] lg:px-7">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {durationLabel ? (
            <div className="flex min-w-[132px] items-center gap-2 rounded-[9px] border border-hairline bg-surface px-3 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-bg text-text-secondary">
                <UIIcon icon={Clock3} size={19} />
              </span>
              <div>
                <p className="text-xs text-text-muted">{copy.pricing.durationEyebrow}</p>
                <p className="text-sm font-semibold text-text-primary">~ {durationLabel}</p>
              </div>
            </div>
          ) : null}
          <div className="flex min-w-[132px] items-center gap-2 rounded-[9px] border border-hairline bg-surface px-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-bg text-text-secondary">
              <UIIcon icon={Coins} size={19} />
            </span>
            <div>
              <p className="text-xs text-text-muted">{copy.pricing.eyebrow}</p>
              <p className="text-sm font-semibold text-text-primary">{priceLabel}</p>
            </div>
          </div>
          {activeProgress == null ? null : (
            <div className="rounded-[9px] border border-brand/25 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand">
              {activeProgress}%
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:min-w-[360px] sm:flex-row sm:items-center sm:justify-end">
          <p className="text-sm text-text-secondary sm:text-right">{generationHint}</p>
          <div className="flex w-full shrink-0 sm:w-auto">
            <Button
              type="button"
              size="lg"
              onClick={onGenerate}
              disabled={!canGenerate}
              className="min-w-0 flex-1 rounded-input sm:min-w-[210px]"
            >
              <UIIcon icon={AudioLines} size={18} />
              {copy.pricing.generate}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
