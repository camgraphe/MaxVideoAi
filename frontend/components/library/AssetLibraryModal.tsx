'use client';

import { createPortal } from 'react-dom';
import { referencePickerCopy } from './reference-picker-copy';
import { workspaceReferenceCopy } from '@/components/composer/workspace-reference-copy';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { assetLibraryLocaleDefaults, assetLibraryActionsCopy } from './asset-library-copy';
import type { ChangeEvent } from 'react';
import { AssetLibraryBrowser } from '@/components/library/AssetLibraryBrowser';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import { uploadVideoFile } from '@/lib/client-video-upload';
import { translateError } from '@/lib/error-messages';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { normalizeUiLocale } from '@/lib/ltx-localization';

export type AssetLibrarySource =
  | 'all'
  | 'upload'
  | 'generated'
  | 'recent'
  | 'storyboard'
  | 'character'
  | 'angle'
  | 'upscale';
export type AssetLibraryKind = 'image' | 'video';

export type UserAsset = {
  id: string;
  url: string;
  thumbUrl?: string | null;
  previewUrl?: string | null;
  kind: 'image' | 'video' | 'audio';
  width?: number | null;
  height?: number | null;
  size?: number | null;
  mime?: string | null;
  source?: string | null;
  createdAt?: string;
  canDelete?: boolean;
  jobId?: string | null;
  sourceOutputId?: string | null;
};

export type AssetLibraryModalProps = {
  fieldLabel: string;
  target?: { scope: string; role?: 'start' | 'end'; capacity?: number; slotIndex?: number };
  assetType: AssetLibraryKind;
  assets: UserAsset[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (asset: UserAsset) => void | string | Promise<void | string>;
  source: AssetLibrarySource;
  onSourceChange: (source: AssetLibrarySource) => void;
  onRefresh: (source?: AssetLibrarySource) => void;
  onLoadMore?: () => void;
  onDelete: (asset: UserAsset) => Promise<void> | void;
  deletingAssetId: string | null;
};

type UploadFailurePayload = { error?: unknown; maxMB?: unknown } | null;
type UploadFailure = Error & {
  code?: string;
  maxMB?: number;
  status?: number;
  assetType?: AssetLibraryKind;
};

const DEFAULT_ASSET_LIBRARY_COPY = {
  title: 'Select asset',
  searchPlaceholder: 'Search assets...',
  import: 'Import',
  importing: 'Importing...',
  importFailed: 'Import failed. Please try again.',
  refresh: 'Refresh',
  close: 'Close',
  fieldFallback: 'Asset',
  sourcesTitle: 'Media',
  toolsTitle: 'Create or transform',
  toolsDescription: 'Open another workspace to prepare a better source before importing it here.',
  emptySearch: 'No assets match this search.',
  empty: 'No saved images yet. Upload a reference image to see it here.',
  emptyUploads: 'No uploaded images yet. Upload a reference image to see it here.',
  emptyGenerated: 'No generated images saved yet. Save a generated image to see it here.',
  emptyRecent: 'No recent outputs yet. Run a generation to reuse an output here.',
  emptyStoryboard: 'No storyboard assets saved yet. Save a storyboard image to see it here.',
  emptyCharacter: 'No character assets saved yet. Generate one in Character Builder first.',
  emptyAngle: 'No angle assets saved yet. Generate one in the Angle tool first.',
  emptyUpscale: 'No upscale assets saved yet. Save an upscale result first.',
  tabs: {
    all: 'All',
    upload: 'Uploaded',
    generated: 'Generated',
    recent: 'Recent outputs',
    storyboard: 'Storyboard',
    character: 'Character',
    angle: 'Angle',
    upscale: 'Upscale',
  },
  shortcuts: {
    createImage: 'Create image',
    storyboard: 'Storyboard',
    changeAngle: 'Change angle',
    characterBuilder: 'Character builder',
    upscale: 'Upscale',
  },
} as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeCopy<T extends Record<string, unknown>>(defaults: T, overrides?: Partial<T> | null): T {
  if (!isPlainRecord(overrides)) return defaults;
  const next: Record<string, unknown> = { ...defaults };
  Object.entries(overrides).forEach(([key, overrideValue]) => {
    const defaultValue = next[key];
    if (isPlainRecord(defaultValue) && isPlainRecord(overrideValue)) {
      next[key] = mergeCopy(defaultValue, overrideValue);
      return;
    }
    if (overrideValue !== undefined) {
      next[key] = overrideValue;
    }
  });
  return next as T;
}

function resolveUploadErrorMessage(
  assetType: AssetLibraryKind,
  status: number,
  errorCode: unknown,
  fallback: string,
  maxMB?: number
): string {
  if (assetType === 'image') {
    return translateError({
      code: typeof errorCode === 'string' ? errorCode : null,
      status,
      message: fallback,
    }).message;
  }
  const normalizedCode = typeof errorCode === 'string' ? errorCode.trim().toUpperCase() : null;
  const sizeLimit =
    typeof maxMB === 'number' && Number.isFinite(maxMB) && maxMB > 0 ? `${Math.round(maxMB)} MB` : 'the upload limit';

  switch (normalizedCode) {
    case 'FILE_TOO_LARGE':
      return `This video is too large to import. Keep each reference video under ${sizeLimit} and try again.`;
    case 'UNSUPPORTED_TYPE':
      return 'This video format could not be imported. Use a standard MP4 or MOV file and try again.';
    case 'EMPTY_FILE':
      return 'This video file appears to be empty. Export it again from your device and retry.';
    case 'UNAUTHORIZED':
      return 'Your session expired before the video upload could start. Sign in again and retry.';
    case 'UPLOAD_FAILED':
    case 'STORE_FAILED':
      return 'The video reached the server but could not be stored. Please retry in a moment.';
    default:
      break;
  }

  if (status === 401) {
    return 'Your session expired before the upload could start. Sign in again and retry.';
  }
  if (status === 413) {
    return `This file is too large to import. Keep it under ${sizeLimit} and try again.`;
  }
  if (typeof errorCode === 'string' && errorCode.trim().length > 0) {
    return errorCode;
  }
  return fallback;
}

function createUploadFailure(
  assetType: AssetLibraryKind,
  status: number,
  payload: UploadFailurePayload,
  fallback: string
): UploadFailure {
  const code = typeof payload?.error === 'string' ? payload.error : undefined;
  const maxMB = typeof payload?.maxMB === 'number' && Number.isFinite(payload.maxMB) ? payload.maxMB : undefined;
  const error = new Error(resolveUploadErrorMessage(assetType, status, code, fallback, maxMB)) as UploadFailure;
  error.code = code;
  error.maxMB = maxMB;
  error.status = status;
  error.assetType = assetType;
  return error;
}

function getUploadFailureMessage(assetType: AssetLibraryKind, error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const uploadError = error as UploadFailure;
    if (uploadError.code || uploadError.status || uploadError.maxMB) {
      return resolveUploadErrorMessage(
        assetType,
        uploadError.status ?? 0,
        uploadError.code ?? uploadError.message,
        fallback,
        uploadError.maxMB
      );
    }
    if (uploadError.name === 'AbortError') {
      return 'The upload was interrupted before it completed. Please try again.';
    }
    if (
      uploadError.message === 'Failed to fetch' ||
      uploadError.message === 'Network request failed' ||
      uploadError.message === 'NetworkError when attempting to fetch resource.'
    ) {
      return 'The upload could not reach the server. Check your connection and try again.';
    }
    return uploadError.message || fallback;
  }
  return fallback;
}

export function AssetLibraryModal({
  fieldLabel,
  target,
  assetType,
  assets,
  isLoading,
  isLoadingMore = false,
  hasMore = false,
  error,
  onClose,
  onSelect,
  source,
  onSourceChange,
  onRefresh,
  onLoadMore,
}: AssetLibraryModalProps) {
  const { t, locale } = useI18n();
  const uiLocale = normalizeUiLocale(locale);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const busy = isSelecting || isImporting;
  const handleClose = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose: handleClose, closeDisabled: busy });
  const pickerCopy = referencePickerCopy(uiLocale);
  const referenceCopy = workspaceReferenceCopy(uiLocale);
  const titleId = useId();
  const actionCopy = assetLibraryActionsCopy(uiLocale);
  const rawCopy = t('workspace.generate.assetLibrary', {});
  const copyAssetLibrary = useMemo(
    () => mergeCopy({ ...DEFAULT_ASSET_LIBRARY_COPY, ...assetLibraryLocaleDefaults(uiLocale), tabs: { ...DEFAULT_ASSET_LIBRARY_COPY.tabs, ...assetLibraryLocaleDefaults(uiLocale).tabs } }, rawCopy ?? {}),
    [rawCopy, uiLocale]
  );
  const importLabel = copyAssetLibrary.import ?? DEFAULT_ASSET_LIBRARY_COPY.import;
  const importingLabel = copyAssetLibrary.importing ?? DEFAULT_ASSET_LIBRARY_COPY.importing;
  const importFailedLabel = copyAssetLibrary.importFailed ?? DEFAULT_ASSET_LIBRARY_COPY.importFailed;
  const importAccept = assetType === 'video' ? 'video/*' : 'image/*';
  const importEndpoint = assetType === 'video' ? '/api/uploads/video' : '/api/uploads/image';
  const emptyLabel =
    source === 'recent'
      ? assetType === 'video'
        ? uiLocale === 'fr'
          ? "Aucune sortie recente pour l'instant. Lancez un rendu pour reutiliser une video ici."
          : uiLocale === 'es'
            ? 'Aun no hay salidas recientes. Renderiza un video para reutilizarlo aqui.'
            : copyAssetLibrary.emptyRecent
        : copyAssetLibrary.emptyRecent
    : source === 'generated'
      ? assetType === 'video'
        ? uiLocale === 'fr'
          ? "Aucune video generee pour l'instant. Lancez un rendu video pour la reutiliser ici."
          : uiLocale === 'es'
            ? 'Aun no hay videos generados. Renderiza un video para reutilizarlo aqui.'
            : 'No generated videos yet. Render a video to reuse it here.'
        : copyAssetLibrary.emptyGenerated
      : source === 'upload'
        ? assetType === 'video'
          ? uiLocale === 'fr'
            ? "Aucune video uploadee pour l'instant. Importez une video source pour la voir ici."
            : uiLocale === 'es'
              ? 'Aun no hay videos subidos. Sube un video fuente para verlo aqui.'
              : 'No uploaded videos yet. Upload a source video to see it here.'
          : copyAssetLibrary.emptyUploads
        : source === 'storyboard'
          ? copyAssetLibrary.emptyStoryboard
          : source === 'character'
            ? copyAssetLibrary.emptyCharacter
            : source === 'angle'
              ? copyAssetLibrary.emptyAngle
              : source === 'upscale'
                ? copyAssetLibrary.emptyUpscale
                : assetType === 'video'
                  ? uiLocale === 'fr'
                    ? "Aucune video enregistree pour l'instant. Importez ou generez une video pour la voir ici."
                    : uiLocale === 'es'
                      ? 'Aun no hay videos guardados. Sube o genera un video para verlo aqui.'
                      : 'No saved videos yet. Upload or generate a video to see it here.'
                  : copyAssetLibrary.empty;
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const handleImportChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = '';
      if (!file) return;

      setImportError(null);
      setIsImporting(true);
      try {
        if (assetType === 'video') {
          const uploadedAsset = await uploadVideoFile(file);
          if (!mounted.current) return;
          const selectionError = await onSelect({
            id: uploadedAsset.id,
            url: uploadedAsset.url,
            thumbUrl: uploadedAsset.thumbUrl ?? null,
            previewUrl: null,
            kind: 'video',
            width: uploadedAsset.width ?? null,
            height: uploadedAsset.height ?? null,
            size: uploadedAsset.size ?? null,
            mime: uploadedAsset.mime ?? null,
            canDelete: true,
          });
          if (typeof selectionError === 'string') setImportError(selectionError);
          return;
        }

        const preparedFile =
          await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 });
        const formData = new FormData();
        formData.append('file', preparedFile, preparedFile.name);
        const response = await authFetch(importEndpoint, {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.asset?.url) {
          throw createUploadFailure(assetType, response.status, payload, importFailedLabel);
        }

        const uploadedAsset = payload.asset as {
          id?: string;
          url: string;
          width?: number | null;
          height?: number | null;
          size?: number | null;
          mime?: string | null;
        };

        if (!mounted.current) return;
        const selectionError = await onSelect({
          id: uploadedAsset.id ?? `library_${Date.now().toString(36)}`,
          url: uploadedAsset.url,
          thumbUrl: null,
          previewUrl: null,
          kind: assetType,
          width: uploadedAsset.width ?? null,
          height: uploadedAsset.height ?? null,
          size: uploadedAsset.size ?? null,
          mime: uploadedAsset.mime ?? null,
          canDelete: true,
        });
        if (typeof selectionError === 'string') setImportError(selectionError);
      } catch (error) {
        setImportError(getUploadFailureMessage(assetType, error, importFailedLabel));
      } finally {
        setIsImporting(false);
      }
    },
    [assetType, importEndpoint, importFailedLabel, onSelect]
  );

  const sourceOptions = assetType === 'video'
    ? (['all', 'upload', 'recent', 'generated', 'upscale'] as const)
    : (['all', 'upload', 'generated', 'storyboard', 'character', 'angle', 'upscale'] as const);
  const libraryTitle =
    assetType === 'video'
      ? (uiLocale === 'fr'
          ? 'Selectionner une video de reference'
          : uiLocale === 'es'
            ? 'Seleccionar video de referencia'
            : 'Select reference video')
      : copyAssetLibrary.title;
  const searchPlaceholder =
    copyAssetLibrary.searchPlaceholder ??
    (uiLocale === 'fr' ? 'Rechercher des assets...' : uiLocale === 'es' ? 'Buscar assets...' : 'Search assets...');
  const sourcesTitle =
    copyAssetLibrary.sourcesTitle ?? (uiLocale === 'fr' ? 'Médias' : uiLocale === 'es' ? 'Medios' : 'Media');
  const loadMoreLabel = t(
    'workspace.library.browser.loadMore',
    uiLocale === 'fr' ? 'Afficher plus' : uiLocale === 'es' ? 'Mostrar más' : 'Load more'
  ) as string;
  const emptySearchLabel =
    copyAssetLibrary.emptySearch ??
    (uiLocale === 'fr' ? 'Aucun asset ne correspond a cette recherche.' : uiLocale === 'es' ? 'Ningun asset coincide con esta busqueda.' : 'No assets match this search.');
  return createPortal(
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onDialogKeyDown} className="app-experience app-library-picker-layer">
      <div className="absolute inset-0" role="presentation" onClick={handleClose} />
      <input
        ref={importInputRef}
        type="file"
        accept={importAccept}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleImportChange}
      />
      <AssetLibraryBrowser
        locale={uiLocale}
        selection={{ scope: target?.scope ?? fieldLabel, busy, onBusyChange: setIsSelecting, onConfirm: onSelect }}
        headingId={titleId}
        title={target?.role ? referenceCopy[target.role] : libraryTitle}
        subtitle={[!target?.role ? referenceCopy.kinds[assetType] : null, target?.slotIndex != null && (target?.capacity ?? 1) > 1 ? `${pickerCopy.slot} ${target.slotIndex + 1}` : null, (target?.capacity ?? 1) > 1 ? `${pickerCopy.capacity} ${target?.capacity}` : null].filter(Boolean).join(' · ')}
        onClose={handleClose}
        closeLabel={copyAssetLibrary.close}
        assetType={assetType}
        assets={assets}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={importError ?? (error ? actionCopy.loadError : null)}
        source={source}
        availableSources={[...sourceOptions]}
        sourceLabels={copyAssetLibrary.tabs}
        onSourceChange={onSourceChange}
        onLoadMore={onLoadMore}
        loadMoreLabel={loadMoreLabel}
        searchPlaceholder={searchPlaceholder}
        sourcesTitle={sourcesTitle}
        emptyLabel={emptyLabel ?? (assetType === 'video' ? 'No saved videos yet.' : 'No saved images yet.')}
        emptySearchLabel={emptySearchLabel}
        headerActions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full border-border bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
              disabled={isImporting}
              onClick={() => importInputRef.current?.click()}
            >
              {isImporting ? importingLabel : importLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full border-border bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
              onClick={() => onRefresh(source)}
            >
              {copyAssetLibrary.refresh}
            </Button>
          </>
        }
        renderAssetActions={() => null}
      />
    </div>, document.body
  );
}
