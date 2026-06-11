import clsx from 'clsx';
import {
  CheckCircle2,
  Download,
  FileVideo,
  Globe2,
  Maximize2,
  Palette,
  Play,
  Save,
  Sparkles,
  Volume2,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  BACKGROUND_REMOVAL_OUTPUT_CODECS,
  BACKGROUND_REMOVAL_STUDIO_COLORS,
  formatBackgroundRemovalOutputCodecLabel,
} from '@/lib/tools-background-removal';
import type {
  BackgroundRemovalOutputCodec,
  BackgroundRemovalStudioBackgroundColor,
} from '@/types/tools-background-removal';
import { BACKGROUND_REMOVAL_WORKSPACE_PREVIEW_PLACEHOLDER } from '../_lib/background-removal-workspace-assets';
import { canPreviewTransparentOutput } from '../_lib/background-removal-workspace-helpers';
import type { BackgroundRemovalWorkspaceCopy } from '../_lib/background-removal-workspace-copy';
import type { BackgroundRemovalResult } from '../_lib/background-removal-workspace-types';

const OUTPUT_FORMAT_META: Record<BackgroundRemovalOutputCodec, { label: string; detail: string; tone: string }> = {
  webm_vp9: { label: 'WebM', detail: 'Transparent web', tone: 'Best for web' },
  mp4_h264: { label: 'MP4', detail: 'Green plate', tone: 'Best compatibility' },
  mp4_h265: { label: 'MP4', detail: 'H.265 plate', tone: 'Compact' },
  mov_h265: { label: 'MOV', detail: 'H.265 plate', tone: 'Solid' },
  mkv_h265: { label: 'MKV', detail: 'H.265', tone: 'Archive' },
  mkv_h264: { label: 'MKV', detail: 'H.264', tone: 'Archive' },
  mkv_vp9: { label: 'MKV', detail: 'VP9', tone: 'Archive' },
  avi_h264: { label: 'AVI', detail: 'H.264', tone: 'Legacy' },
  gif: { label: 'GIF', detail: 'Short loops', tone: 'Loop' },
};

function outputIcon(codec: BackgroundRemovalOutputCodec) {
  if (codec === 'webm_vp9') return Globe2;
  if (codec === 'mp4_h264' || codec === 'mp4_h265' || codec === 'mov_h265') return Palette;
  return FileVideo;
}

const PRIMARY_OUTPUT_CODECS = ['webm_vp9', 'mp4_h264', 'mov_h265'] as const satisfies readonly BackgroundRemovalOutputCodec[];
const PRIMARY_OUTPUT_CODEC_SET = new Set<BackgroundRemovalOutputCodec>(PRIMARY_OUTPUT_CODECS);
const MORE_OUTPUT_CODECS = BACKGROUND_REMOVAL_OUTPUT_CODECS.filter((codec) => !PRIMARY_OUTPUT_CODEC_SET.has(codec));
const CHECKERBOARD_CLASS =
  'bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:28px_28px] bg-[position:0_0,0_14px,14px_-14px,-14px_0px]';

function EmptyPreview({ copy }: { copy: BackgroundRemovalWorkspaceCopy }) {
  return (
    <div className="w-full overflow-hidden rounded-[14px] border border-border bg-bg shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-muted">
            {copy.emptyPreviewResult}
          </span>
        </div>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] bg-bg text-text-muted" aria-hidden="true">
          <Maximize2 className="h-4 w-4" />
        </span>
      </div>
      <div className={clsx('relative aspect-video', CHECKERBOARD_CLASS)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="h-full w-full object-cover" src={BACKGROUND_REMOVAL_WORKSPACE_PREVIEW_PLACEHOLDER} />
      </div>
      <div className="flex items-center gap-3 border-t border-border bg-surface px-3 py-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-bg text-text-primary">
          <Play className="h-3.5 w-3.5 fill-current" />
        </span>
        <span className="text-xs font-medium text-text-secondary">00:00 / 00:15</span>
        <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
          <span className="absolute inset-y-0 left-0 w-[18%] rounded-full bg-brand" />
        </span>
      </div>
    </div>
  );
}

export function BackgroundRemovalSettingsPanel(props: {
  backgroundColor: BackgroundRemovalStudioBackgroundColor;
  canRun: boolean;
  copy: BackgroundRemovalWorkspaceCopy;
  error: string | null;
  message: string | null;
  onBackgroundColorChange: (value: BackgroundRemovalStudioBackgroundColor) => void;
  onDownload: () => void;
  onOutputCodecChange: (value: BackgroundRemovalOutputCodec) => void;
  onPreserveAudioChange: (value: boolean) => void;
  onRun: () => void;
  onSave: () => void;
  onViewModeChange: (mode: 'source' | 'result') => void;
  outputCodec: BackgroundRemovalOutputCodec;
  preserveAudio: boolean;
  priceHint: string;
  priceLabel: string;
  result: BackgroundRemovalResult | null;
  running: boolean;
  sourceUrl: string;
  viewMode: 'source' | 'result';
}) {
  const selectedMoreCodec = PRIMARY_OUTPUT_CODEC_SET.has(props.outputCodec) ? '' : props.outputCodec;
  const output = props.result?.output ?? null;
  const activeUrl = props.viewMode === 'result' && output?.url ? output.url : props.sourceUrl;
  const canShowResult = Boolean(output?.url);
  const transparent = props.viewMode === 'result' && canPreviewTransparentOutput(props.outputCodec, props.backgroundColor);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-on-brand">
            {props.copy.settingsStep}
          </span>
          <h2 className="text-base font-semibold text-text-primary">{props.copy.settingsTitle}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button aria-label={props.copy.save} disabled={!output?.url} onClick={props.onSave} size="sm" title={props.copy.save} variant="outline">
            <Save className="h-4 w-4" />
          </Button>
          <Button
            aria-label={props.copy.download}
            disabled={!activeUrl}
            onClick={props.onDownload}
            size="sm"
            title={props.copy.download}
            variant="outline"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 p-4">
        <div
          className={clsx(
            'flex min-h-[360px] items-center justify-center rounded-[16px] border border-border p-3',
            transparent ? CHECKERBOARD_CLASS : 'bg-[radial-gradient(circle_at_50%_0%,rgba(132,204,22,0.07),transparent_30%),var(--bg)]'
          )}
        >
          {activeUrl ? (
            <video
              className={clsx(
                'max-h-[620px] w-full rounded-[14px] border border-border object-contain shadow-[0_18px_60px_rgba(15,23,42,0.12)]',
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

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-text-primary">{props.copy.outputCodec}</p>
            <p className="text-xs text-text-muted">{formatBackgroundRemovalOutputCodecLabel(props.outputCodec)}</p>
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_190px]">
            {PRIMARY_OUTPUT_CODECS.map((codec) => {
              const selected = codec === props.outputCodec;
              const Icon = outputIcon(codec);
              const meta = OUTPUT_FORMAT_META[codec];
              return (
                <button
                  aria-pressed={selected}
                  className={clsx(
                    'min-h-[64px] rounded-[12px] border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'border-brand bg-lime-300/12 shadow-[0_12px_30px_rgba(132,204,22,0.14)]'
                      : 'border-border bg-bg hover:border-brand/60 hover:bg-brand/5'
                  )}
                  key={codec}
                  onClick={() => props.onOutputCodecChange(codec)}
                  title={formatBackgroundRemovalOutputCodecLabel(codec)}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] bg-slate-950 text-lime-300 dark:bg-white/[0.08]">
                      <Icon className="h-4 w-4" />
                    </span>
                    {selected ? <CheckCircle2 className="h-4 w-4 text-brand" /> : null}
                  </span>
                  <span className="mt-1.5 block text-sm font-semibold text-text-primary">{meta.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-text-secondary">{meta.detail}</span>
                </button>
              );
            })}
            <label className="min-w-[190px]">
              <span className="sr-only">{props.copy.moreFormats}</span>
              <select
                className="min-h-[64px] w-full rounded-[12px] border border-border bg-bg px-3 py-2 text-sm font-medium text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                onChange={(event) => {
                  if (event.target.value) {
                    props.onOutputCodecChange(event.target.value as BackgroundRemovalOutputCodec);
                  }
                }}
                value={selectedMoreCodec}
              >
                <option value="">{props.copy.moreFormats}</option>
                {MORE_OUTPUT_CODECS.map((codec) => (
                  <option key={codec} value={codec}>
                    {formatBackgroundRemovalOutputCodecLabel(codec)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(180px,0.52fr)_minmax(240px,1fr)]">
          <label className="inline-flex min-h-[42px] items-center gap-2 rounded-input border border-border bg-bg px-3 text-xs font-semibold text-text-primary">
            <input
              checked={props.preserveAudio}
              className="h-3.5 w-3.5 accent-[var(--brand)]"
              onChange={(event) => props.onPreserveAudioChange(event.target.checked)}
              type="checkbox"
            />
            <Volume2 className="h-3.5 w-3.5 text-text-muted" />
            {props.copy.preserveAudio}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-text-primary">
            {props.copy.backgroundColor}
            <select
              className="min-h-[42px] rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary"
              onChange={(event) => props.onBackgroundColorChange(event.target.value as BackgroundRemovalStudioBackgroundColor)}
              value={props.backgroundColor}
            >
              {BACKGROUND_REMOVAL_STUDIO_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-[14px] border border-lime-300/40 bg-lime-300/10 p-3">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-slate-950 text-lime-300 dark:bg-white/[0.08]">
              <WalletCards className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{props.copy.priceBeforeGeneration}</p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-text-primary">{props.priceLabel}</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">{props.priceHint}</p>
            </div>
          </div>
        </div>

        {props.error ? <p className="rounded-input bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{props.error}</p> : null}
        {props.message ? <p className="rounded-input bg-bg px-3 py-2 text-sm text-text-secondary">{props.message}</p> : null}

        <Button className="w-full !bg-lime-300 !bg-none !text-slate-950 hover:!bg-lime-200" disabled={!props.canRun} onClick={props.onRun}>
          <Sparkles className="h-4 w-4" />
          {props.running ? props.copy.running : props.copy.run}
        </Button>
      </div>
    </Card>
  );
}
