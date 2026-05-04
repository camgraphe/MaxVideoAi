'use client';

import clsx from 'clsx';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AssetLibraryBrowser } from '@/components/library/AssetLibraryBrowser';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import { translateError } from '@/lib/error-messages';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { normalizeUiLocale } from '@/lib/ltx-localization';

export type AssetLibrarySource = 'all' | 'upload' | 'generated' | 'character' | 'angle' | 'upscale';
export type AssetLibraryKind = 'image' | 'video';

export type UserAsset = {
  id: string;
  url: string;
  kind: 'image' | 'video' | 'audio';
  width?: number | null;
  height?: number | null;
  size?: number | null;
  mime?: string | null;
  source?: string | null;
  createdAt?: string;
  canDelete?: boolean;
};

export type AssetLibraryModalProps = {
  fieldLabel: string;
  assetType: AssetLibraryKind;
  assets: UserAsset[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (asset: UserAsset) => void;
  source: AssetLibrarySource;
  onSourceChange: (source: AssetLibrarySource) => void;
  onRefresh: (source?: AssetLibrarySource) => void;
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
  sourcesTitle: 'Library',
  toolsTitle: 'Create or transform',
  toolsDescription: 'Open another workspace to prepare a better source before importing it here.',
  emptySearch: 'No assets match this search.',
  empty: 'No saved images yet. Upload a reference image to see it here.',
  emptyUploads: 'No uploaded images yet. Upload a reference image to see it here.',
  emptyGenerated: 'No generated images saved yet. Save a generated image to see it here.',
  emptyCharacter: 'No character assets saved yet. Generate one in Character Builder first.',
  emptyAngle: 'No angle assets saved yet. Generate one in the Angle tool first.',
  emptyUpscale: 'No upscale assets saved yet. Save an upscale result first.',
  tabs: {
    all: 'All',
    upload: 'Uploaded',
    generated: 'Generated',
    character: 'Character',
    angle: 'Angle',
    upscale: 'Upscale',
  },
  shortcuts: {
    createImage: 'Create image',
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
  assetType,
  assets,
  isLoading,
  error,
  onClose,
  onSelect,
  source,
  onSourceChange,
  onRefresh,
  onDelete,
  deletingAssetId,
}: AssetLibraryModalProps) {
  const { t, locale } = useI18n();
  const uiLocale = normalizeUiLocale(locale);
  const rawCopy = t('workspace.generate.assetLibrary', DEFAULT_ASSET_LIBRARY_COPY);
  const copyAssetLibrary = useMemo(
    () => mergeCopy(DEFAULT_ASSET_LIBRARY_COPY, (rawCopy ?? {}) as Partial<typeof DEFAULT_ASSET_LIBRARY_COPY>),
    [rawCopy]
  );
  const importLabel = copyAssetLibrary.import ?? DEFAULT_ASSET_LIBRARY_COPY.import;
  const importingLabel = copyAssetLibrary.importing ?? DEFAULT_ASSET_LIBRARY_COPY.importing;
  const importFailedLabel = copyAssetLibrary.importFailed ?? DEFAULT_ASSET_LIBRARY_COPY.importFailed;
  const importAccept = assetType === 'video' ? 'video/*' : 'image/*';
  const importEndpoint = assetType === 'video' ? '/api/uploads/video' : '/api/uploads/image';
  const emptyLabel =
    source === 'generated'
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
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = '';
      if (!file) return;

      setImportError(null);
      setIsImporting(true);
      try {
        const preparedFile =
          assetType === 'image'
            ? await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 })
            : file;
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

        onSelect({
          id: uploadedAsset.id ?? `library_${Date.now().toString(36)}`,
          url: uploadedAsset.url,
          kind: assetType,
          width: uploadedAsset.width ?? null,
          height: uploadedAsset.height ?? null,
          size: uploadedAsset.size ?? null,
          mime: uploadedAsset.mime ?? null,
          canDelete: true,
        });
      } catch (error) {
        setImportError(getUploadFailureMessage(assetType, error, importFailedLabel));
      } finally {
        setIsImporting(false);
      }
    },
    [assetType, importEndpoint, importFailedLabel, onSelect]
  );

  const sourceOptions = assetType === 'video'
    ? (['all', 'upload', 'generated', 'upscale'] as const)
    : (['all', 'upload', 'generated', 'character', 'angle', 'upscale'] as const);
  const searchPlaceholder =
    copyAssetLibrary.searchPlaceholder ??
    (uiLocale === 'fr' ? 'Rechercher des assets...' : uiLocale === 'es' ? 'Buscar assets...' : 'Search assets...');
  const sourcesTitle =
    copyAssetLibrary.sourcesTitle ?? (uiLocale === 'fr' ? 'Bibliotheque' : uiLocale === 'es' ? 'Biblioteca' : 'Library');
  const toolsTitle =
    copyAssetLibrary.toolsTitle ??
    (uiLocale === 'fr' ? 'Creer ou transformer' : uiLocale === 'es' ? 'Crear o transformar' : 'Create or transform');
  const toolsDescription =
    copyAssetLibrary.toolsDescription ??
    (uiLocale === 'fr'
      ? "Ouvrez un autre workspace pour preparer une meilleure source avant de l'importer ici."
      : uiLocale === 'es'
        ? 'Abre otro workspace para preparar una mejor fuente antes de importarla aqui.'
        : 'Open another workspace to prepare a better source before importing it here.');
  const emptySearchLabel =
    copyAssetLibrary.emptySearch ??
    (uiLocale === 'fr' ? 'Aucun asset ne correspond a cette recherche.' : uiLocale === 'es' ? 'Ningun asset coincide con esta busqueda.' : 'No assets match this search.');
  const shortcutLabels = {
    createImage:
      copyAssetLibrary.shortcuts?.createImage ??
      (uiLocale === 'fr' ? 'Creer une image' : uiLocale === 'es' ? 'Crear imagen' : 'Create image'),
    changeAngle:
      copyAssetLibrary.shortcuts?.changeAngle ??
      (uiLocale === 'fr' ? "Changer l'angle" : uiLocale === 'es' ? 'Cambiar angulo' : 'Change angle'),
    characterBuilder:
      copyAssetLibrary.shortcuts?.characterBuilder ??
      (uiLocale === 'fr' ? 'Character Builder' : uiLocale === 'es' ? 'Character Builder' : 'Character builder'),
    upscale:
      copyAssetLibrary.shortcuts?.upscale ??
      (uiLocale === 'fr' ? 'Upscale' : uiLocale === 'es' ? 'Upscale' : 'Upscale'),
  };
  const browserToolLinks =
    assetType === 'image'
      ? [
          { href: '/app/image', label: shortcutLabels.createImage },
          { href: '/app/tools/angle', label: shortcutLabels.changeAngle },
          { href: '/app/tools/character-builder', label: shortcutLabels.characterBuilder },
          { href: '/app/tools/upscale', label: shortcutLabels.upscale },
        ]
      : [];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-surface-on-media-dark-50 px-2 py-2 backdrop-blur-sm sm:px-4 sm:py-4">
      <div className="absolute inset-0" role="presentation" onClick={onClose} />
      <input
        ref={importInputRef}
        type="file"
        accept={importAccept}
        className="sr-only"
        onChange={handleImportChange}
      />
      <AssetLibraryBrowser
        className="relative z-10 h-[92svh] max-w-[1240px] sm:h-[84vh]"
        title={copyAssetLibrary.title}
        subtitle={fieldLabel}
        onClose={onClose}
        closeLabel={copyAssetLibrary.close}
        assetType={assetType}
        assets={assets}
        isLoading={isLoading}
        error={importError ?? error}
        source={source}
        availableSources={[...sourceOptions]}
        sourceLabels={copyAssetLibrary.tabs}
        onSourceChange={onSourceChange}
        searchPlaceholder={searchPlaceholder}
        sourcesTitle={sourcesTitle}
        emptyLabel={emptyLabel ?? (assetType === 'video' ? 'No saved videos yet.' : 'No saved images yet.')}
        emptySearchLabel={emptySearchLabel}
        toolsTitle={assetType === 'image' ? toolsTitle : undefined}
        toolsDescription={assetType === 'image' ? toolsDescription : undefined}
        toolLinks={browserToolLinks}
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
        renderAssetActions={(asset) => {
          const isDeleting = deletingAssetId === asset.id;
          const canDelete = asset.canDelete !== false && !asset.id.startsWith('job:');
          return (
            <>
              {canDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={clsx(
                    'min-h-[34px] flex-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-micro focus-visible:ring-error-border sm:min-h-[36px] sm:flex-none sm:px-3 sm:text-[12px]',
                    isDeleting
                      ? 'border-error-border bg-error-bg text-error opacity-70'
                      : 'border-error-border bg-error-bg text-error hover:border-error-border hover:bg-error-bg'
                  )}
                  onClick={() => {
                    const result = onDelete(asset);
                    if (result && typeof result.then === 'function') {
                      void result.catch(() => {
                        // errors handled upstream
                      });
                    }
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={() => onSelect(asset)}
                disabled={isDeleting}
                variant="primary"
                size="sm"
                className={clsx(
                  'min-h-[34px] flex-1 rounded-full border-brand px-2.5 py-1 text-[11px] uppercase tracking-micro sm:min-h-[36px] sm:flex-none sm:px-3 sm:text-[12px]',
                  isDeleting ? 'opacity-60' : 'hover:bg-brandHover'
                )}
              >
                Use
              </Button>
            </>
          );
        }}
      />
    </div>
  );
}
