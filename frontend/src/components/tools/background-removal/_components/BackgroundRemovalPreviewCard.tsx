import { Download, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { isTransparentOutput } from '../_lib/background-removal-workspace-helpers';
import type { BackgroundRemovalWorkspaceCopy } from '../_lib/background-removal-workspace-copy';
import type { BackgroundRemovalResult } from '../_lib/background-removal-workspace-types';

export function BackgroundRemovalPreviewCard(props: {
  backgroundColor: string;
  copy: BackgroundRemovalWorkspaceCopy;
  onDownload: () => void;
  onSave: () => void;
  outputCodec: string;
  preserveAudio: boolean;
  result: BackgroundRemovalResult | null;
  sourceUrl: string;
  viewMode: 'source' | 'result';
  onViewModeChange: (mode: 'source' | 'result') => void;
}) {
  const output = props.result?.output ?? null;
  const activeUrl = props.viewMode === 'result' && output?.url ? output.url : props.sourceUrl;
  const transparent = props.viewMode === 'result' && isTransparentOutput(props.outputCodec, props.backgroundColor);
  const canShowResult = Boolean(output?.url);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{props.copy.previewTitle}</h2>
          <p className="text-xs text-text-secondary">
            {props.backgroundColor} · {props.outputCodec} · {props.preserveAudio ? 'audio' : 'muted'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => props.onViewModeChange('source')} size="sm" variant={props.viewMode === 'source' ? 'primary' : 'outline'}>
            {props.copy.sourcePreview}
          </Button>
          <Button
            disabled={!canShowResult}
            onClick={() => props.onViewModeChange('result')}
            size="sm"
            variant={props.viewMode === 'result' ? 'primary' : 'outline'}
          >
            {props.copy.resultPreview}
          </Button>
        </div>
      </div>
      <div
        className={
          transparent
            ? 'flex min-h-[420px] items-center justify-center bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:28px_28px] bg-[position:0_0,0_14px,14px_-14px,-14px_0px] p-4'
            : 'flex min-h-[420px] items-center justify-center bg-bg p-4'
        }
      >
        {activeUrl ? (
          <video
            className="max-h-[640px] w-full max-w-5xl rounded-card border border-border bg-black object-contain"
            controls
            muted={!props.preserveAudio}
            playsInline
            src={activeUrl}
          />
        ) : (
          <p className="text-sm text-text-secondary">{props.copy.noPreview}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
        <p className="text-xs text-text-secondary">{transparent ? props.copy.checkerboard : props.copy.previewTitle}</p>
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
