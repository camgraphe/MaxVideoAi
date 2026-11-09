'use client';
import { useLibraryImportQueue } from '@/hooks/useLibraryImportQueue';
import type { LibraryImportQueueController } from '@/lib/library-import-queue';

import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { referencePickerCopy } from '@/components/library/reference-picker-copy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
} from 'react';
import type { AssetLibraryBrowserProps, AssetLibrarySource } from '@/components/library/AssetLibraryBrowser';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { normalizeUiLocale } from '@/lib/ltx-localization';
import {
  inferImageFormatFromUrl,
  isSupportedImageFormat,
  isSupportedImageMime,
} from '@/lib/image/formats';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import type { MediaInputEligibility } from '@/lib/media-input-eligibility';
import { useImageLibraryData } from '../_hooks/useImageLibraryData';
import type {
  CharacterReferenceSelection,
} from '@/types/image-generation';
import {
  formatCharacterReferenceDate,
  getCharacterReferenceLabel,
} from '../_lib/image-workspace-character-references';
import {
  formatTemplate,
  type ImageWorkspaceCopy,
} from '../_lib/image-workspace-copy';
import {
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
  onSelectMany?: (assets: LibraryAsset[]) => boolean | void;
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
  const context = useRef(props.target?.scope ?? 'image-reference');
  if (props.open) context.current = props.target?.scope ?? 'image-reference';
  const imports = useLibraryImportQueue(user?.id, context.current);
  return props.open ? <OpenImageLibraryModal key={`${user?.id ?? 'guest'}:${context.current}`} {...props} importQueue={imports.queue} userId={user?.id ?? null} /> : null;
}

function OpenImageLibraryModal({
  userId,
  importQueue,
  open,
  target,
  onClose,
  onSelect,
  onSelectMany,
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
}: ImageLibraryModalProps & { userId: string | null; importQueue: LibraryImportQueueController }) {
  const { t, locale } = useI18n();
  const uiLocale = normalizeUiLocale(locale);
  const [activeSource, setActiveSource] = useState<AssetLibrarySource>(initialSource);
  const [isSelecting, setIsSelecting] = useState(false);
  const pickerCopy = referencePickerCopy(uiLocale);
  const handleClose = useCallback(() => { if (!isSelecting) onClose(); }, [isSelecting, onClose]);
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose: handleClose, closeDisabled: isSelecting });
  const isCharacterMode = selectionMode === 'character';
  const { data, error, hasMore, isLoading, isLoadingMore, loadMore } = useImageLibraryData({
    userId,
    source: activeSource,
    isCharacterMode,
    enabled: isCharacterMode,
  });
  const getEligibility = useCallback((asset: LibraryAsset): MediaInputEligibility => {
    if (!supportedFormats.length) return { status: 'usable' };
    const supportedByMime = isSupportedImageMime(supportedFormats, asset.mime);
    const inferredFormat = inferImageFormatFromUrl(asset.url);
    const supported = supportedByMime ?? (inferredFormat ? isSupportedImageFormat(supportedFormats, inferredFormat) : null);
    return supported === false ? { status: 'blocked', issue: 'format' }
      : { status: supported === null ? 'unverified' : 'usable' };
  }, [supportedFormats]);

  useEffect(() => {
    if (!open) return;
    setActiveSource(initialSource);
  }, [initialSource, open]);

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
          url: character.imageUrl,
          thumbUrl: character.thumbUrl,
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
        <AssetLibraryBrowser
          locale={uiLocale}
          selection={{
            ownerId:userId,
            browseLibrary: !isCharacterMode,
            scope: `${userId ?? "guest"}:${selectionMode}:${target?.scope ?? 'reference'}`,
            busy: isSelecting,
            importQueue: isCharacterMode ? undefined : importQueue,
            onBusyChange: setIsSelecting,
            onConfirmMany: !isCharacterMode && onSelectMany ? assets => onSelectMany(assets as LibraryAsset[]) : undefined,
            onConfirm: isCharacterMode ? undefined : (asset) => onSelect(asset as LibraryAsset),
            getEligibility: isCharacterMode ? undefined : getEligibility,
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
            (error ? (isCharacterMode ? (error instanceof Error ? error.message : characterCopy.empty) : copy.modal.error) : null)
          }
          source={activeSource}
          availableSources={availableSources}
          sourceLabels={copy.tabs}
          onSourceChange={setActiveSource}
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
