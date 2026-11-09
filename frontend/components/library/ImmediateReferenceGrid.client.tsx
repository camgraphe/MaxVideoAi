'use client';
import { AppGlyph } from '@/components/app/AppGlyph';
import { hasStoredLibraryThumbnail } from '@/lib/library-image';
import { LibraryImageThumbnail } from './LibraryImageThumbnail.client';
import { mediaActionCopy, compactMediaSource } from './media-action-copy';
import { referencePickerCopy } from './reference-picker-copy';
import type { AssetBrowserAsset, AssetLibraryBrowserProps } from './AssetLibraryBrowser';
/** Character entities retain their immediate toggle semantics and specialized source payloads. */
export function ImmediateReferenceGrid({
  assets,
  selectedIds,
  busy,
  isDisabled,
  displayName,
  onChoose,
  onPreview,
  locale,
  source,
  sourceLabels,
  renderAssetMeta,
}: {
  assets: AssetBrowserAsset[];
  selectedIds?: ReadonlySet<string>;
  busy: boolean;
  isDisabled: (asset: AssetBrowserAsset) => boolean;
  displayName: (asset: AssetBrowserAsset) => string;
  onChoose: (asset: AssetBrowserAsset) => void;
  onPreview: (asset: AssetBrowserAsset, trigger: HTMLElement) => void;
  locale: string;
  source: AssetLibraryBrowserProps['source'];
  sourceLabels: AssetLibraryBrowserProps['sourceLabels'];
  renderAssetMeta?: AssetLibraryBrowserProps['renderAssetMeta'];
}) {
  const copy = referencePickerCopy(locale),
    actionCopy = mediaActionCopy(locale);
  return (
    <div className="app-picker-grid">
      {assets.map((asset) => {
        const active = selectedIds?.has(asset.id);
        return (
          <div key={asset.id} className="app-picker-item">
            <button
              type="button"
              className="app-picker-card"
              aria-pressed={Boolean(active)}
              disabled={busy || isDisabled(asset)}
              aria-label={`${active ? copy.selected : copy.choose} · ${displayName(asset)}`}
              onClick={() => onChoose(asset)}
            >
              <span className="app-picker-cover" data-media-kind={asset.kind}>
                {hasStoredLibraryThumbnail(asset) ? (
                  <LibraryImageThumbnail asset={asset} posterOnly />
                ) : (
                  <AppGlyph name={asset.kind} />
                )}
                <span className="app-picker-check" aria-hidden>
                  {active ? '✓' : '+'}
                </span>
              </span>
              <span className="app-picker-card-meta">
                <span title={displayName(asset)}>{displayName(asset)}</span>
                <span>
                  {asset.width && asset.height
                    ? `${asset.width} × ${asset.height}`
                    : compactMediaSource(asset.source ?? source, locale, sourceLabels[source] ?? '')}
                </span>
                {renderAssetMeta?.(asset)}
              </span>
            </button>
            <button
              type="button"
              className="app-picker-preview"
              disabled={busy}
              aria-label={`${actionCopy.preview} · ${displayName(asset)}`}
              onClick={(event) => onPreview(asset, event.currentTarget)}
            >
              {actionCopy.preview}
            </button>
          </div>
        );
      })}
    </div>
  );
}
