'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent } from 'react';
import { Lock, Trash2, X } from 'lucide-react';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { Button } from '@/components/ui/Button';
import type { getLocalizedAssetDropzoneCopy } from '@/lib/ltx-localization';
import { AssetMediaPickerMenu } from './AssetMediaPickerMenu';
import type { AssetSlotAttachment } from './asset-dropzone-types';
import { useExclusiveMediaPicker } from './useExclusiveMediaPicker';

type AssetDropzoneCopy = ReturnType<typeof getLocalizedAssetDropzoneCopy>;

type AssetDropzoneSlotProps = {
  accept: string;
  asset: AssetSlotAttachment | null;
  assetCopy: AssetDropzoneCopy;
  canOpenLibrary: boolean;
  compactDensity: boolean;
  compactCollectionLayout: boolean;
  disabled: boolean;
  disabledReason: string | null;
  displaySlotCount: number;
  engineId: string;
  filledAssetCount: number;
  fullBleedSingleAsset: boolean;
  hideRequiredSlotCopy: boolean;
  inputRef: (element: HTMLInputElement | null) => void;
  isCollectionField: boolean;
  minCount: number;
  slotIndex: number;
  slotLabel: string;
  onDisabledAttempt: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>, slotIndex: number) => void;
  onInputChange: (event: ChangeEvent<HTMLInputElement>, slotIndex: number) => void;
  onOpenLibrarySlot: (slotIndex: number) => void;
  onPaste: (event: ClipboardEvent<HTMLDivElement>, slotIndex: number) => void;
  onRemoveSlot: (slotIndex: number) => void;
  onSelectFileSlot: (slotIndex: number) => void;
};

export function AssetDropzoneSlot({
  accept,
  asset,
  assetCopy,
  canOpenLibrary,
  compactDensity,
  compactCollectionLayout,
  disabled,
  disabledReason,
  displaySlotCount,
  engineId,
  filledAssetCount,
  fullBleedSingleAsset,
  hideRequiredSlotCopy,
  inputRef,
  isCollectionField,
  minCount,
  slotIndex,
  slotLabel,
  onDisabledAttempt,
  onDrop,
  onInputChange,
  onOpenLibrarySlot,
  onPaste,
  onRemoveSlot,
  onSelectFileSlot,
}: AssetDropzoneSlotProps) {
  const slotRequired = slotIndex < minCount;
  const showRequiredHint = slotRequired && engineId !== 'wan-2-6' && !hideRequiredSlotCopy;
  const isInitialCollectionSlot = isCollectionField && asset == null && filledAssetCount === 0 && displaySlotCount === 1;
  const flattenSlotSurface = displaySlotCount === 1 && (!isCollectionField || isInitialCollectionSlot);
  const isCollectionAddTile = isCollectionField && asset == null && filledAssetCount > 0;
  const isCompactCollectionAddTile = compactCollectionLayout && isCollectionAddTile;
  const isCompactCollectionAsset = compactCollectionLayout && asset != null;
  const filledSingleSlot = flattenSlotSurface && asset != null;
  const allowClick = asset == null || asset?.kind !== 'audio';
  const isLockedEmptySlot = disabled && !asset;
  const visibleBadge = asset?.badge ?? (compactCollectionLayout && slotLabel ? slotLabel : null);
  const compactAssetLabel = visibleBadge ?? slotLabel ?? assetCopy.imageSlot;
  const { closePicker, mediaPickerId, openPicker, pickerOpen } = useExclusiveMediaPicker();

  const triggerFilePicker = () => {
    if (disabled) {
      onDisabledAttempt();
      return;
    }
    closePicker();
    onSelectFileSlot(slotIndex);
  };
  const triggerLibrary = () => {
    if (disabled) {
      onDisabledAttempt();
      return;
    }
    closePicker();
    onOpenLibrarySlot(slotIndex);
  };

  const openMediaPicker = () => {
    if (disabled) {
      onDisabledAttempt();
      return;
    }
    openPicker();
  };

  const triggerSelection = () => {
    if (disabled && !asset) {
      onDisabledAttempt();
      return;
    }
    if (!allowClick) return;
    if (asset) {
      if (canOpenLibrary) {
        triggerLibrary();
        return;
      }
      triggerFilePicker();
      return;
    }
    openMediaPicker();
  };

  return (
    <div
      tabIndex={0}
      className={clsx(
        'relative flex w-full flex-col justify-center text-center text-[12px] text-text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        pickerOpen ? 'z-30 overflow-visible' : 'overflow-hidden',
        compactCollectionLayout
          ? isCollectionAddTile
            ? compactDensity
              ? 'col-span-full min-h-[48px] rounded-[12px] border border-border/60 bg-surface/80 dark:border-white/[0.09] dark:bg-white/[0.045]'
              : 'col-span-full min-h-[72px] rounded-[16px] border border-border/60 bg-surface/80 dark:border-white/[0.09] dark:bg-white/[0.045]'
            : 'min-h-0 rounded-none border-0 bg-transparent p-0'
          : filledSingleSlot
          ? fullBleedSingleAsset
            ? 'min-h-[260px] h-full rounded-none border-0 bg-transparent'
            : compactDensity
              ? 'min-h-[144px] rounded-[14px] border border-border/60 bg-surface dark:border-white/8 dark:bg-white/[0.05]'
              : 'min-h-[228px] rounded-[20px] border border-border/60 bg-surface dark:border-white/8 dark:bg-white/[0.05]'
          : flattenSlotSurface
            ? compactDensity
              ? 'min-h-[54px] rounded-[12px] border-0 bg-transparent'
              : 'min-h-[132px] rounded-[18px] border-0 bg-transparent'
            : compactDensity
              ? 'h-24 rounded-[12px] border border-border/60 bg-surface/80 dark:border-white/[0.09] dark:bg-white/[0.045]'
              : 'h-40 rounded-[18px] border border-border/60 bg-surface/80 dark:border-white/[0.09] dark:bg-white/[0.045]',
        allowClick
          ? isCompactCollectionAsset
            ? 'cursor-pointer'
            : filledSingleSlot
            ? 'cursor-pointer hover:border-brand/50'
            : flattenSlotSurface
              ? 'cursor-pointer hover:bg-surface-2/70 dark:hover:bg-white/[0.05]'
              : 'cursor-pointer hover:border-brand/50 hover:bg-surface-2 dark:hover:border-brand/35 dark:hover:bg-white/[0.07]'
          : 'cursor-default',
        disabled && !asset && 'cursor-not-allowed border-border/70 bg-surface/60 hover:border-border/70 hover:bg-surface/60 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-white/[0.08] dark:hover:bg-white/[0.03]'
      )}
      onClick={triggerSelection}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape' && pickerOpen) {
          event.stopPropagation();
          closePicker();
          return;
        }
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        triggerSelection();
      }}
      role="button"
      aria-haspopup={asset ? undefined : 'dialog'}
      aria-expanded={asset ? undefined : pickerOpen}
      aria-controls={asset || !pickerOpen ? undefined : mediaPickerId}
      title={asset ? undefined : disabledReason ?? assetCopy.addMedia}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        if (disabled) {
          onDisabledAttempt();
          return;
        }
        onDrop(event, slotIndex);
      }}
      onPaste={(event) => {
        if (disabled) {
          onDisabledAttempt();
          return;
        }
        onPaste(event, slotIndex);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          onInputChange(event, slotIndex);
        }}
        suppressHydrationWarning
      />
      {asset ? (
        <>
          {fullBleedSingleAsset ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-24 bg-gradient-to-b from-black/55 via-black/18 to-transparent" />
          ) : null}
          {asset.kind === 'image' ? (
            <img
              src={asset.previewUrl}
              alt={asset.name}
              className={clsx(
                'bg-surface',
                compactCollectionLayout
                  ? 'relative aspect-video w-full rounded-[10px] bg-surface object-cover'
                  : 'absolute inset-0 h-full w-full object-cover'
              )}
            />
          ) : asset.kind === 'audio' ? (
            <div
              className={clsx(
                'flex items-center justify-center bg-surface',
                compactCollectionLayout
                  ? 'relative aspect-video w-full rounded-[10px] p-2'
                  : 'absolute inset-0 p-4'
              )}
            >
              <audio src={asset.previewUrl} controls className="w-full" />
            </div>
          ) : (
            <>
              <video
                src={asset.previewUrl} controls preload="metadata"
                className={clsx(
                  'bg-black object-cover',
                  compactCollectionLayout
                    ? 'relative aspect-video w-full rounded-[10px]'
                    : 'absolute inset-0 h-full w-full'
                )}
              />
              <AudioEqualizerBadge tone="light" size="sm" label={assetCopy.videoIncludesAudio} />
            </>
          )}
          {visibleBadge && !compactCollectionLayout ? (
            <div className={clsx('absolute z-10', compactCollectionLayout ? 'left-2 top-2' : 'left-3 top-3')}>
              <span className={clsx(
                'inline-flex items-center rounded-full border border-white/24 bg-black/58 text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur',
                compactCollectionLayout ? 'px-2 py-0.5' : 'px-2.5 py-1'
              )}>
                {visibleBadge}
              </span>
            </div>
          ) : null}
          {compactCollectionLayout ? (
            <div className="relative z-10 mt-1 flex min-h-6 min-w-0 items-center text-left">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary dark:text-white/78" title={compactAssetLabel}>
                {compactAssetLabel}
              </p>
            </div>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={clsx(
              'absolute z-10 min-h-0 min-w-0 rounded-full p-0 transition focus-visible:ring-2',
              compactCollectionLayout
                ? 'right-0.5 top-0.5 !h-4 !min-h-0 !w-4 !min-w-0 !px-0 !py-0 bg-black/60 text-white shadow-sm hover:bg-black/75 focus-visible:ring-ring'
                : 'right-3 top-3 h-9 w-9 border border-white/30 bg-black/62 text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur hover:bg-black/78 focus-visible:ring-white/70'
            )}
            onClick={(event) => {
              event.stopPropagation();
              onRemoveSlot(slotIndex);
            }}
            aria-label={assetCopy.remove}
            title={assetCopy.remove}
          >
            {compactCollectionLayout ? <X className="h-2.5 w-2.5" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
          </Button>
          {asset.status === 'uploading' ? (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-on-media-dark-50 px-3 text-xs font-medium uppercase tracking-widest text-on-inverse">
              {assetCopy.uploading}
            </div>
          ) : null}
          {asset.status === 'error' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-on-media-dark-60 px-4 text-center text-xs text-on-inverse">
              <span>{asset.error ?? assetCopy.uploadFailed}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-0 h-auto rounded-full bg-surface px-3 py-1 text-[11px] font-medium text-text-primary shadow-none hover:bg-surface"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveSlot(slotIndex);
                }}
              >
                {assetCopy.remove}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div
          className={clsx(
            'flex h-full',
            isCompactCollectionAddTile
              ? 'items-center justify-center px-3 py-3'
              : 'flex-col items-center justify-center px-4 text-center',
            !isCompactCollectionAddTile && (isCollectionAddTile ? 'gap-3 py-4' : 'gap-4')
          )}
        >
          {isCollectionAddTile && !compactCollectionLayout ? (
            <span className="absolute left-3 top-3 inline-flex min-w-7 items-center justify-center rounded-full border border-border/70 bg-surface px-2 py-1 text-[10px] font-semibold text-text-muted dark:border-white/10 dark:bg-white/[0.06] dark:text-white/58">
              +
            </span>
          ) : null}
          <div
            className={clsx(
              'flex shrink-0 items-center justify-center rounded-full border text-text-secondary',
              isCompactCollectionAddTile ? 'h-11 w-11' : 'h-12 w-12',
              isLockedEmptySlot
                ? 'border-border/80 bg-surface text-text-muted dark:border-white/12 dark:bg-white/[0.04] dark:text-white/58'
                : 'border-border/75 bg-surface-2/80 dark:border-brand/25 dark:bg-brand/15 dark:text-brand'
            )}
          >
            {isLockedEmptySlot ? (
              <Lock className="h-4 w-4" aria-hidden />
            ) : (
              <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5">
                <path
                  d="M10 4.5v11m-5.5-5.5h11"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
          <div
            className={clsx(
              'space-y-1',
              !isLockedEmptySlot && 'sr-only',
              isCompactCollectionAddTile && 'min-w-0 flex-1 space-y-0',
              isCollectionAddTile && !isCompactCollectionAddTile && 'space-y-0'
            )}
          >
            {slotLabel ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary dark:text-white/86">
                {slotLabel}
              </p>
            ) : null}
            {showRequiredHint && !disabledReason ? (
              <span className="text-[10px] text-warning dark:text-[#f6c667]">{assetCopy.neededBeforeGenerating}</span>
            ) : null}
          </div>
          {!isLockedEmptySlot ? (
            <AssetMediaPickerMenu
              copy={assetCopy}
              canOpenLibrary={canOpenLibrary}
              menuId={mediaPickerId}
              open={pickerOpen}
              onClose={closePicker}
              onLibrary={triggerLibrary}
              onUpload={triggerFilePicker}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
