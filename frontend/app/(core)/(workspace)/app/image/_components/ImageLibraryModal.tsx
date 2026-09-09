'use client';

import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { referencePickerCopy } from '@/components/library/reference-picker-copy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import type { AssetLibraryBrowserProps, AssetLibrarySource } from '@/components/library/AssetLibraryBrowser';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { Button } from '@/components/ui/Button';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import { translateError } from '@/lib/error-messages';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { normalizeUiLocale } from '@/lib/ltx-localization';
import { authFetch } from '@/lib/authFetch';
import {
  inferImageFormatFromUrl,
  isSupportedImageFormat,
  isSupportedImageMime,
} from '@/lib/image/formats';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useImageLibraryData } from '../_hooks/useImageLibraryData';
import type {
  CharacterReferenceSelection,
} from '@/types/image-generation';
import {
  formatCharacterReferenceDate,
  getCharacterReferenceLabel,
} from '../_lib/image-workspace-character-references';
import {
  DEFAULT_COPY,
  formatTemplate,
  type ImageWorkspaceCopy,
} from '../_lib/image-workspace-copy';
import {
  DEFAULT_UPLOAD_LIMIT_MB,
  type LibraryAsset,
} from '../_lib/image-workspace-types';

const AssetLibraryBrowser = dynamic<AssetLibraryBrowserProps>(
  () => import('@/components/library/AssetLibraryBrowser').then((mod) => mod.AssetLibraryBrowser),
  { ssr: false }
);

export type ImageLibraryModalProps = {
  open: boolean;
  target?: { scope: string; capacity?: number; slotIndex?: number | null };
  onClose: () => void;
  onSelect: (asset: LibraryAsset) => boolean | void;
  onToggleCharacter: (reference: CharacterReferenceSelection) => void;
  selectedCharacterReferences: CharacterReferenceSelection[];
  characterSelectionLimit: number;
  copy: ImageWorkspaceCopy['library'];
  characterCopy: ImageWorkspaceCopy['characterPicker'];
  selectionMode: 'reference' | 'character';
  initialSource: AssetLibrarySource;
  supportedFormats: string[];
  supportedFormatsLabel: string;
  toolsEnabled: boolean;
};

export function ImageLibraryModal(props: ImageLibraryModalProps) {
  const { user } = useRequireAuth({ redirectIfLoggedOut: false });
  return props.open ? <OpenImageLibraryModal key={user?.id ?? 'guest'} {...props} userId={user?.id ?? null} /> : null;
}

function OpenImageLibraryModal({
  userId,
  open,
  target,
  onClose,
  onSelect,
  onToggleCharacter,
  selectedCharacterReferences,
  characterSelectionLimit,
  copy,
  characterCopy,
  selectionMode,
  initialSource,
  supportedFormats,
  supportedFormatsLabel,
  toolsEnabled,
}: ImageLibraryModalProps & { userId: string | null }) {
  const { t, locale } = useI18n();
  const uiLocale = normalizeUiLocale(locale);
  const [activeSource, setActiveSource] = useState<AssetLibrarySource>(initialSource);
  const [isSelecting, setIsSelecting] = useState(false);
  const pickerCopy = referencePickerCopy(uiLocale);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const handleClose = useCallback(() => { if (!isImporting && !isSelecting) onClose(); }, [isImporting, isSelecting, onClose]);
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose: handleClose, closeDisabled: isImporting || isSelecting });
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isCharacterMode = selectionMode === 'character';
  const importLabel = t(
    'workspace.generate.assetLibrary.import',
    uiLocale === 'fr' ? 'Importer' : uiLocale === 'es' ? 'Importar' : 'Import'
  ) as string;
  const importingLabel = t(
    'workspace.generate.assetLibrary.importing',
    uiLocale === 'fr' ? 'Import en cours…' : uiLocale === 'es' ? 'Importando…' : 'Importing…'
  ) as string;
  const importFailedLabel = t(
    'workspace.generate.assetLibrary.importFailed',
    uiLocale === 'fr'
      ? 'Import impossible. Réessayez.'
      : uiLocale === 'es'
        ? 'La importación falló. Inténtalo de nuevo.'
        : 'Import failed. Please try again.'
  ) as string;
  const { data, error, hasMore, isLoading, isLoadingMore, loadMore, mutate } = useImageLibraryData({
    userId,
    source: activeSource,
    isCharacterMode,
  });

  useEffect(() => {
    if (!open) return;
    setActiveSource(initialSource);
  }, [initialSource, open]);

  const handleImportChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = '';
      if (!file || isCharacterMode) return;

      if (!file.type.startsWith('image/')) {
        setImportError(t('workspace.image.errors.onlyImages', DEFAULT_COPY.errors.onlyImages) as string);
        return;
      }

      setImportError(null);
      setIsImporting(true);
      try {
        const preparedFile = await prepareImageFileForUpload(file, {
          maxBytes: DEFAULT_UPLOAD_LIMIT_MB * 1024 * 1024,
        });
        const formData = new FormData();
        formData.append('file', preparedFile, preparedFile.name);
        const response = await authFetch('/api/uploads/image', {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.asset?.url) {
          const message = translateError({
            code: typeof payload?.error === 'string' ? payload.error : null,
            status: response.status,
            message: importFailedLabel,
          }).message;
          throw new Error(message);
        }

        if (!mounted.current) return;
        const uploadedAsset = payload.asset as LibraryAsset;
        void mutate();
        const accepted = onSelect({
          id: uploadedAsset.id ?? `library_${Date.now().toString(36)}`,
          url: uploadedAsset.url,
          mime: uploadedAsset.mime ?? null,
          width: uploadedAsset.width ?? null,
          height: uploadedAsset.height ?? null,
          size: uploadedAsset.size ?? null,
          source: uploadedAsset.source ?? 'upload',
          createdAt: uploadedAsset.createdAt,
        });
        if (accepted === false) setImportError(pickerCopy.error);
      } catch (uploadError) {
        setImportError(uploadError instanceof Error ? uploadError.message : importFailedLabel);
      } finally {
        setIsImporting(false);
      }
    },
    [importFailedLabel, isCharacterMode, mutate, onSelect, pickerCopy.error, t]
  );

  const assets = useMemo(() => {
    if (isCharacterMode) return [];
    return (((data ?? []) as LibraryAsset[])).filter((asset) =>
      toolsEnabled
        ? true
        : asset.source !== 'storyboard' && asset.source !== 'character' && asset.source !== 'angle'
    );
  }, [data, isCharacterMode, toolsEnabled]);
  const characters = useMemo(
    () => (isCharacterMode ? (((data ?? []) as CharacterReferenceSelection[])) : []),
    [data, isCharacterMode]
  );
  const availableSources = useMemo(
    () =>
      isCharacterMode
        ? (['character'] as const satisfies readonly AssetLibrarySource[])
        : toolsEnabled
          ? ([
              'all',
              'upload',
              'generated',
              'storyboard',
              'character',
              'angle',
              'upscale',
            ] as const satisfies readonly AssetLibrarySource[])
          : (['all', 'upload', 'generated'] as const satisfies readonly AssetLibrarySource[]),
    [isCharacterMode, toolsEnabled]
  );

  useEffect(() => {
    if (!availableSources.some((source) => source === activeSource)) {
      setActiveSource(initialSource);
    }
  }, [activeSource, availableSources, initialSource]);
  const compatibilityByAssetId = useMemo(() => {
    if (isCharacterMode) return new Map<string, boolean>();
    const entries = assets.map((asset) => {
      if (!supportedFormats.length) {
        return [asset.id, true] as const;
      }
      const supportedByMime = isSupportedImageMime(supportedFormats, asset.mime);
      if (supportedByMime != null) {
        return [asset.id, supportedByMime] as const;
      }
      const inferredFormat = inferImageFormatFromUrl(asset.url);
      return [asset.id, inferredFormat ? isSupportedImageFormat(supportedFormats, inferredFormat) : true] as const;
    });
    return new Map(entries);
  }, [assets, isCharacterMode, supportedFormats]);

  const compatibleAssets = useMemo(
    () => (isCharacterMode ? [] : assets.filter((asset) => compatibilityByAssetId.get(asset.id) !== false)),
    [assets, compatibilityByAssetId, isCharacterMode]
  );
  const browserAssets = useMemo(
    () => {
      if (isCharacterMode) {
        return characters.map((character) => ({
          id: character.id,
          url: character.thumbUrl ?? character.imageUrl,
          kind: 'image' as const,
          source: 'character',
          createdAt: character.createdAt ?? undefined,
        }));
      }
      return compatibleAssets.map((asset) => ({
        ...asset,
        kind: 'image' as const,
      }));
    },
    [characters, compatibleAssets, isCharacterMode]
  );
  const characterMap = useMemo(() => new Map(characters.map((character) => [character.id, character])), [characters]);
  const selectedCharacterIds = useMemo(
    () => new Set(selectedCharacterReferences.map((reference) => reference.id)),
    [selectedCharacterReferences]
  );
  const emptyLabel =
    isCharacterMode
      ? characterCopy.empty
      : compatibleAssets.length === 0 && assets.length > 0
        ? copy.modal.emptyCompatible
        : activeSource === 'generated'
          ? copy.modal.emptyGenerated
          : activeSource === 'upload'
            ? copy.modal.emptyUploads
            : activeSource === 'storyboard'
              ? copy.modal.emptyStoryboard
              : activeSource === 'character'
                ? copy.modal.emptyCharacter
                : activeSource === 'angle'
                  ? copy.modal.emptyAngle
                  : activeSource === 'upscale'
                    ? copy.modal.emptyUpscale
                    : copy.modal.empty;
  const supportedFormatsHint = isCharacterMode
    ? formatTemplate(characterCopy.limitLabel, {
        count: characterSelectionLimit,
        suffix: characterSelectionLimit === 1 ? '' : 's',
      })
    : supportedFormats.length && supportedFormatsLabel.length
      ? formatTemplate(copy.supportedFormats, { formats: supportedFormatsLabel })
      : null;
  const searchPlaceholder = t('workspace.library.browser.searchPlaceholder', 'Search assets…') as string;
  const sourcesTitle = t('workspace.library.browser.sourcesTitle', 'Media') as string;
  const loadMoreLabel = t(
    'workspace.library.browser.loadMore',
    uiLocale === 'fr' ? 'Afficher plus' : uiLocale === 'es' ? 'Mostrar más' : 'Load more'
  ) as string;
  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="app-experience app-library-picker-layer"
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={onDialogKeyDown}
      role="dialog"
      aria-label={isCharacterMode ? characterCopy.title : copy.modal.title}
      aria-modal="true"
      onMouseDown={handleBackdropClick}
    >
      <div className="app-picker-container">
        {!isCharacterMode ? (
          <input
            ref={importInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleImportChange}
          />
        ) : null}
        <AssetLibraryBrowser
          locale={uiLocale}
          selection={{
            scope: `${userId ?? "guest"}:${selectionMode}:${target?.scope ?? 'reference'}`,
            busy: isImporting || isSelecting,
            onBusyChange: setIsSelecting,
            onConfirm: isCharacterMode ? undefined : (asset) => onSelect(asset as LibraryAsset),
            selectedIds: isCharacterMode ? selectedCharacterIds : undefined,
            isDisabled: isCharacterMode ? (asset) => !selectedCharacterIds.has(asset.id) && selectedCharacterReferences.length >= characterSelectionLimit : undefined,
            onToggle: isCharacterMode ? (asset) => { const character = characterMap.get(asset.id); if (character) onToggleCharacter(character); } : undefined,
          }}
          assetType="image"
          layout="modal"
          title={isCharacterMode ? characterCopy.title : pickerCopy.title}
          subtitle={isCharacterMode ? supportedFormatsHint ?? undefined : [target?.slotIndex != null ? `${pickerCopy.slot} ${target.slotIndex + 1}` : null, target?.capacity ? `${pickerCopy.capacity} ${target.capacity}` : null].filter(Boolean).join(' · ')}
          selectionGuidance={!isCharacterMode ? supportedFormatsHint : undefined}
          onClose={handleClose}
          closeLabel={copy.modal.close}
          assets={browserAssets}
          isLoading={!userId || isLoading}
          error={
            importError ??
            (error ? (isCharacterMode ? (error instanceof Error ? error.message : characterCopy.empty) : copy.modal.error) : null)
          }
          source={activeSource}
          availableSources={availableSources}
          sourceLabels={copy.tabs}
          onSourceChange={setActiveSource}
          headerActions={
            !isCharacterMode ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-border bg-surface-2 px-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                disabled={!userId || isImporting}
                onClick={() => importInputRef.current?.click()}
              >
                {isImporting ? importingLabel : importLabel}
              </Button>
            ) : undefined
          }
          searchPlaceholder={searchPlaceholder}
          sourcesTitle={sourcesTitle}
          emptyLabel={emptyLabel}
          emptySearchLabel={copy.modal.empty}
          hasMore={!isCharacterMode && hasMore}
          isLoadingMore={isLoadingMore}
          loadMoreLabel={loadMoreLabel}
          onLoadMore={loadMore}
          renderAssetActions={() => null}
          renderAssetMeta={(asset) =>
            isCharacterMode ? (
              (() => {
                const character = characterMap.get(asset.id);
                if (!character) return null;
                return (
                  <>
                    <span>{formatCharacterReferenceDate(character.createdAt)}</span>
                    <span>{getCharacterReferenceLabel(character, uiLocale)}</span>
                  </>
                );
              })()
            ) : asset.createdAt ? (
              <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
            ) : null
          }
        />
      </div>
    </div>, document.body
  );
}
