'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Upload, X } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import styles from '../_styles/asset-library.module.css';
import { createUploadFailure, getUploadFailureMessage } from '../../../_lib/workspace-upload-errors';
import { WorkspaceAssetLibraryBrowser } from './WorkspaceAssetLibraryBrowser';
import type { WorkspaceGraphNode } from '../_lib/workspace-types';
import type {
  WorkspaceLibraryAsset,
  WorkspaceLibrarySource,
} from '../_lib/workspace-library-assets';
import {
  workspaceLibraryAssetFromUploadedAsset,
  workspaceLibraryKindForNodeKind,
  workspaceUploadAcceptForNodeKind,
  workspaceUploadEndpointForNodeKind,
} from '../_lib/workspace-library-assets';
import type { StudioCopy } from '../../_lib/studio-copy';

type WorkspaceAssetLibraryModalProps = {
  copy: StudioCopy['assetLibrary'];
  node: WorkspaceGraphNode | null;
  assets: WorkspaceLibraryAsset[];
  isLoading: boolean;
  error: string | null;
  usingFallback: boolean;
  source: WorkspaceLibrarySource;
  sourceOptions: readonly WorkspaceLibrarySource[];
  sourceLabels: Record<WorkspaceLibrarySource, string>;
  onClose: () => void;
  onSelectAsset: (nodeId: string, asset: WorkspaceLibraryAsset) => void;
  onSourceChange: (source: WorkspaceLibrarySource) => void;
};

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function assetTypeLabel(kind: WorkspaceGraphNode['data']['kind'], copy: StudioCopy['assetLibrary']): string {
  if (kind === 'asset-image') return copy.image;
  if (kind === 'asset-video') return copy.video;
  if (kind === 'asset-audio') return copy.audio;
  return copy.asset;
}

export function WorkspaceAssetLibraryModal({
  copy,
  node,
  assets,
  isLoading,
  error,
  usingFallback,
  source,
  sourceOptions,
  sourceLabels,
  onClose,
  onSelectAsset,
  onSourceChange,
}: WorkspaceAssetLibraryModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const nodeKind = node?.data.kind ?? null;
  const uploadKind = nodeKind ? workspaceLibraryKindForNodeKind(nodeKind) : null;
  const uploadEndpoint = nodeKind ? workspaceUploadEndpointForNodeKind(nodeKind) : null;
  const uploadAccept = nodeKind ? workspaceUploadAcceptForNodeKind(nodeKind) : undefined;

  const handleUploadChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = '';
      if (!file || !node || !uploadKind || !uploadEndpoint) return;

      const fallback = formatCopyValue(copy.uploadFailed, { kind: uploadKind });
      setUploadError(null);
      setIsUploading(true);
      try {
        const preparedFile =
          uploadKind === 'image'
            ? await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 })
            : file;
        const formData = new FormData();
        formData.append('file', preparedFile, preparedFile.name);
        const response = await authFetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          asset?: unknown;
          error?: unknown;
          maxMB?: unknown;
        } | null;
        const uploadedAsset = workspaceLibraryAssetFromUploadedAsset(payload?.asset, uploadKind);
        if (!response.ok || !payload?.ok || !uploadedAsset) {
          throw createUploadFailure(uploadKind, response.status, payload, fallback);
        }

        onSourceChange('upload');
        onSelectAsset(node.id, uploadedAsset);
      } catch (error) {
        setUploadError(getUploadFailureMessage(uploadKind, error, fallback));
      } finally {
        setIsUploading(false);
      }
    },
    [copy.uploadFailed, node, onSelectAsset, onSourceChange, uploadEndpoint, uploadKind]
  );

  if (!node) return null;
  const typeLabel = assetTypeLabel(node.data.kind, copy);

  return (
    <div
      className={styles.assetLibraryOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={formatCopyValue(copy.selectAsset, { type: typeLabel })}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className={styles.assetLibraryModal}>
        <input
          ref={uploadInputRef}
          type="file"
          accept={uploadAccept}
          className={styles.assetLibraryUploadInput}
          hidden
          onChange={handleUploadChange}
        />
        <button type="button" className={styles.assetLibraryClose} onClick={onClose} aria-label={copy.closeLibrary}>
          <X size={16} />
        </button>

        <WorkspaceAssetLibraryBrowser
          copy={copy}
          title={copy.library}
          subtitle={formatCopyValue(copy.selectForNode, { type: typeLabel, node: node.data.title })}
          layout="modal"
          assets={assets}
          isLoading={isLoading}
          error={uploadError ?? error}
          usingFallback={usingFallback}
          source={source}
          sourceOptions={sourceOptions}
          sourceLabels={sourceLabels}
          onSourceChange={onSourceChange}
          onSelectAsset={(asset) => onSelectAsset(node.id, asset)}
          headerActions={
            uploadEndpoint ? (
              <button
                type="button"
                className={styles.assetLibraryUploadButton}
                disabled={isUploading}
                onClick={() => uploadInputRef.current?.click()}
              >
                <Upload size={14} />
                {isUploading ? copy.uploading : copy.upload}
              </button>
            ) : null
          }
        />
      </section>
    </div>
  );
}
