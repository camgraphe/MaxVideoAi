import { Loader2, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function UpscaleHeroSummaryCard({
  canRun,
  engineLabel,
  mediaTypeLabel,
  modeLabel,
  onRun,
  outputFormatLabel,
  priceLabel,
  runLabel,
  running,
  runningLabel,
}: {
  canRun: boolean;
  engineLabel: string;
  mediaTypeLabel: string;
  modeLabel: string;
  onRun: () => void;
  outputFormatLabel: string;
  priceLabel: string;
  runLabel: string;
  running: boolean;
  runningLabel: string;
}) {
  return (
    <div className="rounded-[20px] border border-border bg-surface-glass-90 p-5 shadow-card backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand text-on-brand">
          <WandSparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-text-primary">{engineLabel}</p>
            <span className="rounded-full border border-success-border bg-success-bg px-2.5 py-1 text-[11px] font-semibold text-success">
              Active
            </span>
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Mode</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{modeLabel}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Type</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{mediaTypeLabel}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Format</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{outputFormatLabel}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Price</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{priceLabel}</p>
        </div>
      </div>
      <Button className="mt-5 w-full rounded-[10px] bg-brand py-3 text-on-brand hover:bg-brand-hover" onClick={onRun} disabled={!canRun}>
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
        {running ? runningLabel : runLabel}
      </Button>
    </div>
  );
}
