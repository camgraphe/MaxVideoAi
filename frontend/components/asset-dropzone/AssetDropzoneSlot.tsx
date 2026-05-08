'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent } from 'react';
import { Lock, Trash2 } from 'lucide-react';
import type { EngineInputField } from '@/types/engines';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { Button } from '@/components/ui/Button';
import type { getLocalizedAssetDropzoneCopy } from '@/lib/ltx-localization';
import type { AssetSlotAttachment } from './asset-dropzone-types';

type AssetDropzoneCopy = ReturnType<typeof getLocalizedAssetDropzoneCopy>;

type AssetDropzoneSlotProps = {
  accept: string;
  asset: AssetSlotAttachment | null;
  assetCopy: AssetDropzoneCopy;
  canOpenLibrary: boolean;
  disabled: boolean;
  disabledReason: string | null;
  displaySlotCount: number;
  engineId: string;
  field: EngineInputField;
  filledAssetCount: number;
  fullBleedSingleAsset: boolean;
  helperLines: string[];
  hideRequiredSlotCopy: boolean;
  inputRef: (element: HTMLInputElement | null) => void;
  isCollectionField: boolean;
  minCount: number;
  roleDescription: string | null;
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
  disabled,
  disabledReason,
  displaySlotCount,
  engineId,
  field,
  filledAssetCount,
  fullBleedSingleAsset,
  helperLines,
  hideRequiredSlotCopy,
  inputRef,
  isCollectionField,
  minCount,
  roleDescription,
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
  const flattenSlotSurface = displaySlotCount === 1 && !isCollectionField;
  const isCollectionAddTile = isCollectionField && asset == null && filledAssetCount > 0;
  const filledSingleSlot = flattenSlotSurface && asset != null;
  const allowClick = asset == null || asset?.kind !== 'audio';
  const isLockedEmptySlot = disabled && !asset;
  const slotDescription =
    isLockedEmptySlot
      ? null
      : displaySlotCount === 1
        ? field.description ?? roleDescription
        : isCollectionField && asset == null && filledAssetCount === 0
          ? field.description ?? roleDescription
          : null;
  const slotMeta =
    isLockedEmptySlot
      ? null
      : (displaySlotCount === 1 || (isCollectionField && asset == null && filledAssetCount === 0)
          ? helperLines.slice(0, 2)
          : []
        )
          .filter((value) => value.trim().length > 0)
          .join(' • ') || null;

  const triggerFilePicker = () => {
    if (disabled) {
      onDisabledAttempt();
      return;
    }
    onSelectFileSlot(slotIndex);
  };

  const triggerLibrary = () => {
    if (disabled) {
      onDisabledAttempt();
      return;
    }
    onOpenLibrarySlot(slotIndex);
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
    triggerFilePicker();
  };

  return (
    <div
      tabIndex={0}
      className={clsx(
        'relative flex w-full flex-col justify-center overflow-hidden text-center text-[12px] text-text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        filledSingleSlot
          ? fullBleedSingleAsset
            ? 'min-h-[260px] h-full rounded-none border-0 bg-transparent'
            : 'min-h-[228px] rounded-[20px] border border-border/60 bg-surface dark:border-white/8 dark:bg-white/[0.05]'
          : flattenSlotSurface
            ? 'min-h-[132px] rounded-[18px] border-0 bg-transparent'
            : 'h-40 rounded-[18px] border border-border/60 bg-surface/80 dark:border-white/[0.09] dark:bg-white/[0.045]',
        allowClick
          ? filledSingleSlot
            ? 'cursor-pointer hover:border-brand/50'
            : flattenSlotSurface
              ? 'cursor-pointer hover:bg-surface-2/70 dark:hover:bg-white/[0.05]'
              : 'cursor-pointer hover:border-brand/50 hover:bg-surface-2 dark:hover:border-brand/35 dark:hover:bg-white/[0.07]'
          : 'cursor-default',
        disabled && !asset && 'cursor-not-allowed border-border/70 bg-surface/60 hover:border-border/70 hover:bg-surface/60 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-white/[0.08] dark:hover:bg-white/[0.03]'
      )}
      onClick={triggerSelection}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        triggerSelection();
      }}
      title={asset ? undefined : disabledReason ?? assetCopy.upload}
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
      />
      {asset ? (
        <>
          {fullBleedSingleAsset ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-24 bg-gradient-to-b from-black/55 via-black/18 to-transparent" />
          ) : null}
          {asset.kind === 'image' ? (
            <img src={asset.previewUrl} alt={asset.name} className="absolute inset-0 h-full w-full bg-surface object-cover" />
          ) : asset.kind === 'audio' ? (
            <div className="absolute inset-0 flex items-center justify-center bg-surface p-4">
              <audio src={asset.previewUrl} controls className="w-full" />
            </div>
          ) : (
            <>
              <video src={asset.previewUrl} controls preload="metadata" className="absolute inset-0 h-full w-full bg-black object-cover" />
              <AudioEqualizerBadge tone="light" size="sm" label={assetCopy.videoIncludesAudio} />
            </>
          )}
          {asset.badge ? (
            <div className="absolute left-3 top-3 z-10">
              <span className="inline-flex items-center rounded-full border border-white/24 bg-black/58 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur">
                {asset.badge}
              </span>
            </div>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="absolute right-3 top-3 z-10 h-9 w-9 rounded-full border border-white/30 bg-black/62 p-0 text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur transition hover:bg-black/78 focus-visible:ring-2 focus-visible:ring-white/70"
            onClick={(event) => {
              event.stopPropagation();
              onRemoveSlot(slotIndex);
            }}
            aria-label={assetCopy.remove}
            title={assetCopy.remove}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
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
            'flex h-full flex-col items-center justify-center px-4 text-center',
            isCollectionAddTile ? 'gap-3 py-4' : 'gap-4'
          )}
        >
          {isCollectionAddTile ? (
            <span className="absolute left-3 top-3 inline-flex min-w-7 items-center justify-center rounded-full border border-border/70 bg-surface px-2 py-1 text-[10px] font-semibold text-text-muted dark:border-white/10 dark:bg-white/[0.06] dark:text-white/58">
              +
            </span>
          ) : null}
          <div
            className={clsx(
              'flex h-8 w-8 items-center justify-center rounded-full border text-text-secondary',
              isLockedEmptySlot
                ? 'border-border/80 bg-surface text-text-muted dark:border-white/12 dark:bg-white/[0.04] dark:text-white/58'
                : 'border-border/75 bg-surface-2/80 dark:border-brand/25 dark:bg-brand/15 dark:text-brand'
            )}
          >
            {isLockedEmptySlot ? (
              <Lock className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <svg aria-hidden viewBox="0 0 20 20" className="h-3.5 w-3.5">
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
          <div className={clsx('space-y-1', isCollectionAddTile && 'space-y-0')}>
            {slotLabel ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary dark:text-white/86">
                {slotLabel}
              </p>
            ) : null}
            {isLockedEmptySlot && disabledReason ? (
              <p className="max-w-[16rem] text-[11px] font-medium leading-4 text-text-secondary dark:text-white/72">
                {disabledReason}
              </p>
            ) : null}
            {slotDescription ? (
              <p className="max-w-[16rem] text-[11px] leading-4 text-text-muted dark:text-white/58">
                {slotDescription}
              </p>
            ) : null}
            {slotMeta ? (
              <p className="max-w-[16rem] text-[10px] leading-4 text-text-muted/90 dark:text-white/46">
                {slotMeta}
              </p>
            ) : null}
            {disabledReason && slotIndex === 0 && !isLockedEmptySlot ? (
              <p className="max-w-[16rem] text-[10px] leading-4 text-text-muted dark:text-white/54">
                {disabledReason}
              </p>
            ) : null}
            {showRequiredHint && !disabledReason ? (
              <span className="text-[10px] text-warning dark:text-[#f6c667]">{assetCopy.neededBeforeGenerating}</span>
            ) : null}
          </div>
          {!isLockedEmptySlot ? (
            <div className="flex w-full flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-0 h-auto rounded-full border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary hover:border-text-muted hover:bg-transparent hover:text-text-primary dark:border-white/14 dark:bg-white/[0.045] dark:text-white/78 dark:hover:border-brand/30 dark:hover:bg-white/[0.08] dark:hover:text-white"
                disabled={disabled}
                title={disabledReason ?? undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  triggerFilePicker();
                }}
              >
                {assetCopy.upload}
              </Button>
              {canOpenLibrary ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-0 h-auto rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary hover:bg-surface-2 hover:text-text-primary dark:text-white/78 dark:hover:bg-white/[0.08] dark:hover:text-white"
                  disabled={disabled}
                  title={disabledReason ?? undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    triggerLibrary();
                  }}
                >
                  {assetCopy.library}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
