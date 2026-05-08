import type { ChangeEventHandler } from 'react';
import { Coins, Image as ImageIcon, LibraryBig, Loader2, Upload, Video, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import type {
  UpscaleMediaType,
  UpscaleMode,
  UpscaleOutputFormat,
  UpscaleTargetResolution,
  UpscaleToolEngineDefinition,
  UpscaleToolEngineId,
} from '@/types/tools-upscale';
import { Label, SegmentButton } from './upscale-workspace-controls';

type UpscaleInputPanelCopy = {
  engine: string;
  factor: string;
  image: string;
  library: string;
  mediaType: string;
  mode: string;
  output: string;
  priceEyebrow: string;
  run: string;
  running: string;
  settingsTitle: string;
  target: string;
  video: string;
};

export function UpscaleSourcePanel({
  copy,
  isAuthenticated,
  mediaType,
  mediaUrl,
  onLibraryOpen,
  onMediaTypeChange,
  onMediaUrlChange,
  onUpload,
  running,
  sourceName,
  uploading,
}: {
  copy: Pick<UpscaleInputPanelCopy, 'image' | 'library' | 'video'>;
  isAuthenticated: boolean;
  mediaType: UpscaleMediaType;
  mediaUrl: string;
  onLibraryOpen: () => void;
  onMediaTypeChange: (mediaType: UpscaleMediaType) => void;
  onMediaUrlChange: (mediaUrl: string) => void;
  onUpload: ChangeEventHandler<HTMLInputElement>;
  running: boolean;
  sourceName?: string | null;
  uploading: boolean;
}) {
  return (
    <Card className="order-1 rounded-[14px] border border-border bg-surface p-5 shadow-card xl:order-none">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-text-secondary">1</span>
          <div>
            <h2 className="text-base font-semibold text-text-primary">Source asset</h2>
            <p className="mt-1 text-xs text-text-muted">Add the asset you want to upscale.</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onLibraryOpen}
          disabled={!isAuthenticated || running || uploading}
          className="h-9 shrink-0 rounded-[10px] border-border bg-surface px-3 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          <LibraryBig className="h-4 w-4" />
          {copy.library}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SegmentButton active={mediaType === 'image'} disabled={running || uploading} onClick={() => onMediaTypeChange('image')}>
          <ImageIcon className="h-4 w-4" />
          {copy.image}
        </SegmentButton>
        <SegmentButton active={mediaType === 'video'} disabled={running || uploading} onClick={() => onMediaTypeChange('video')}>
          <Video className="h-4 w-4" />
          {copy.video}
        </SegmentButton>
      </div>

      <label className="mt-4 block cursor-pointer rounded-[12px] border border-dashed border-border bg-bg p-8 text-center transition hover:border-border-hover hover:bg-surface-hover">
        <input
          type="file"
          accept={mediaType === 'image' ? 'image/*' : 'video/*'}
          onChange={onUpload}
          disabled={!isAuthenticated || uploading || running}
          className="sr-only"
        />
        <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-text-primary shadow-card">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        </span>
        <span className="mt-3 block text-sm font-semibold text-text-primary">Drop file here</span>
        <span className="mt-1 block text-xs text-text-muted">
          {sourceName ?? (mediaType === 'video' ? 'MP4, WebM, MOV' : 'PNG, JPG, WebP up to 200MB')}
        </span>
      </label>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-[11px] text-text-muted">or</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <label className="block">
        <Label>Paste image or video URL</Label>
        <Input
          value={mediaUrl}
          onChange={(event) => onMediaUrlChange(event.target.value)}
          placeholder="https://example.com/asset.mp4"
          disabled={running || uploading}
          className="rounded-[10px] border-border bg-surface text-sm text-text-primary placeholder:text-text-muted"
        />
      </label>
    </Card>
  );
}

export function UpscaleRecipePanel({
  canRun,
  copy,
  engine,
  engineId,
  engines,
  error,
  message,
  mode,
  onEngineChange,
  onModeChange,
  onOutputFormatChange,
  onRun,
  onTargetResolutionChange,
  onUpscaleFactorChange,
  outputFormat,
  priceHint,
  priceLabel,
  running,
  targetResolution,
  upscaleFactor,
}: {
  canRun: boolean;
  copy: Pick<UpscaleInputPanelCopy, 'engine' | 'factor' | 'mode' | 'output' | 'priceEyebrow' | 'run' | 'running' | 'settingsTitle' | 'target'>;
  engine: UpscaleToolEngineDefinition | undefined;
  engineId: UpscaleToolEngineId;
  engines: readonly UpscaleToolEngineDefinition[];
  error: string | null;
  message: string | null;
  mode: UpscaleMode;
  onEngineChange: (engineId: UpscaleToolEngineId) => void;
  onModeChange: (mode: UpscaleMode) => void;
  onOutputFormatChange: (outputFormat: UpscaleOutputFormat) => void;
  onRun: () => void;
  onTargetResolutionChange: (targetResolution: UpscaleTargetResolution) => void;
  onUpscaleFactorChange: (factor: number) => void;
  outputFormat: UpscaleOutputFormat;
  priceHint: string;
  priceLabel: string;
  running: boolean;
  targetResolution: UpscaleTargetResolution;
  upscaleFactor: number;
}) {
  return (
    <Card className="order-3 rounded-[14px] border border-border bg-surface p-5 shadow-card xl:order-none">
      <div className="mb-5 flex items-start gap-3">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-text-secondary">2</span>
        <div>
          <h2 className="text-base font-semibold text-text-primary">{copy.settingsTitle}</h2>
          <p className="mt-1 text-xs text-text-muted">Choose how you want to enhance your asset.</p>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block">
          <Label>{copy.engine}</Label>
          <SelectMenu
            value={engine?.id ?? engineId}
            onChange={(value) => onEngineChange(value as UpscaleToolEngineId)}
            options={engines.map((entry) => ({ value: entry.id, label: entry.label }))}
            disabled={running}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <Label>{copy.mode}</Label>
            <SelectMenu
              value={mode}
              onChange={(value) => onModeChange(value as UpscaleMode)}
              options={(engine?.supportedModes ?? ['factor']).map((entry) => ({
                value: entry,
                label: entry === 'target' ? copy.target : copy.factor,
              }))}
              disabled={running}
            />
          </label>
          <label className="block">
            <Label>{mode === 'target' ? copy.target : copy.factor}</Label>
            {mode === 'target' ? (
              <SelectMenu
                value={targetResolution}
                onChange={(value) => onTargetResolutionChange(value as UpscaleTargetResolution)}
                options={(engine?.supportedTargetResolutions ?? ['1080p']).map((entry) => ({ value: entry, label: entry }))}
                disabled={running}
              />
            ) : (
              <SelectMenu
                value={upscaleFactor}
                onChange={(value) => onUpscaleFactorChange(Number(value))}
                options={(engine?.supportedUpscaleFactors ?? [2]).map((entry) => ({ value: entry, label: `${entry}x` }))}
                disabled={running}
              />
            )}
          </label>
        </div>

        <label className="block">
          <Label>{copy.output}</Label>
          <SelectMenu
            value={outputFormat}
            onChange={(value) => onOutputFormatChange(value as UpscaleOutputFormat)}
            options={(engine?.supportedOutputFormats ?? ['jpg']).map((entry) => ({ value: entry, label: entry.toUpperCase() }))}
            disabled={running}
          />
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-[12px] border border-border bg-bg px-4 py-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-primary shadow-card">
          <Coins className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-text-muted">{copy.priceEyebrow}</p>
          <p className="mt-1 text-xl font-semibold leading-none text-text-primary">{priceLabel}</p>
          <p className="mt-1 text-xs text-text-muted">{priceHint}</p>
        </div>
      </div>

      <Button className="mt-5 w-full rounded-[10px] bg-brand py-3 text-on-brand hover:bg-brand-hover" size="lg" onClick={onRun} disabled={!canRun}>
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
        {running ? copy.running : copy.run}
      </Button>
      {message ? <p className="mt-3 text-sm text-text-muted">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-medium text-error">{error}</p> : null}
    </Card>
  );
}
