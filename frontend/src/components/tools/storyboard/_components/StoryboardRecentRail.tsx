/* eslint-disable @next/next/no-img-element */

import { ImageIcon } from 'lucide-react';
import type { StoryboardCopy } from '../_lib/storyboard-workspace-copy';
import type { StoryboardRecentOutput } from '../_hooks/useStoryboardRecentOutputs';

type StoryboardRecentRailProps = {
  activeOutputId: string | null;
  copy: StoryboardCopy;
  loading: boolean;
  outputs: StoryboardRecentOutput[];
  onSelect: (output: StoryboardRecentOutput) => void;
};

export function StoryboardRecentRail({
  activeOutputId,
  copy,
  loading,
  outputs,
  onSelect,
}: StoryboardRecentRailProps) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.recentTitle}</p>
        {outputs.length ? (
          <p className="text-[11px] text-text-muted">{copy.recentHint}</p>
        ) : null}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {loading
          ? Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`storyboard-recent-skeleton-${index}`}
                className="h-[86px] w-[136px] shrink-0 animate-pulse rounded-[10px] border border-border bg-bg"
              />
            ))
          : null}
        {!loading && outputs.length
          ? outputs.map((output, index) => {
              const thumbUrl = output.thumbUrl ?? output.previewUrl ?? output.url;
              const active = activeOutputId === output.id;
              return (
                <button
                  key={output.id}
                  type="button"
                  className={`group w-[136px] shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                    active ? 'rounded-[12px]' : ''
                  }`}
                  onClick={() => onSelect(output)}
                >
                  <span
                    className={`block overflow-hidden rounded-[10px] border bg-bg transition ${
                      active ? 'border-text-primary ring-2 ring-text-primary/10' : 'border-border group-hover:border-border-hover'
                    }`}
                  >
                    <img src={thumbUrl} alt="" className="aspect-[16/10] w-full object-cover" loading="lazy" />
                  </span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-surface-2 px-1 text-[10px] text-text-muted">
                      {index + 1}
                    </span>
                    <span className="truncate">{formatRecentLabel(output.createdAt, copy.recentItemFallback)}</span>
                  </span>
                </button>
              );
            })
          : null}
        {!loading && !outputs.length ? (
          <div className="flex min-h-[86px] w-full items-center gap-2 rounded-[10px] border border-dashed border-border bg-bg px-4 text-sm text-text-muted">
            <ImageIcon className="h-4 w-4" />
            {copy.recentEmpty}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatRecentLabel(createdAt: string | null, fallback: string) {
  if (!createdAt) return fallback;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
