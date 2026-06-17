'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { Upload, X } from 'lucide-react';
import styles from '../_styles/asset-library.module.css';
import { WorkspaceAssetLibraryBrowser } from './WorkspaceAssetLibraryBrowser';
import { patchWorkspaceEditorAssetLibraryCache } from '../_hooks/useWorkspaceEditorAssetLibrary';
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
import type { StudioCopy } from '../../_lib/studio-copy';

type WorkspaceLibraryKindFilter = 'all' | WorkspaceLibraryKind;

type WorkspaceProjectMediaLibraryModalProps = {
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
  onMediaKindFilterChange: (kind: WorkspaceLibraryKindFilter) => void;
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
  onMediaKindFilterChange,
  onSelectAsset,
  onSelectAssets,
  onSourceChange,
}: WorkspaceProjectMediaLibraryModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [lastSelectedAssetId, setLastSelectedAssetId] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const selectedAssets = useMemo(
    () => selectedAssetIds.map((assetId) => assetById.get(assetId)).filter((asset): asset is WorkspaceLibraryAsset => Boolean(asset)),
    [assetById, selectedAssetIds]
  );

  useEffect(() => {
    if (!isOpen) {
      setSelectedAssetIds([]);
      setLastSelectedAssetId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedAssetIds([]);
    setLastSelectedAssetId(null);
  }, [mediaKindFilter, source]);

  const closeAndResetSelection = useCallback(() => {
    setSelectedAssetIds([]);
    setLastSelectedAssetId(null);
    onClose();
  }, [onClose]);

  const handleToggleAssetSelection = useCallback(
    (
      asset: WorkspaceLibraryAsset,
      event: MouseEvent<HTMLButtonElement>,
      visibleAssets: WorkspaceLibraryAsset[]
    ) => {
      setSelectedAssetIds((current) => {
        const next = new Set(current);
        if (event.shiftKey && lastSelectedAssetId) {
          const visibleIds = visibleAssets.map((visibleAsset) => visibleAsset.id);
          const startIndex = visibleIds.indexOf(lastSelectedAssetId);
          const endIndex = visibleIds.indexOf(asset.id);
          if (startIndex !== -1 && endIndex !== -1) {
            const [start, end] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
            visibleIds.slice(start, end + 1).forEach((assetId) => next.add(assetId));
            return Array.from(next);
          }
        }
        if (next.has(asset.id)) next.delete(asset.id);
        else next.add(asset.id);
        return Array.from(next);
      });
      setLastSelectedAssetId(asset.id);
    },
    [lastSelectedAssetId]
  );

  const handleImportSelectedAssets = useCallback(() => {
    if (!selectedAssets.length) return;
    onSelectAssets(selectedAssets);
    setSelectedAssetIds([]);
    setLastSelectedAssetId(null);
  }, [onSelectAssets, selectedAssets]);

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
      try {
        const uploadedAsset = await uploadWorkspaceProjectMediaFile(file, fallback);
        patchWorkspaceEditorAssetLibraryCache(uploadedAsset);
        onSourceChange('upload');
        onSelectAsset(uploadedAsset);
      } catch {
        setUploadError(fallback);
      } finally {
        setIsUploading(false);
      }
    },
    [copy, onSelectAsset, onSourceChange]
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
          selectedAssetIds={selectedAssetIds}
          onToggleAssetSelection={handleToggleAssetSelection}
          mediaKindFilter={mediaKindFilter}
          onMediaKindFilterChange={onMediaKindFilterChange}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadMore}
          headerActions={
            <>
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
