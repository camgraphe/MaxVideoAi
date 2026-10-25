import { Check, Info } from 'lucide-react';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { EngineCaps } from '@/types/engines';
import type { EnginePickerOption } from './model-picker-types';
import type { ModelPickerCopy } from './model-picker-copy';
import type { PickerQuoteState } from './useModelPickerEstimates';
import styles from './model-picker.module.css';

export function pickerPrice(quote: PickerQuoteState['quote'], locale: string) {
  return quote ? new Intl.NumberFormat(locale, { style: 'currency', currency: quote.currency }).format(quote.amount / 100) : null;
}
export function EnginePickerRow({ engine, label, option, chosen, current, disabled, quote, showPrice, locale, copy, onChoose, onInspect }: {
  engine: EngineCaps; label: string; option?: EnginePickerOption; chosen: boolean; current: boolean; disabled?: string;
  quote?: PickerQuoteState; showPrice: boolean; locale: string; copy: ModelPickerCopy; onChoose: () => void; onInspect: () => void;
}) {
  const value = pickerPrice(quote?.quote, locale);
  return <div data-model-id={engine.id} className={`${styles.row} ${chosen ? styles.chosen : ''}`}>
    <button type="button" className={styles.choice} aria-label={`${copy.choose} ${label}`} aria-pressed={chosen} aria-disabled={Boolean(disabled)}
      onClick={() => { if (!disabled) onChoose(); }}>
      <EngineIcon engine={engine} size={28} />
      <span className={styles.modelCopy}><span className={styles.name}>{label}{current ? <small>{copy.current}</small> : null}</span>
        <span className={styles.description}>{disabled || option?.summary || engine.provider}</span>

      </span>
      {showPrice ? <span className={`${styles.price} ${!value ? styles.priceStatus : ''}`} aria-live="polite">
        {disabled ? '—' : value ?? (option?.priceUnavailableReason || (quote?.error ? copy.error : option?.estimate ? copy.pending : '—'))}
      </span> : null}
      {chosen ? <Check size={14} className={styles.check} aria-hidden="true" /> : null}
    </button>
    <button type="button" className={styles.iconButton} aria-label={`${copy.info} ${label}`} data-picker-info={engine.id} onClick={onInspect}><Info size={16} /></button>
  </div>;
}
