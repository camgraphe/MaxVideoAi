'use client';
import { ImmediateReferenceGrid } from './ImmediateReferenceGrid.client';
import { CompactMediaGrid } from './CompactMediaGrid.client';
import { CompactLibraryCollections } from './CompactLibraryCollections.client';
import { useReferencePickerBrowse } from './useReferencePickerBrowse';
import type { LibraryBrowseScope } from '@/lib/library-browse';
import { ReferenceLibraryManage } from './ReferenceLibraryManage.client';
import { ReferencePickerFooter } from './ReferencePickerFooter.client';
import { useReferencePickerSelection } from './useReferencePickerSelection';
import { Upload } from 'lucide-react';
import { ReferencePickerToolbar } from './ReferencePickerToolbar.client';
import { LibraryImportQueue } from './LibraryImportQueue.client';
import type { LibraryImportQueueController } from '@/lib/library-import-queue';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MediaActionContent } from './MediaActionPanel.client';
import { workspaceReferenceCopy } from '@/components/composer/workspace-reference-copy';
import type { AssetBrowserAsset, AssetLibraryBrowserProps } from './AssetLibraryBrowser';
import type { MediaInputEligibility } from '@/lib/media-input-eligibility';
import { mediaInputEligibilityMessage } from './media-input-eligibility-copy';

export type ReferencePickerSelection = {
  scope: string;
  confirmLabel?: string;
  ownerId?: string | null;
  allowOrganizationBrowse?: boolean;
  browseLibrary?: boolean;
  sourceProof?: 'audio-generated-video' | 'generated-video';
  importQueue?: LibraryImportQueueController;
  busy?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onConfirmMany?: (
    assets: AssetBrowserAsset[],
    acceptance: { isCurrent: () => boolean },
  ) => void | string | boolean | Promise<void | string | boolean>;
  onConfirm?: (asset: AssetBrowserAsset) => void | string | boolean | Promise<void | string | boolean>;
  selectedIds?: ReadonlySet<string>;
  isDisabled?: (asset: AssetBrowserAsset) => boolean;
  getEligibility?: (asset: AssetBrowserAsset) => MediaInputEligibility;
  onToggle?: (asset: AssetBrowserAsset) => void;
};

/** Selection is scoped by the caller's actual destination and source, never by display labels. */
export function ReferenceLibraryPicker(props: AssetLibraryBrowserProps & { selection: ReferencePickerSelection }) {
  return (
    <OwnedReferenceLibraryPicker key={JSON.stringify([props.selection.ownerId, props.selection.scope])} {...props} />
  );
}
const emptyImports: import('@/lib/library-import-queue').LibraryImportSnapshot = {
  files: [],
  running: false,
  paused: false,
};
function OwnedReferenceLibraryPicker(props: AssetLibraryBrowserProps & { selection: ReferencePickerSelection }) {
  const {
    selection,
    locale = 'en',
    source,
    sourceLabels,
    availableSources,
    onSourceChange,
    onClose,
    closeLabel,
    title,
    subtitle,
    headerActions,
    error,
    isLoading,
    emptyLabel,
    emptySearchLabel,
    renderAssetMeta,
    hasMore,
    isLoadingMore,
    loadMoreLabel = 'Load more',
    onLoadMore,
  } = props;
  const [localQuery, setLocalQuery] = useState('');
  const query = props.searchQuery ?? localQuery;
  const setQuery = props.onSearchQueryChange ?? setLocalQuery;
  const [organizationScope, setOrganizationScope] = useState<Partial<LibraryBrowseScope>>({});
  const { assets, organized, usingServerBrowse, browseScope } = useReferencePickerBrowse(props, query, organizationScope);
  const picker = useReferencePickerSelection({ selection, assets, locale });
  const {
    copy,
    owner,
    basket,
    setBasket,
    choose,
    same,
    isDisabled,
    busy,
    immediate,
    failure,
    setFailure,
    setConfirming,
    labels,
  } = picker;
  const browseError = usingServerBrowse ? (organized.error ? copy.loadError : null) : error;
  const [compatibility, setCompatibility] = useState('compatible');
  const [managing, setManaging] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  // Inline views replace the focused grid/filter control inside the existing host.
  // Focus once on mount, without refocusing on queue progress or management updates.
  const focusInlineBack = useCallback((button: HTMLButtonElement | null) => button?.focus(), []);
  const [importing, setImporting] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const imports = useSyncExternalStore(
    selection.importQueue?.subscribe ?? (() => () => {}),
    selection.importQueue?.getSnapshot ?? (() => emptyImports),
    () => emptyImports,
  );
  const [preview, setPreview] = useState<AssetBrowserAsset | null>(null);
  useEffect(() => {
    if (props.active === false) { setPreview(null); setManaging(false); }
  }, [props.active]);
  const eligibility = new Map(assets.map((asset) => [asset, selection.getEligibility?.(asset)]));
  const displayName = (asset: AssetBrowserAsset, index: number) =>
    asset.name?.trim() || `${workspaceReferenceCopy(locale).kinds[asset.kind]} ${index + 1}`;
  const indexedNames = new Map(assets.map((asset, index) => [asset, displayName(asset, index)]));
  const filtered = assets.filter(
    (asset, index) =>
      (compatibility === 'all' || eligibility.get(asset)?.status !== 'blocked') &&
      (usingServerBrowse || [
        displayName(asset, index),
        asset.name,
        asset.id,
        asset.source,
        asset.mime,
        asset.createdAt,
        asset.url,
        `${asset.width ?? ''}x${asset.height ?? ''}`,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query.trim().toLowerCase())),
  );
  const more = usingServerBrowse ? organized.loadMore : onLoadMore;
  const loadingMore = usingServerBrowse ? organized.isLoadingMore : isLoadingMore;
  const loading = usingServerBrowse ? organized.isLoading : isLoading;
  const loadMoreControl =
    (usingServerBrowse ? organized.hasMore : hasMore) && more ? (
      <div className="app-picker-load-more">
        {query.trim() && !usingServerBrowse ? (
          <p role="status" className="text-center text-xs text-text-secondary">
            {copy.searchMore}
          </p>
        ) : null}
        <button
          type="button"
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy || loadingMore}
          onClick={more}
        >
          {loadingMore ? copy.busy : loadMoreLabel}
        </button>
      </div>
    ) : null;
  const importView =
    importing && selection.importQueue ? (
      <div className="app-reference-picker">
        <header className="app-picker-heading">
          <h2>{copy.source}</h2>
          <button ref={focusInlineBack} type="button" onClick={() => {
            setImporting(false);
            queueMicrotask(() => returnFocus.current?.focus());
          }}>
            {labels[3]}
          </button>
        </header>
        <LibraryImportQueue queue={selection.importQueue} locale={locale} />
        <div className="app-picker-body">
          {imports.files.map((file) =>
            file.status === 'success' && file.result ? (
              <button
                key={file.id}
                type="button"
                disabled={isDisabled(file.result)}
                onClick={() => {
                  if (!basket.some((item) => same(item, file.result!))) choose(file.result!);
                  setImporting(false);
                }}
              >
                {copy.choose} · {file.name}
              </button>
            ) : null,
          )}
        </div>
      </div>
    ) : null;
  const previewView = props.active !== false && preview ? (
    <div className="app-reference-picker">
      <header className="app-picker-heading">
        <h2>{preview.name ?? title}</h2>
        <button
          ref={focusInlineBack}
          type="button"
          disabled={busy}
          onClick={() => {
            setPreview(null);
            setManaging(false);
            queueMicrotask(() => returnFocus.current?.focus());
          }}
        >
          {labels[3]}
        </button>
      </header>
      <MediaActionContent asset={preview} locale={locale}>
        {failure ? <p role="alert" className="app-picker-error">{failure}</p> : null}
        <button
          type="button"
          disabled={busy || isDisabled(preview)}
          onClick={() => {
            if (immediate) {
              choose(preview);
              setPreview(null);
            } else void picker.confirmAsset(preview);
          }}
        >
          {immediate ? (selection.selectedIds?.has(preview.id) ? labels[0] : copy.choose) : copy.add}
        </button>
        {props.renderAssetActions(preview)}
        {owner && !immediate ? (
          <button type="button" disabled={busy} onClick={() => setManaging((value) => !value)}>
            {locale.startsWith('fr') ? 'Organiser' : locale.startsWith('es') ? 'Organizar' : 'Organize'}
          </button>
        ) : null}
        {managing && owner && !immediate ? (
          <ReferenceLibraryManage
            asset={preview}
            userId={owner}
            locale={locale}
            onBusy={(value) => {
              setConfirming(value);
              selection.onBusyChange?.(value);
            }}
            onChange={(organization) => {
              setPreview({ ...preview, organization });
              setBasket((previous) =>
                previous.map((item) =>
                  same(item, preview) ? { ...item, organization, validationError: undefined } : item,
                ),
              );
            }}
          />
        ) : null}
      </MediaActionContent>
    </div>
  ) : null;
  return (
    <>
      {importView}
      {previewView}
      <div className="app-reference-picker" hidden={importing || Boolean(preview)} aria-busy={busy}>
        <header className="app-picker-heading">
          <div>
            <h2 id={props.headingId}>{title}</h2>
            {subtitle || usingServerBrowse ? <p className="app-picker-summary">
              {subtitle ? <span>{subtitle}</span> : null}
              {usingServerBrowse && !loading && !browseError ? <span role="status">{organized.totalCount} {locale.startsWith('fr') ? 'médias' : locale.startsWith('es') ? 'medios' : 'media'}</span> : null}
            </p> : null}
          </div>
          <button
            type="button"
            data-modal-initial-focus="true"
            disabled={busy}
            onClick={onClose}
            aria-label={closeLabel ?? copy.cancel}
          >
            <span aria-hidden>×</span>
          </button>
        </header>
        <ReferencePickerToolbar
          locale={locale} busy={busy} query={query} onQueryChange={setQuery}
          source={source} sourceLabels={sourceLabels} availableSources={availableSources} onSourceChange={onSourceChange}
          compatibility={selection.getEligibility ? compatibility : undefined} onCompatibilityChange={setCompatibility}
          collections={owner && !selection.onToggle && selection.allowOrganizationBrowse !== false ? <CompactLibraryCollections
            key={owner} userId={owner} locale={locale} scope={browseScope} picker
            onScopeChange={(patch) => setOrganizationScope((previous) => ({ ...previous, ...patch }))}
          /> : undefined}
          headerActions={headerActions} showCharacterStudio={!immediate && availableSources.includes('character')}
          selectionGuidance={props.selectionGuidance} hint={!immediate ? (selection.onConfirmMany ? copy.multipleHint : copy.clickHint) : undefined}
        >
            {selection.importQueue ? (
              <div className="app-picker-import">
                <input
                  ref={importInput}
                  tabIndex={-1}
                  type="file"
                  accept={props.assetType === 'all' ? 'image/*,video/*,audio/*' : `${props.assetType}/*`}
                  multiple
                  hidden
                  onChange={(event) => {
                    const files = Array.from(event.currentTarget.files ?? []);
                    event.currentTarget.value = '';
                    try {
                      selection.importQueue!.add(files);
                      setImporting(true);
                    } catch {
                      setFailure(copy.error);
                    }
                  }}
                />
                <button type="button" aria-label={locale.startsWith('fr') ? 'Importer' : locale.startsWith('es') ? 'Importar' : 'Import'} onClick={(event) => {
                  returnFocus.current = event.currentTarget;
                  importInput.current?.click();
                }}>
                  <Upload size={16} aria-hidden /><span className="app-picker-import-label">{locale.startsWith('fr') ? 'Importer' : locale.startsWith('es') ? 'Importar' : 'Import'}</span>
                </button>
                {imports.files.length ? (
                  <button type="button" onClick={(event) => {
                    returnFocus.current = event.currentTarget;
                    setImporting(true);
                  }}>
                    {imports.files.length} · {copy.source}
                  </button>
                ) : null}
              </div>
            ) : null}
        </ReferencePickerToolbar>
        <div className={`app-picker-body app-scroll-surface ${immediate ? '' : 'app-picker-collection-body'}`}>
          {browseError || failure ? (
            <p role="alert" className="app-picker-error">
              {failure ?? browseError}
            </p>
          ) : null}
          {loading && immediate ? (
            <div className="app-picker-grid" aria-label={copy.busy}>
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="app-picker-skeleton skeleton" />
              ))}
            </div>
          ) : !immediate || filtered.length ? (
            <>
              {!immediate && loading ? <p role="status">{copy.busy}</p> : null}
              {!immediate && !loading && !filtered.length && !browseError && !failure ? (
                <p className="app-picker-empty">
                  {query.trim()
                    ? emptySearchLabel
                    : selection.getEligibility && compatibility !== 'all' && assets.length
                      ? copy.noCompatible
                      : emptyLabel}
                </p>
              ) : null}
              {!immediate ? (
                <CompactMediaGrid
                  loading={loading}
                  assets={filtered}
                  userId={owner ?? ''}
                  locale={locale}
                  density={128}
                  selectedKeys={new Set(basket.map(picker.keyFor))}
                  getAssetKey={picker.keyFor}
                  getAssetName={(asset) => indexedNames.get(asset)!}
                  selectionMode={selection.onConfirmMany ? 'multiple' : 'single'}
                  selectionDisabledKeys={new Set(filtered.filter(isDisabled).map(picker.keyFor))}
                  disabled={busy}
                  onSelectionChange={(keys) => picker.changeLoaded(filtered, keys)}
                  onOpen={(asset) => void picker.confirmAsset(asset)}
                  openActionLabel={copy.add}
                  onPreview={(asset) => {
                    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                    setPreview(asset);
                  }}
                  renderAssetMeta={(asset) => (
                    <>
                      {renderAssetMeta?.(asset)}
                      {eligibility.get(asset) ? (
                        <span>{mediaInputEligibilityMessage(eligibility.get(asset)!, locale)}</span>
                      ) : null}
                    </>
                  )}
                />
              ) : (
                <ImmediateReferenceGrid
                  assets={filtered}
                  selectedIds={selection.selectedIds}
                  busy={busy}
                  isDisabled={isDisabled}
                  displayName={(asset) => indexedNames.get(asset)!}
                  onChoose={choose}
                  onPreview={(asset, trigger) => {
                    returnFocus.current = trigger;
                    setPreview(asset);
                  }}
                  locale={locale}
                  source={source}
                  sourceLabels={sourceLabels}
                  renderAssetMeta={renderAssetMeta}
                />
              )}
              {loadMoreControl}
            </>
          ) : (
            <>
              <p className="app-picker-empty">
                {query.trim()
                  ? emptySearchLabel
                  : selection.getEligibility && compatibility !== 'all' && assets.length > 0
                    ? copy.noCompatible
                    : emptyLabel}
              </p>
              {loadMoreControl}
            </>
          )}
        </div>
        <ReferencePickerFooter
          picker={picker}
          selection={selection}
          locale={locale}
          assets={assets}
          displayName={displayName}
          onClose={onClose}
        />
      </div>
    </>
  );
}
