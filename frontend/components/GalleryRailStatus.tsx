'use client';

import { Button, ButtonLink } from '@/components/ui/Button';

export function GalleryRailHeader({ title, viewAll }: { title: string; viewAll: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">{title}</h2>
      <ButtonLink
        href="/jobs"
        prefetch={false}
        variant="ghost"
        size="sm"
        className="rounded-input border border-transparent px-3 py-1 text-[12px] font-medium text-text-muted hover:text-text-secondary"
      >
        {viewAll}
      </ButtonLink>
    </header>
  );
}

export function GalleryRailCuratedBanner({ copy, show }: { copy: string; show: boolean }) {
  if (!show) return null;
  return (
    <div className="rounded-card border border-hairline bg-surface-glass-80 px-3 py-2 text-[12px] text-text-secondary">
      {copy}
    </div>
  );
}

export function GalleryRailErrorBanner({
  copy,
  retryLabel,
  show,
  onRetry,
}: {
  copy: string;
  retryLabel: string;
  show: boolean;
  onRetry: () => void;
}) {
  if (!show) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-warning-border bg-warning-bg px-3 py-2 text-[12px] text-warning">
      <span role="alert">{copy}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="rounded-input border-warning-border bg-surface-glass-70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-warning hover:bg-surface"
      >
        {retryLabel}
      </Button>
    </div>
  );
}
