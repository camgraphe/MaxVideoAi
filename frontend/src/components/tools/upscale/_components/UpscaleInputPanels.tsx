import type { ChangeEventHandler } from 'react';
import { Loader2, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { ToolSourceInput } from '../../ToolWorkbench';
import { toolboxCopy } from '../../toolbox-copy';
import { SelectMenu } from '@/components/ui/SelectMenu';
import type {
  UpscaleMediaType,
  UpscaleMode,
  UpscaleOutputFormat,
  UpscaleTargetResolution,
  UpscaleToolEngineDefinition,
  UpscaleToolEngineId,
} from '@/types/tools-upscale';
import { Label } from './upscale-workspace-controls';

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
  const { locale } = useI18n();
  return <ToolSourceInput locale={locale} kind={mediaType} onKindChange={onMediaTypeChange} url={mediaUrl} name={sourceName} disabled={!isAuthenticated || running} uploading={uploading} onUpload={onUpload} onLibrary={onLibraryOpen} onUrlChange={onMediaUrlChange} />;
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
  quoteError,
  onRefreshQuote,
  priceLoading,
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
  quoteError?: string | null;
  onRefreshQuote: () => void;
  priceHint: string;
  priceLoading?: boolean;
  priceLabel: string;
  running: boolean;
  targetResolution: UpscaleTargetResolution;
  upscaleFactor: number;
}) {
  const { locale } = useI18n();
  const toolbox = toolboxCopy(locale);
  return <section className="order-3 w-full">
    <label className="block text-xs"><span className="mb-2 block">{toolbox.size}</span>
      {mode === 'target' ? <SelectMenu value={targetResolution} onChange={value => onTargetResolutionChange(value as UpscaleTargetResolution)} options={(engine?.supportedTargetResolutions ?? ['1080p']).map(value => ({ value, label: value }))} disabled={running} /> : <SelectMenu value={upscaleFactor} onChange={value => onUpscaleFactorChange(Number(value))} options={(engine?.supportedUpscaleFactors ?? [2]).map(value => ({ value, label: `${value}×` }))} disabled={running} />}
    </label>
    <details className="my-3"><summary className="flex min-h-11 cursor-pointer items-center text-xs text-text-secondary">+ {toolbox.advanced}</summary><div className="grid gap-3 pb-3">
      <label className="block"><Label>{toolbox.implementation}</Label><SelectMenu value={engine?.id ?? engineId} onChange={value => onEngineChange(value as UpscaleToolEngineId)} options={engines.map(entry => ({ value: entry.id, label: entry.label }))} disabled={running} /></label>
      {(engine?.supportedModes.length ?? 0) > 1 ? <label className="block"><Label>{copy.mode}</Label><SelectMenu value={mode} onChange={value => onModeChange(value as UpscaleMode)} options={(engine?.supportedModes ?? ['factor']).map(value => ({ value, label: value === 'target' ? copy.target : copy.factor }))} disabled={running} /></label> : null}
      <label className="block"><Label>{toolbox.format}</Label><SelectMenu value={outputFormat} onChange={value => onOutputFormatChange(value as UpscaleOutputFormat)} options={(engine?.supportedOutputFormats ?? ['jpg']).map(value => ({ value, label: value.toUpperCase() }))} disabled={running} /></label>
    </div></details>
    <Button className="w-full rounded-xl bg-brand text-on-brand hover:bg-brand-hover" size="lg" onClick={onRun} disabled={!canRun}>
      {running || priceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
      {running ? toolbox.processing : priceLoading ? toolbox.priceLoading : toolbox.upscale}{!running && !priceLoading && priceLabel !== '—' ? ` · ${priceLabel}` : ''}
    </Button>
    {quoteError ? <button type="button" className="min-h-11 text-xs underline" onClick={onRefreshQuote} disabled={running}>{toolbox.retryPrice}</button> : null}
    {message ? <p role="status" className="mt-3 text-xs text-text-muted">{message}</p> : null}
    {error ? <p role="alert" className="mt-3 text-xs text-error">{error}</p> : null}
  </section>;
}
