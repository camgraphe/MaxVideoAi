import { Copy, Download, FolderOpen, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BACKGROUND_REMOVAL_WORKSPACE_RECENT_PLACEHOLDER } from '../_lib/background-removal-workspace-assets';
import { formatCurrency } from '../_lib/background-removal-workspace-helpers';
import type { BackgroundRemovalWorkspaceCopy } from '../_lib/background-removal-workspace-copy';
import type { RecentBackgroundRemovalResult } from '../_lib/background-removal-workspace-types';

export function BackgroundRemovalRecentRail(props: {
  copy: BackgroundRemovalWorkspaceCopy;
  items: RecentBackgroundRemovalResult[];
  locale: string;
  onCopy: (url: string) => void;
  onDownload: (url: string) => void;
  onSave: (item: RecentBackgroundRemovalResult) => void;
  onSelect: (item: RecentBackgroundRemovalResult) => void;
  savingJobId: string | null;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{props.copy.recentTitle}</h2>
          <p className="mt-1 text-xs text-text-secondary">{props.copy.libraryHelp}</p>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] bg-bg text-text-muted">
          <FolderOpen className="h-4 w-4" />
        </span>
      </div>

      <div className="grid gap-3 p-4">
        {!props.items.length ? (
          <div className="rounded-[14px] border border-dashed border-border bg-bg p-3">
            <span className="relative block aspect-video overflow-hidden rounded-[12px] bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="h-full w-full object-cover opacity-90" src={BACKGROUND_REMOVAL_WORKSPACE_RECENT_PLACEHOLDER} />
              <span className="absolute bottom-2 right-2 rounded-full bg-slate-950/82 px-2 py-1 text-[11px] font-semibold text-white">
                00:12
              </span>
            </span>
            <p className="mt-3 text-sm font-semibold text-text-primary">{props.copy.recentEmpty}</p>
            <p className="mt-1 text-xs leading-5 text-text-secondary">{props.copy.priceBeforeGeneration}</p>
          </div>
        ) : null}
        {props.items.map((item) => (
          <article className="flex gap-3 rounded-[14px] border border-border bg-bg p-3 shadow-sm" key={item.job.jobId}>
            <button
              className="group relative block aspect-video w-28 shrink-0 overflow-hidden rounded-[10px] bg-surface-2 text-left"
              onClick={() => props.onSelect(item)}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                src={item.thumbUrl ?? BACKGROUND_REMOVAL_WORKSPACE_RECENT_PLACEHOLDER}
              />
              <span className="absolute bottom-1.5 right-1.5 rounded-full bg-slate-950/82 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {item.mimeType?.split('/')[1]?.toUpperCase() ?? 'VIDEO'}
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary">{item.engineLabel}</p>
              <p className="mt-1 text-xs text-text-muted">
                {formatCurrency(item.totalCents ?? null, item.currency ?? 'USD', props.locale)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button aria-label={props.copy.download} onClick={() => props.onDownload(item.url)} size="sm" title={props.copy.download} variant="ghost">
                  <Download className="h-4 w-4" />
                </Button>
                <Button aria-label={props.copy.copyLink} onClick={() => props.onCopy(item.url)} size="sm" title={props.copy.copyLink} variant="ghost">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={props.copy.save}
                  disabled={props.savingJobId === item.job.jobId}
                  onClick={() => props.onSave(item)}
                  size="sm"
                  title={props.copy.save}
                  variant="ghost"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}
