'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AppGlyph } from '@/components/app/AppGlyph';
import { LibraryImageThumbnail } from './LibraryImageThumbnail.client';
import { compactMediaSource } from './media-action-copy';
import { workspaceReferenceCopy } from '@/components/composer/workspace-reference-copy';
import { referencePickerCopy } from './reference-picker-copy';
import type { AssetBrowserAsset, AssetLibraryBrowserProps } from './AssetLibraryBrowser';

export type ReferencePickerSelection = {
  scope: string;
  busy?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onConfirm?: (asset: AssetBrowserAsset) => void | string | boolean | Promise<void | string | boolean>;
  selectedIds?: ReadonlySet<string>;
  isDisabled?: (asset: AssetBrowserAsset) => boolean;
  onToggle?: (asset: AssetBrowserAsset) => void;
};

/** Selection is scoped by the caller's actual destination and source, never by display labels. */
export function ReferenceLibraryPicker(props: AssetLibraryBrowserProps & { selection: ReferencePickerSelection }) {
  const { assets, selection, locale = 'en', source, sourceLabels, availableSources, onSourceChange, onClose, closeLabel, title, subtitle, headerActions, error, isLoading, emptyLabel, emptySearchLabel, renderAssetMeta, hasMore, isLoadingMore, loadMoreLabel = 'Load more', onLoadMore } = props;
  const copy = referencePickerCopy(locale);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<{ id: string; url: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const inFlight = useRef(false);
  const searchId = useId();
  const sourceId = useId();
  const busy = confirming || Boolean(selection.busy);
  const immediate = Boolean(selection.onToggle);
  const filtered = assets.filter(asset => [asset.id, asset.source, asset.mime, asset.createdAt, asset.url, `${asset.width ?? ''}x${asset.height ?? ''}`].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  const selected = assets.find(asset => asset.id === chosen?.id && asset.url === chosen.url);
  const loadMoreControl = hasMore && !query.trim() && onLoadMore ? <div className="flex justify-center pt-4"><button type="button" className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || isLoadingMore} onClick={onLoadMore}>{isLoadingMore ? copy.busy : loadMoreLabel}</button></div> : null;
  useEffect(() => {
    if (chosen && !assets.some(asset => asset.id === chosen.id && asset.url === chosen.url)) setChosen(null);
  }, [assets, chosen]);
  const confirm = async () => {
    if (!selected || isLoading || busy || inFlight.current || selection.isDisabled?.(selected)) return;
    inFlight.current = true;
    setConfirming(true);
    selection.onBusyChange?.(true);
    setFailure(null);
    try {
      // The insertion owner alone closes on acceptance; rejected choices remain reviewable.
      const result = await selection.onConfirm?.(selected);
      if (result === false || typeof result === 'string') setFailure(typeof result === 'string' ? result : copy.error);
    } catch {
      setFailure(copy.error);
    } finally {
      inFlight.current = false;
      setConfirming(false);
      selection.onBusyChange?.(false);
    }
  };
  return <div className="app-reference-picker" aria-busy={busy}>
    <header className="app-picker-heading">
      <div><h2 id={props.headingId}>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
      <button type="button" data-modal-initial-focus="true" disabled={busy} onClick={onClose} aria-label={closeLabel ?? copy.cancel}><span aria-hidden>×</span></button>
    </header>
    <fieldset className="app-picker-filters" disabled={busy}>
      <label htmlFor={searchId} className="sr-only">{copy.search}</label>
      <input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={copy.search} />
      <label htmlFor={sourceId} className="sr-only">{copy.source}</label>
      <select id={sourceId} value={source} onChange={event => onSourceChange(event.target.value as typeof source)}>{availableSources.map(option => <option key={option} value={option}>{compactMediaSource(option, locale, sourceLabels[option] ?? option)}</option>)}</select>
      <div className="app-picker-import">{headerActions}</div>
    </fieldset>
    <div className="app-picker-body app-scroll-surface">
      {props.selectionGuidance ? <details className="app-picker-guidance"><summary>{workspaceReferenceCopy(locale).details}</summary><p>{props.selectionGuidance}</p></details> : null}
      {error || failure ? <p role="alert" className="app-picker-error">{error ?? failure}</p> : null}
      {isLoading ? <div className="app-picker-grid" aria-label={copy.busy}>{Array.from({ length: 6 }, (_, index) => <div key={index} className="app-picker-skeleton skeleton" />)}</div> : filtered.length ? <>
        <div className="app-picker-grid">
          {filtered.map((asset, index) => {
            const active = immediate ? selection.selectedIds?.has(asset.id) : selected?.id === asset.id;
            return <button key={asset.id} type="button" className="app-picker-card" aria-pressed={Boolean(active)} disabled={busy || selection.isDisabled?.(asset)}
              aria-label={`${active ? copy.selected : copy.choose} · ${workspaceReferenceCopy(locale).kinds[asset.kind]} ${index + 1}${asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ""}`}
              onClick={() => { setFailure(null); if (immediate) selection.onToggle?.(asset); else setChosen({ id: asset.id, url: asset.url }); }}>
              <span className="app-picker-cover">
                {asset.kind === 'image' ? <LibraryImageThumbnail asset={asset} /> : asset.thumbUrl ? <LibraryImageThumbnail asset={{ url: asset.thumbUrl }} /> : <AppGlyph name={asset.kind} />}
                <span className="app-picker-check" aria-hidden>{active ? '✓' : '+'}</span>
              </span>
              <span className="app-picker-card-meta"><span>{asset.width && asset.height ? `${asset.width} × ${asset.height}` : compactMediaSource((asset.source ?? source) as typeof source, locale, sourceLabels[source] ?? '')}</span>{renderAssetMeta?.(asset)}</span>
            </button>;
          })}
        </div>
        {loadMoreControl}
      </> : <><p className="app-picker-empty">{query.trim() ? emptySearchLabel : emptyLabel}</p>{loadMoreControl}</>}
    </div>
    <footer className="app-picker-footer">
      <div className="app-picker-selection" aria-live="polite">{immediate ? <span>{selection.selectedIds?.size ?? 0} · {copy.instant}</span> : selected ? <><span>{copy.selected} · {selected.width && selected.height ? `${selected.width} × ${selected.height}` : workspaceReferenceCopy(locale).kinds[selected.kind]}</span><button type="button" disabled={busy} onClick={() => setChosen(null)}>{copy.clear}</button></> : <span>{copy.empty}</span>}</div>
      <div className="app-picker-footer-actions"><button type="button" disabled={busy} onClick={onClose}>{immediate ? copy.done : copy.cancel}</button>{!immediate ? <button type="button" className="app-picker-use" disabled={!selected || busy || isLoading || selection.isDisabled?.(selected)} onClick={() => void confirm()}>{busy ? copy.busy : copy.use}</button> : null}</div>
    </footer>
  </div>;
}
