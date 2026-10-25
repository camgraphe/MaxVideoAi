import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { EnginePickerContext } from './model-picker-types';
import type { ModelPickerCopy } from './model-picker-copy';
import styles from './model-picker.module.css';

export function PickerPriceContext({ context, copy, fallback, editable }: {
  context?: EnginePickerContext; copy: ModelPickerCopy; fallback: string; editable: boolean;
}) {
  return <section className={styles.priceContext} aria-label={copy.priceBasis}>
    <div className={styles.priceContextLabel}><span><SlidersHorizontal size={14} aria-hidden="true" />{copy.priceBasis}</span><small>{context?.controls?.length ? context.label : null}</small></div>
    {context?.controls?.length ? <div className={styles.priceControls}>
      {context.controls.map(control => <label key={control.id} className={styles.priceChip}>
        <span className="sr-only">{control.label}</span>
        {control.options && editable ? <><select aria-label={`${copy.priceBasis} — ${control.label}`} value={control.value} onChange={event => context.onControlChange?.(control.id, event.target.value)}>
          {control.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select><ChevronDown size={12} aria-hidden="true" /></> : <span>{control.options?.find(option => option.value === control.value)?.label ?? control.value}</span>}
      </label>)}
    </div> : <p className={styles.context}>{context?.label || fallback}</p>}
    {context?.controls?.length ? <p className={styles.priceContextNote}>{copy.effectiveSettings}</p> : null}
  </section>;
}
