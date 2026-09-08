'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { Upload, X } from 'lucide-react';
import styles from '../_styles/asset-library.module.css';
import { WorkspaceAssetLibraryBrowser } from './WorkspaceAssetLibraryBrowser';
import { patchWorkspaceEditorAssetLibraryCache } from '../_hooks/useWorkspaceEditorAssetLibrary';
import { resolveWorkspaceMediaSelection } from '../_lib/workspace-media-selection';
import { useStudioMediaIntent } from '../_hooks/useStudioMediaIntent';
import type {
  WorkspaceLibraryAsset,
  WorkspaceLibraryKind,
  WorkspaceLibrarySource,
} from '../_lib/workspace-library-assets';
import {
  WORKSPACE_PROJECT_MEDIA_UPLOAD_ACCEPT,
  uploadWorkspaceProjectMediaFile,
  workspaceProjectMediaUploadKindForFile,
} from '../_lib/workspace-project-media-upload';
import {
  resetWorkspaceAssetSelection,
  selectWorkspaceAsset,
} from '../_lib/workspace-asset-selection';
import type { StudioCopy } from '../../_lib/studio-copy';

type WorkspaceLibraryKindFilter = 'all' | WorkspaceLibraryKind;

type WorkspaceProjectMediaLibraryModalProps = {
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  copy: StudioCopy['assetLibrary'];
  assets: WorkspaceLibraryAsset[];
  error: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isOpen: boolean;
  mediaKindFilter: WorkspaceLibraryKindFilter;
  source: WorkspaceLibrarySource;
  sourceLabels: Record<WorkspaceLibrarySource, string>;
  sourceOptions: readonly WorkspaceLibrarySource[];
  usingFallback: boolean;
  onClose: () => void;
  onLoadMore: () => void;
  onRetry?: () => void;
  onMediaKindFilterChange: (kind: WorkspaceLibraryKindFilter) => void;
  insertAtPlayheadLabel: string;
  onInsertAsset: (asset: WorkspaceLibraryAsset) => void;
  onSelectAsset: (asset: WorkspaceLibraryAsset) => void;
  onSelectAssets: (assets: WorkspaceLibraryAsset[]) => void;
  onSourceChange: (source: WorkspaceLibrarySource) => void;
};

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

export function WorkspaceProjectMediaLibraryModal({
  searchQuery,
  onSearchQueryChange,
  copy,
  assets,
  error,
  hasMore,
  isLoading,
  isLoadingMore,
  isOpen,
  mediaKindFilter,
  source,
  sourceLabels,
  sourceOptions,
  usingFallback,
  onClose,
  onLoadMore,
  onRetry,
  onMediaKindFilterChange,
  insertAtPlayheadLabel,
  onInsertAsset,
  onSelectAsset,
  onSelectAssets,
  onSourceChange,
}: WorkspaceProjectMediaLibraryModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selection, setSelection] = useState(resetWorkspaceAssetSelection);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const mediaScope = JSON.stringify([isOpen, mediaKindFilter, source, searchQuery]);
  const intent = useStudioMediaIntent(mediaScope);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const selectedAssets = useMemo(
    () => selection.selectedAssetIds.map((assetId) => assetById.get(assetId)).filter((asset): asset is WorkspaceLibraryAsset => Boolean(asset)),
    [assetById, selection.selectedAssetIds]
  );

  useEffect(() => {
    if (!isOpen) {
      setSelection(resetWorkspaceAssetSelection());
    }
  }, [isOpen]);

  useEffect(() => {
    setSelection(resetWorkspaceAssetSelection());
    setIsUploading(false);
    setUploadError(null);
  }, [mediaScope]);

  const closeAndResetSelection = useCallback(() => {
    intent.cancel();
    setSelection(resetWorkspaceAssetSelection());
    onClose();
  }, [intent, onClose]);

  const handleToggleAssetSelection = useCallback(
    (
      asset: WorkspaceLibraryAsset,
      event: MouseEvent<HTMLButtonElement>,
      visibleAssets: WorkspaceLibraryAsset[]
    ) => {
      const mode = event.shiftKey ? 'range' : event.metaKey || event.ctrlKey ? 'toggle' : 'replace';
      setSelection((current) => selectWorkspaceAsset({
        assetIds: visibleAssets.map((visibleAsset) => visibleAsset.id),
        selection: current,
        assetId: asset.id,
        mode,
      }));
    },
    []
  );

  const handleImportSelectedAssets = useCallback(async () => {
    if (!selectedAssets.length) return;
    const isCurrent = intent.begin();
    try {
      const resolved = await resolveWorkspaceMediaSelection(selectedAssets);
      if (!isCurrent()) return;
      onSelectAssets(resolved);
      setSelection(resetWorkspaceAssetSelection());
    } catch { if (isCurrent()) setUploadError(copy.unableToLoadLibrary); }
  }, [copy.unableToLoadLibrary, intent, onSelectAssets, selectedAssets]);

  const handleInsertSelectedAsset = useCallback(async () => {
    if (selectedAssets.length !== 1) return;
    const isCurrent = intent.begin();
    try {
      const [resolved] = await resolveWorkspaceMediaSelection(selectedAssets);
      if (!isCurrent() || !resolved) return;
      onInsertAsset(resolved);
      setSelection(resetWorkspaceAssetSelection());
    } catch { if (isCurrent()) setUploadError(copy.unableToLoadLibrary); }
  }, [copy.unableToLoadLibrary, intent, onInsertAsset, selectedAssets]);

  const handleUploadChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = '';
      if (!file) return;

      const uploadKind = workspaceProjectMediaUploadKindForFile(file);
      if (!uploadKind) {
        setUploadError(copy.invalidProjectMediaUpload);
        return;
      }

      const fallback = formatCopyValue(copy.uploadFailed, { kind: uploadKind });
      setUploadError(null);
      setIsUploading(true);
      const isCurrent = intent.begin();
      try {
        const uploadedAsset = await uploadWorkspaceProjectMediaFile(file, fallback);
        if (!isCurrent()) return;
        const [resolved] = await resolveWorkspaceMediaSelection([uploadedAsset]);
        if (!isCurrent()) return;
        patchWorkspaceEditorAssetLibraryCache(uploadedAsset);
        onSelectAsset(resolved);
      } catch {
        if (isCurrent()) setUploadError(fallback);
      } finally {
        if (isCurrent()) setIsUploading(false);
      }
    },
    [copy, intent, onSelectAsset]
  );

  if (!isOpen) return null;

  return (
    <div
      className={styles.assetLibraryOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={copy.importProjectMedia}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeAndResetSelection();
      }}
    >
      <section className={styles.assetLibraryModal}>
        <input
          ref={uploadInputRef}
          type="file"
          accept={WORKSPACE_PROJECT_MEDIA_UPLOAD_ACCEPT}
          className={styles.assetLibraryUploadInput}
          hidden
          onChange={handleUploadChange}
        />
        <button type="button" className={styles.assetLibraryClose} onClick={closeAndResetSelection} aria-label={copy.closeProjectMediaLibrary}>
          <X size={16} />
        </button>
        <WorkspaceAssetLibraryBrowser
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          copy={copy}
          title={copy.library}
          subtitle={copy.importProjectMediaSubtitle}
          layout="modal"
          assets={assets}
          isLoading={isLoading}
          error={uploadError ?? error}
          usingFallback={usingFallback}
          source={source}
          sourceOptions={sourceOptions}
          sourceLabels={sourceLabels}
          onSourceChange={onSourceChange}
          selectedAssetIds={selection.selectedAssetIds}
          onToggleAssetSelection={handleToggleAssetSelection}
          mediaKindFilter={mediaKindFilter}
          onMediaKindFilterChange={onMediaKindFilterChange}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadMore}
          headerActions={
            <>
              {error && onRetry ? <button type="button" onClick={onRetry}>{copy.retryLibrary}</button> : null}
              <button
                type="button"
                className={styles.assetLibraryImportSelectedButton}
                disabled={selectedAssets.length !== 1}
                onClick={handleInsertSelectedAsset}
              >
                {insertAtPlayheadLabel}
              </button>
              <button
                type="button"
                className={styles.assetLibraryImportSelectedButton}
                disabled={!selectedAssets.length}
                onClick={handleImportSelectedAssets}
              >
                {selectedAssets.length ? `${copy.importSelected} (${selectedAssets.length})` : copy.importSelected}
              </button>
              <button
                type="button"
                className={styles.assetLibraryUploadButton}
                disabled={isUploading}
                onClick={() => uploadInputRef.current?.click()}
              >
                <Upload size={14} />
                {isUploading ? copy.uploading : copy.upload}
              </button>
            </>
          }
          emptyLabel={copy.noProjectMedia}
        />
      </section>
    </div>
  );
}
