'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import type { PreviewCopy } from './composite-preview-dock-utils';

export function CompositePreviewDockHeader({
  controls,
  copy,
  copyPrompt,
  engineSettings,
  groupItemCount,
  onCopyPrompt,
  showTitle,
}: {
  controls: PreviewCopy['controls'];
  copy: PreviewCopy;
  copyPrompt?: string | null;
  engineSettings?: ReactNode;
  groupItemCount?: number | null;
  onCopyPrompt?: () => void;
  showTitle: boolean;
}) {
  const headerTitle = showTitle ? (
    <div>
      <h2 className="text-sm font-semibold text-text-primary">{copy.title}</h2>
      <p className="text-xs text-text-muted">
        {groupItemCount
          ? (groupItemCount === 1 ? copy.variants.singular : copy.variants.plural).replace('{count}', String(groupItemCount))
          : copy.empty}
      </p>
    </div>
  ) : null;
  const copyButton =
    copyPrompt && onCopyPrompt ? (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onCopyPrompt}
        className="min-h-0 h-auto rounded-full border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-brand hover:bg-surface-3"
      >
        {controls.copyPrompt}
      </Button>
    ) : null;

  return (
    <header className="border-b border-hairline px-4 py-3">
      {engineSettings ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">{engineSettings}</div>
            {!showTitle ? copyButton : null}
          </div>
          {showTitle ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {headerTitle}
              {copyButton}
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          {headerTitle}
          <div className="flex flex-wrap items-center gap-2">{copyButton}</div>
        </div>
      )}
    </header>
  );
}
