import { BACKGROUND_REMOVAL_OUTPUT_CODECS, BACKGROUND_REMOVAL_STUDIO_COLORS, formatBackgroundRemovalOutputCodecLabel } from '@/lib/tools-background-removal';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { toolboxCopy } from '../../toolbox-copy';
import type { BackgroundRemovalOutputCodec, BackgroundRemovalStudioBackgroundColor } from '@/types/tools-background-removal';
import type { BackgroundRemovalWorkspaceCopy } from '../_lib/background-removal-workspace-copy';
export function BackgroundRemovalSettingsPanel(props: {
  backgroundColor: BackgroundRemovalStudioBackgroundColor;
  canRun: boolean;
  copy: BackgroundRemovalWorkspaceCopy;
  error: string | null;
  message: string | null;
  onBackgroundColorChange: (value: BackgroundRemovalStudioBackgroundColor) => void;
  onOutputCodecChange: (value: BackgroundRemovalOutputCodec) => void;
  onPreserveAudioChange: (value: boolean) => void;
  onRun: () => void;
  outputCodec: BackgroundRemovalOutputCodec;
  preserveAudio: boolean;
  quoteError?: string | null;
  onRefreshQuote: () => void;
  priceHint: string;
  priceLoading?: boolean;
  priceLabel: string;
  running: boolean;
}) {
  const { locale } = useI18n();
  const copy = toolboxCopy(locale);
  return <fieldset disabled={props.running} className="order-3 w-full">
    <legend className="sr-only">{copy.settings}</legend>
    <label className="grid gap-2 text-xs">{copy.background}<select className="w-full rounded-lg border border-border bg-surface px-3" value={props.backgroundColor} onChange={event => props.onBackgroundColorChange(event.target.value as BackgroundRemovalStudioBackgroundColor)}>{BACKGROUND_REMOVAL_STUDIO_COLORS.map(color => <option key={color} value={color}>{color}</option>)}</select></label>
    <details className="my-3"><summary className="flex min-h-11 cursor-pointer items-center text-xs text-text-secondary">+ {copy.advanced}</summary>
      <label className="grid gap-2 text-xs">{copy.format}<select className="w-full rounded-lg border border-border bg-surface px-3" value={props.outputCodec} onChange={event => props.onOutputCodecChange(event.target.value as BackgroundRemovalOutputCodec)}>{BACKGROUND_REMOVAL_OUTPUT_CODECS.map(codec => <option key={codec} value={codec}>{formatBackgroundRemovalOutputCodecLabel(codec)}</option>)}</select></label>
      <label className="my-2 flex min-h-11 items-center gap-3 text-xs"><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={props.preserveAudio} onChange={event => props.onPreserveAudioChange(event.target.checked)} />{copy.keepAudio}</label>
    </details>
    <button type="button" onClick={props.onRun} disabled={!props.canRun} className="min-h-12 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand">{props.running ? copy.processing : props.priceLoading ? copy.priceLoading : copy.removeBackground}{!props.running && !props.priceLoading && props.priceLabel !== '—' ? ` · ${props.priceLabel}` : ''}</button>
    {props.quoteError ? <button type="button" className="min-h-11 text-xs underline" onClick={props.onRefreshQuote}>{copy.retryPrice}</button> : null}
    {props.error ? <p role="alert" className="mt-3 text-xs text-danger">{props.error}</p> : null}{props.message ? <p role="status" className="mt-3 text-xs text-text-secondary">{props.message}</p> : null}
  </fieldset>;
}
