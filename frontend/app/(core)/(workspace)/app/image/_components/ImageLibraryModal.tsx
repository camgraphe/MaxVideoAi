'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import type { AssetLibraryBrowserProps, AssetLibrarySource } from '@/components/library/AssetLibraryBrowser';
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
import useSWR from 'swr';
import type {
  CharacterReferenceSelection,
  CharacterReferencesResponse,
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
  type AssetsResponse,
  type LibraryAsset,
} from '../_lib/image-workspace-types';

const AssetLibraryBrowser = dynamic<AssetLibraryBrowserProps>(
  () => import('@/components/library/AssetLibraryBrowser').then((mod) => mod.AssetLibraryBrowser),
  { ssr: false }
);

type ImageLibraryModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: LibraryAsset) => void;
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

export function ImageLibraryModal({
  open,
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
}: ImageLibraryModalProps) {
  const { t, locale } = useI18n();
  const uiLocale = normalizeUiLocale(locale);
  const [activeSource, setActiveSource] = useState<AssetLibrarySource>(initialSource);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
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
  const swrKey = !open
    ? null
    : isCharacterMode
      ? '/api/character-references?limit=60'
      : activeSource === 'all'
        ? '/api/user-assets?limit=60'
        : `/api/user-assets?limit=60&source=${encodeURIComponent(activeSource)}`;
  const { data, error, isLoading, mutate } = useSWR(swrKey, async (url: string) => {
    const response = await authFetch(url);
    if (isCharacterMode) {
      const payload = (await response.json().catch(() => null)) as CharacterReferencesResponse | null;
      if (!response.ok || !payload?.ok) {
        let message: string | undefined;
        if (payload && typeof payload.error === 'string') {
          message = payload.error;
        }
        throw new Error(message ?? 'Failed to load character references');
      }
      return payload.characters;
    }
    const payload = (await response.json().catch(() => null)) as AssetsResponse | null;
    if (!response.ok || !payload?.ok) {
      let message: string | undefined;
      if (payload && typeof payload === 'object' && 'error' in payload) {
        const maybeError = (payload as { error?: unknown }).error;
        if (typeof maybeError === 'string') {
          message = maybeError;
        }
      }
      throw new Error(message ?? 'Failed to load library');
    }
    return payload.assets;
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

        const uploadedAsset = payload.asset as LibraryAsset;
        void mutate();
        onSelect({
          id: uploadedAsset.id ?? `library_${Date.now().toString(36)}`,
          url: uploadedAsset.url,
          mime: uploadedAsset.mime ?? null,
          width: uploadedAsset.width ?? null,
          height: uploadedAsset.height ?? null,
          size: uploadedAsset.size ?? null,
          source: uploadedAsset.source ?? 'upload',
          createdAt: uploadedAsset.createdAt,
        });
      } catch (uploadError) {
        setImportError(uploadError instanceof Error ? uploadError.message : importFailedLabel);
      } finally {
        setIsImporting(false);
      }
    },
    [importFailedLabel, isCharacterMode, mutate, onSelect, t]
  );

  const assets = useMemo(() => {
    if (isCharacterMode) return [];
    return (((data ?? []) as LibraryAsset[])).filter((asset) =>
      toolsEnabled ? true : asset.source !== 'character' && asset.source !== 'angle'
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
          ? (['all', 'upload', 'generated', 'character', 'angle', 'upscale'] as const satisfies readonly AssetLibrarySource[])
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
  const toolLinks = toolsEnabled
    ? [
        { href: '/app/image', label: 'Create image' },
        { href: '/app/tools/angle', label: 'Change angle' },
        { href: '/app/tools/character-builder', label: 'Character builder' },
      ]
    : [{ href: '/app/image', label: 'Create image' }];
  const searchPlaceholder = t('workspace.library.browser.searchPlaceholder', 'Search assets…') as string;
  const sourcesTitle = t('workspace.library.browser.sourcesTitle', 'Library') as string;
  const toolsTitle = t('workspace.library.browser.toolsTitle', 'Create or transform') as string;
  const toolsDescription = t(
    'workspace.library.browser.toolsDescription',
    'Open another workspace to prepare a better source before importing it here.'
  ) as string;

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdropClick}
    >
      <div className="h-[92svh] w-full max-w-6xl overflow-hidden sm:h-[84vh]">
        {!isCharacterMode ? (
          <input
            ref={importInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleImportChange}
          />
        ) : null}
        <AssetLibraryBrowser
          assetType="image"
          layout="modal"
          title={isCharacterMode ? characterCopy.title : copy.modal.title}
          subtitle={supportedFormatsHint ?? (isCharacterMode ? characterCopy.description : copy.modal.description)}
          onClose={onClose}
          closeLabel={copy.modal.close}
          assets={browserAssets}
          isLoading={isLoading}
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
                disabled={isImporting}
                onClick={() => importInputRef.current?.click()}
              >
                {isImporting ? importingLabel : importLabel}
              </Button>
            ) : undefined
          }
          searchPlaceholder={searchPlaceholder}
          sourcesTitle={sourcesTitle}
          toolsTitle={toolsEnabled ? toolsTitle : undefined}
          toolsDescription={toolsEnabled ? toolsDescription : undefined}
          toolLinks={toolLinks}
          emptyLabel={emptyLabel}
          emptySearchLabel={copy.modal.empty}
          renderAssetActions={(asset) =>
            isCharacterMode ? (
              (() => {
                const character = characterMap.get(asset.id);
                if (!character) return null;
                const isSelected = selectedCharacterIds.has(character.id);
                const isDisabled = !isSelected && selectedCharacterReferences.length >= characterSelectionLimit;
                return (
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? 'primary' : 'outline'}
                    disabled={isDisabled}
                    onClick={() => onToggleCharacter(character)}
                    className="min-h-0 h-9 rounded-full px-3 text-[11px] font-semibold"
                  >
                    {isSelected ? characterCopy.selected : characterCopy.select}
                  </Button>
                );
              })()
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onSelect(asset as LibraryAsset)}
                className="min-h-0 h-9 rounded-full px-3 text-[11px] font-semibold"
              >
                {copy.overlay}
              </Button>
            )
          }
          renderAssetMeta={(asset) =>
            isCharacterMode ? (
              (() => {
                const character = characterMap.get(asset.id);
                if (!character) return null;
                return (
                  <>
                    <span>{formatCharacterReferenceDate(character.createdAt)}</span>
                    <span>{getCharacterReferenceLabel(character)}</span>
                  </>
                );
              })()
            ) : asset.createdAt ? (
              <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
            ) : null
          }
        />
      </div>
    </div>
  );
}
