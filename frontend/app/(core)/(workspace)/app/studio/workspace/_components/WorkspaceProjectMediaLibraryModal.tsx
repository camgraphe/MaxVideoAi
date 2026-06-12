'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Upload, X } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import styles from '../_styles/asset-library.module.css';
import { createUploadFailure, getUploadFailureMessage } from '../../../_lib/workspace-upload-errors';
import { WorkspaceAssetLibraryBrowser } from './WorkspaceAssetLibraryBrowser';
import type {
  WorkspaceLibraryKind,
  WorkspaceLibraryAsset,
  WorkspaceLibrarySource,
} from '../_lib/workspace-library-assets';
import {
  workspaceLibraryAssetFromUploadedAsset,
} from '../_lib/workspace-library-assets';
import type { StudioCopy } from '../../_lib/studio-copy';

type WorkspaceProjectMediaLibraryModalProps = {
  copy: StudioCopy['assetLibrary'];
  assets: WorkspaceLibraryAsset[];
  error: string | null;
  isLoading: boolean;
  isOpen: boolean;
  source: WorkspaceLibrarySource;
  sourceLabels: Record<WorkspaceLibrarySource, string>;
  sourceOptions: readonly WorkspaceLibrarySource[];
  usingFallback: boolean;
  onClose: () => void;
  onSelectAsset: (asset: WorkspaceLibraryAsset) => void;
  onSourceChange: (source: WorkspaceLibrarySource) => void;
};

const PROJECT_MEDIA_UPLOAD_ACCEPT = 'image/*,video/*,audio/*';

const PROJECT_MEDIA_UPLOAD_ENDPOINTS = {
  image: '/api/uploads/image',
  video: '/api/uploads/video',
  audio: '/api/uploads/audio',
} as const satisfies Record<WorkspaceLibraryKind, string>;

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function projectMediaUploadKindForFile(file: File): WorkspaceLibraryKind | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return null;
}

export function WorkspaceProjectMediaLibraryModal({
  copy,
  assets,
  error,
  isLoading,
  isOpen,
  source,
  sourceLabels,
  sourceOptions,
  usingFallback,
  onClose,
  onSelectAsset,
  onSourceChange,
}: WorkspaceProjectMediaLibraryModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = '';
      if (!file) return;

      const uploadKind = projectMediaUploadKindForFile(file);
      if (!uploadKind) {
        setUploadError(copy.invalidProjectMediaUpload);
        return;
      }

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
        const response = await authFetch(PROJECT_MEDIA_UPLOAD_ENDPOINTS[uploadKind], {
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
        onSelectAsset(uploadedAsset);
      } catch (uploadFailure) {
        setUploadError(getUploadFailureMessage(uploadKind, uploadFailure, fallback));
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
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className={styles.assetLibraryModal}>
        <input
          ref={uploadInputRef}
          type="file"
          accept={PROJECT_MEDIA_UPLOAD_ACCEPT}
          className={styles.assetLibraryUploadInput}
          hidden
          onChange={handleUploadChange}
        />
        <button type="button" className={styles.assetLibraryClose} onClick={onClose} aria-label={copy.closeProjectMediaLibrary}>
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
          onSelectAsset={onSelectAsset}
          headerActions={
            <button
              type="button"
              className={styles.assetLibraryUploadButton}
              disabled={isUploading}
              onClick={() => uploadInputRef.current?.click()}
            >
              <Upload size={14} />
              {isUploading ? copy.uploading : copy.upload}
            </button>
          }
          emptyLabel={copy.noProjectMedia}
        />
      </section>
    </div>
  );
}
