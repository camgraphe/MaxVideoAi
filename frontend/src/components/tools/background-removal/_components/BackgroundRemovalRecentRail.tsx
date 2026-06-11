import { Copy, Download, Save, Video } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
    <Card className="p-4">
      <h2 className="text-base font-semibold text-text-primary">{props.copy.recentTitle}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!props.items.length ? <p className="text-sm text-text-secondary">{props.copy.recentEmpty}</p> : null}
        {props.items.map((item) => (
          <article className="overflow-hidden rounded-card border border-border bg-bg" key={item.job.jobId}>
            <button className="block aspect-video w-full bg-surface-2 text-left" onClick={() => props.onSelect(item)} type="button">
              {item.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="h-full w-full object-cover" src={item.thumbUrl} />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <Video className="h-6 w-6 text-text-muted" />
                </span>
              )}
            </button>
            <div className="p-3">
              <p className="truncate text-sm font-semibold text-text-primary">{item.engineLabel}</p>
              <p className="text-xs text-text-muted">
                {formatCurrency(item.totalCents ?? null, item.currency ?? 'USD', props.locale)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => props.onDownload(item.url)} size="sm" variant="ghost">
                  <Download className="h-4 w-4" />
                </Button>
                <Button onClick={() => props.onCopy(item.url)} size="sm" variant="ghost">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  disabled={props.savingJobId === item.job.jobId}
                  onClick={() => props.onSave(item)}
                  size="sm"
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
