import type { CustomerTariffEditor } from '../_hooks/useCustomerTariffEditor';
import { formatProviderComparisonScenario } from '../_lib/pricing-cockpit-view-model';
import { isGptImageFamilyEngineId } from '@/lib/image/gptImage2';

const LABELS: Record<string, string> = {
  workflowStep: 'Generation workflow',
  mode: 'Generation mode', resolution: 'Resolution', durationSec: 'Duration (seconds)',
  aspectRatio: 'Aspect ratio', audio: 'Audio', quality: 'Quality', inputImageCount: 'Input images',
  inputVideoDurationSec: 'Input video (seconds)', inheritedDurationSec: 'Inherited video (seconds)',
  inputAudioDurationSec: 'Input audio (seconds)', referenceTokenBudget: 'Reference tokens',
  referenceImageCount: 'Reference images', loop: 'Loop',
  billingInputType: 'Reference video pricing',
  voiceControl: 'Voice control',
  hdr: 'HDR', exrExport: 'EXR export',
};
function valueLabel(key: string, value: string) {
  if (key === 'workflowStep') return value === 'draft' ? 'Draft 480p' : value === 'final' ? 'Final 1080p (second charge)' : 'Standard generation';
  if (key === 'billingInputType') return value === 'video_input' ? 'With video input'
    : value === 'no_video_input' ? 'Without video input' : 'Legacy default';
  if (['loop', 'voiceControl', 'hdr', 'exrExport'].includes(key)) return value === 'true' ? 'On' : 'Off';
  return key === 'audio' ? value === 'true' ? 'With audio' : 'Silent' : value || 'Default';
}

export function TariffVariantControls({ editor, disabled }: { editor: CustomerTariffEditor; disabled: boolean }) {
  const exact = editor.displayed;
  if (!exact) return null;
  const gptImage = isGptImageFamilyEngineId(exact.modelId);
  const seedreamEdit = exact.modelId === 'seedream-5-0-pro' && exact.selector.mode === 'i2i';
  const choiceLabel = (key: string) => key === 'resolution' && gptImage ? 'Billing size tier'
    : key === 'referenceImageCount' && seedreamEdit ? 'Total source images'
    : key === 'durationSec' && exact.supplierComparison.mediaType === 'image'
    ? 'Images per request' : LABELS[key] ?? key;
  const visibleChoices = exact.choices.filter(choice => choice.key !== 'inputImageCount'
    || exact.selector.mode !== 'ref2v');
  const extras = visibleChoices.filter(choice => !['mode', 'resolution', 'durationSec', 'aspectRatio', 'audio'].includes(choice.key));
  return <details className="mb-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
    <summary className="cursor-pointer font-semibold text-text-secondary">Tariff variants & extras <span className="ml-1 font-normal text-text-muted">{formatProviderComparisonScenario(exact.supplierComparison)}{extras.map(choice => ` · ${LABELS[choice.key] ?? choice.key}: ${valueLabel(choice.key, choice.value)}`).join('')}</span></summary>
    <p className="mt-2 text-[10px] text-text-muted">Prices include the selected options. Each supported combination has its own tariff; changing an option reloads its exact price and supplier evidence.</p>
    {gptImage ? <p className="mt-1 text-[10px] text-text-muted">Custom and automatic sizes use these six billing tiers. A tier price applies to every size mapped to it; orientation does not add a charge.</p> : null}
    {visibleChoices.some(choice => choice.range) ? <p className="mt-1 text-[10px] text-amber-900">{exact.continuousInputTariff?.unbounded
      ? 'Trusted quantities use the same unit tariff beyond this example. No artificial duration or token cap.' : exact.selector.mode === 'retake'
      ? 'Inherited output duration accepts decimals; no source clip is charged.'
      : exact.continuousInputTariff?.kind === 'audio' ? 'Source duration accepts decimals. Price is based on source audio seconds.'
      : 'Source duration accepts decimals. Totals include input + output video.'} {exact.continuousInputTariff?.unbounded ? '' : exact.continuousInputTariff
      && exact.selector.mode === 'retake' ? 'Output-rate edits cover inherited durations from 3 to 10 seconds.' : exact.continuousInputTariff
      ? 'Source-rate edits cover the whole valid source range for these output options.'
      : 'Preparing an exact price applies only to this duration.'}</p> : null}
    {exact.choices.some(choice => choice.key === 'referenceImageCount') ? <p className="mt-1 text-[10px] text-text-muted">{seedreamEdit ? 'Total source images includes the main edit source. Supplier cost includes every submitted image.' : exact.modelId.startsWith('luma-uni-') && exact.selector.mode === 'i2i' ? 'Reference images excludes the main edit source.' : 'Reference images counts the submitted sources and references.'}</p> : null}
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{visibleChoices.map(choice => <label key={choice.key} className="text-[10px] text-text-secondary">{choiceLabel(choice.key)}
      {choice.range ? <input aria-label={choiceLabel(choice.key)} type="number" min={choice.range.minInclusive ?? choice.range.minExclusive} max={choice.range.max} step={exact.continuousInputTariff?.unbounded ? '1' : 'any'}
        value={editor.requestedOptions[choice.key] ?? choice.value} disabled={disabled || editor.busy}
        onChange={event => editor.changeOption(choice.key, event.target.value)}
        className="mt-1 h-8 w-full rounded-md border border-border bg-bg px-2 text-xs text-text-primary" />
      : <select aria-label={choiceLabel(choice.key)} value={choice.value} disabled={disabled || editor.busy || editor.loading || !editor.exact || choice.options.length < 2}
        onChange={event => editor.changeOption(choice.key, event.target.value)} className="mt-1 h-8 w-full rounded-md border border-border bg-bg px-2 text-xs text-text-primary">
        {choice.options.map(value => <option key={value} value={value}>{seedreamEdit && choice.key === 'referenceImageCount' ? Number(value || 0) + 1 : valueLabel(choice.key, value)}</option>)}
      </select>}
    </label>)}</div>
  </details>;
}
