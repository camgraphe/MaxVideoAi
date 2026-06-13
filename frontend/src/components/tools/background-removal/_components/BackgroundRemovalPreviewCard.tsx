import clsx from 'clsx';
import { Download, Layers3, Maximize2, Play, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatBackgroundRemovalOutputCodecLabel } from '@/lib/tools-background-removal';
import type {
  BackgroundRemovalOutputCodec,
  BackgroundRemovalStudioBackgroundColor,
} from '@/types/tools-background-removal';
import { BACKGROUND_REMOVAL_WORKSPACE_PREVIEW_PLACEHOLDER } from '../_lib/background-removal-workspace-assets';
import { canPreviewTransparentOutput } from '../_lib/background-removal-workspace-helpers';
import type { BackgroundRemovalWorkspaceCopy } from '../_lib/background-removal-workspace-copy';
import type { BackgroundRemovalResult } from '../_lib/background-removal-workspace-types';

const CHECKERBOARD_CLASS =
  'bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:28px_28px] bg-[position:0_0,0_14px,14px_-14px,-14px_0px]';

function EmptyPreview({ copy }: { copy: BackgroundRemovalWorkspaceCopy }) {
  return (
    <div className="w-full max-w-5xl overflow-hidden rounded-[16px] border border-border bg-bg shadow-card">
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">{copy.previewTitle}</span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-muted">
            {copy.emptyPreviewResult}
          </span>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] bg-bg text-text-muted" aria-hidden="true">
          <Maximize2 className="h-4 w-4" />
        </span>
      </div>
      <div className={clsx('relative aspect-video', CHECKERBOARD_CLASS)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="h-full w-full object-cover" src={BACKGROUND_REMOVAL_WORKSPACE_PREVIEW_PLACEHOLDER} />
      </div>
      <div className="flex items-center gap-3 border-t border-border bg-surface px-4 py-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-bg text-text-primary">
          <Play className="h-4 w-4 fill-current" />
        </span>
        <span className="text-xs font-medium text-text-secondary">00:00 / 00:15</span>
        <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
          <span className="absolute inset-y-0 left-0 w-[18%] rounded-full bg-brand" />
        </span>
      </div>
    </div>
  );
}

export function BackgroundRemovalPreviewCard(props: {
  backgroundColor: BackgroundRemovalStudioBackgroundColor;
  copy: BackgroundRemovalWorkspaceCopy;
  onDownload: () => void;
  onSave: () => void;
  outputCodec: BackgroundRemovalOutputCodec;
  preserveAudio: boolean;
  result: BackgroundRemovalResult | null;
  sourceUrl: string;
  viewMode: 'source' | 'result';
  onViewModeChange: (mode: 'source' | 'result') => void;
}) {
  const output = props.result?.output ?? null;
  const activeUrl = props.viewMode === 'result' && output?.url ? output.url : props.sourceUrl;
  const transparent = props.viewMode === 'result' && canPreviewTransparentOutput(props.outputCodec, props.backgroundColor);
  const canShowResult = Boolean(output?.url);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-on-brand">
              {props.copy.previewStep}
            </span>
            <h2 className="text-base font-semibold text-text-primary">{props.copy.previewTitle}</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            {props.backgroundColor} · {formatBackgroundRemovalOutputCodecLabel(props.outputCodec)} · {props.preserveAudio ? props.copy.audioOn : props.copy.audioMuted}
          </p>
        </div>
        <div className="inline-flex rounded-input border border-border bg-bg p-1">
          <Button
            className={clsx('min-h-[32px] px-3', props.viewMode === 'source' ? undefined : 'border-0 bg-transparent shadow-none')}
            onClick={() => props.onViewModeChange('source')}
            size="sm"
            variant={props.viewMode === 'source' ? 'primary' : 'ghost'}
          >
            {props.copy.sourcePreview}
          </Button>
          <Button
            className={clsx('min-h-[32px] px-3', props.viewMode === 'result' ? undefined : 'border-0 bg-transparent shadow-none')}
            disabled={!canShowResult}
            onClick={() => props.onViewModeChange('result')}
            size="sm"
            variant={props.viewMode === 'result' ? 'primary' : 'ghost'}
          >
            {props.copy.resultPreview}
          </Button>
        </div>
      </div>

      <div
        className={clsx(
          'flex min-h-[430px] items-center justify-center p-4',
          transparent ? CHECKERBOARD_CLASS : 'bg-[radial-gradient(circle_at_50%_0%,rgba(132,204,22,0.08),transparent_30%),var(--bg)]'
        )}
      >
        {activeUrl ? (
          <video
            className={clsx(
              'max-h-[700px] w-full max-w-5xl rounded-[14px] border border-border object-contain shadow-[0_24px_80px_rgba(15,23,42,0.16)]',
              transparent ? 'bg-transparent' : 'bg-black'
            )}
            controls
            muted={!props.preserveAudio}
            playsInline
            src={activeUrl}
          />
        ) : (
          <EmptyPreview copy={props.copy} />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-bg text-text-muted">
            <Layers3 className="h-4 w-4" />
          </span>
          <p className="text-xs leading-5 text-text-secondary">
            {transparent ? props.copy.checkerboard : props.copy.priceBeforeGeneration}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={!output?.url} onClick={props.onSave} size="sm" variant="outline">
            <Save className="h-4 w-4" />
            {props.copy.save}
          </Button>
          <Button disabled={!activeUrl} onClick={props.onDownload} size="sm" variant="outline">
            <Download className="h-4 w-4" />
            {props.copy.download}
          </Button>
        </div>
      </div>
    </Card>
  );
}
