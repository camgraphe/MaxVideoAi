'use client';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { referencePickerBatchLabel } from './reference-picker-copy';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
import type { ReferencePickerSelection } from './ReferenceLibraryPicker.client';
import type { useReferencePickerSelection } from './useReferencePickerSelection';
/** Pending choices stay visible even when their source page is filtered out. */
export function ReferencePickerFooter({
  picker,
  selection,
  locale,
  assets,
  displayName,
  onClose,
}: {
  picker: ReturnType<typeof useReferencePickerSelection>;
  selection: ReferencePickerSelection;
  locale: string;
  assets: AssetBrowserAsset[];
  displayName: (asset: AssetBrowserAsset, index: number) => string;
  onClose?: () => void;
}) {
  const {
    copy,
    owner,
    basket,
    setBasket,
    selected,
    move,
    isDisabled,
    busy,
    immediate,
    labels,
    unavailableLabel,
    confirm,
    restore,
  } = picker;
  return (
    <>
      {basket.length ? (
        <ol className="app-picker-basket" aria-label={copy.selected}>
          {basket.map((item, index) => (
            <li key={`${item.id}:${item.url}`} data-basket-item>
              <span>
                {index + 1}. {displayName(item, index)}
              </span>
              {isDisabled(item) ||
              ('unavailable' in item && item.unavailable) ||
              ('validationError' in item && item.validationError) ? (
                <span role="status">
                  {item.organization?.trashedAt ? labels[4] : unavailableLabel}
                  {item.organization?.trashedAt && owner ? (
                    <button type="button" disabled={busy} onClick={() => void restore(item)}>
                      {locale.startsWith('fr') ? 'Restaurer' : locale.startsWith('es') ? 'Restaurar' : 'Restore'}
                    </button>
                  ) : null}
                </span>
              ) : null}
              <button
                type="button"
                aria-label={`${labels[0]} · ${displayName(item, index)}`}
                disabled={busy}
                onClick={() => setBasket((previous) => previous.filter((value) => value !== item))}
              >
                <X size={14} aria-hidden /><span>{labels[0]}</span>
              </button>
              {basket.length > 1 ? (
                <div className="app-picker-order-actions">
                <button
                  type="button"
                  disabled={busy || index === 0}
                  data-basket-move={index > 0 ? 'up' : undefined}
                  aria-label={`${labels[1]} · ${displayName(item, index)}`}
                  title={labels[1]}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={busy || index === basket.length - 1}
                  data-basket-move={index < basket.length - 1 ? 'down' : undefined}
                  aria-label={`${labels[2]} · ${displayName(item, index)}`}
                  title={labels[2]}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown size={18} aria-hidden />
                </button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      <footer className="app-picker-footer">
        <div className="app-picker-selection" aria-live="polite">
          {immediate ? (
            <span>
              {selection.selectedIds?.size ?? 0} · {copy.instant}
            </span>
          ) : selected ? (
            <>
              <span className="min-w-0 truncate" title={displayName(selected, assets.indexOf(selected))}>
                {copy.selected} · {displayName(selected, assets.indexOf(selected))}
                {selected.width && selected.height ? ` · ${selected.width} × ${selected.height}` : ''}
              </span>
              <button type="button" disabled={busy} onClick={() => setBasket([])}>
                {copy.clear}
              </button>
            </>
          ) : (
            <span>{copy.empty}</span>
          )}
        </div>
        <div className="app-picker-footer-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            {immediate ? copy.done : copy.cancel}
          </button>
          {!immediate ? (
            <button
              type="button"
              className="app-picker-use"
              disabled={
                !selected ||
                busy ||
                basket.some(
                  (item) =>
                    isDisabled(item) ||
                    ('unavailable' in item && Boolean(item.unavailable)) ||
                    ('validationError' in item && Boolean(item.validationError)),
                )
              }
              onClick={() => void confirm()}
            >
              {busy ? copy.busy : (selection.confirmLabel ?? (selection.onConfirmMany ? referencePickerBatchLabel(locale, basket.length) : copy.use))}
            </button>
          ) : null}
        </div>
      </footer>
    </>
  );
}
