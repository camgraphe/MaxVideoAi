'use client';

import clsx from 'clsx';
import { useMemo, useCallback, useRef } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, ReactNode } from 'react';
import type { EngineCaps, EngineInputField, EngineModeUiCaps as CapabilityCaps } from '@/types/engines';
import { getVisibleAssetSlots } from '@/lib/asset-slot-layout';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getLocalizedAssetDropzoneCopy, normalizeUiLocale } from '@/lib/ltx-localization';
import { AssetDropzoneSlot } from '@/components/asset-dropzone/AssetDropzoneSlot';
import {
  readMediaDuration,
  resolveSlotLabel,
  VEO_REFERENCE_WARNING_ENGINES,
} from '@/components/asset-dropzone/asset-dropzone-helpers';
import type {
  AssetFieldRole,
  AssetSlotAttachment,
  AssetUploadMeta,
} from '@/components/asset-dropzone/asset-dropzone-types';

export type {
  AssetFieldConfig,
  AssetFieldRole,
  AssetSlotAttachment,
  AssetUploadMeta,
} from '@/components/asset-dropzone/asset-dropzone-types';

interface AssetDropzoneProps {
  engine: EngineCaps;
  caps?: CapabilityCaps;
  field: EngineInputField;
  required: boolean;
  isSoloField?: boolean;
  className?: string;
  role?: AssetFieldRole;
  assets: (AssetSlotAttachment | null)[];
  headerAction?: ReactNode;
  onSelect?: (field: EngineInputField, file: File, slotIndex: number, meta?: AssetUploadMeta) => void;
  onRemove?: (field: EngineInputField, index: number) => void;
  onError?: (message: string) => void;
  onOpenLibrary?: (field: EngineInputField, slotIndex: number) => void;
  onUrlSelect?: (field: EngineInputField, url: string, slotIndex: number) => void;
  referenceWarning?: string;
  disabled?: boolean;
  disabledReason?: string | null;
}

export function AssetDropzone({
  engine,
  caps,
  field,
  required,
  isSoloField = false,
  className,
  role = 'generic',
  assets,
  headerAction,
  onSelect,
  onRemove,
  onError,
  onOpenLibrary,
  onUrlSelect,
  referenceWarning,
  disabled = false,
  disabledReason = null,
}: AssetDropzoneProps) {
  const { locale } = useI18n();
  const assetCopy = useMemo(() => getLocalizedAssetDropzoneCopy(normalizeUiLocale(locale)), [locale]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const maxCount = field.maxCount ?? 0;
  const minCount = required ? (field.minCount ?? 1) : 0;
  const acceptFormats = useMemo(
    () => caps?.acceptsImageFormats?.map((format) => format.toLowerCase()) ?? [],
    [caps?.acceptsImageFormats]
  );
  const accept = (() => {
    if (field.type === 'image') {
      return acceptFormats.length
        ? acceptFormats.map((ext) => `.${ext.replace(/^\./, '').toLowerCase()}`).join(',')
        : 'image/*';
    }
    if (field.type === 'audio') {
      return 'audio/*';
    }
    return 'video/*';
  })();
  const limits = engine.inputLimits;
  const constraints = engine.inputSchema?.constraints ?? {};
  const hideRequiredSlotCopy =
    field.type === 'image' &&
    (role === 'primary' || role === 'reference') &&
    engine.modes.includes('t2v') &&
    engine.modes.includes('i2v');
  const isCollectionField = maxCount > 1;

  const filledAssetCount = useMemo(() => assets.filter((asset) => asset != null).length, [assets]);
  const displaySlots = useMemo(() => {
    return getVisibleAssetSlots({
      assets,
      maxCount,
      minCount,
    });
  }, [assets, maxCount, minCount]);
  const handleDisabledAttempt = useCallback(() => {
    if (disabledReason) {
      onError?.(disabledReason);
    }
  }, [disabledReason, onError]);

  const handleFile = useCallback(
    async (file: File, slotIndex: number) => {
      if (!onSelect) return;
      if (field.type === 'image') {
        if (!file.type.startsWith('image/')) {
          onError?.(assetCopy.dropImageFile);
          return;
        }
        if (acceptFormats.length) {
          const ext = file.name.split('.').pop()?.toLowerCase();
          if (!ext || !acceptFormats.includes(ext)) {
            onError?.(assetCopy.formatNotSupported(acceptFormats.map((entry) => entry.toUpperCase()).join(', ')));
            return;
          }
        }
      }
      if (field.type === 'video' && !file.type.startsWith('video/')) {
        onError?.(assetCopy.dropVideoFile);
        return;
      }
      if (field.type === 'audio' && !file.type.startsWith('audio/')) {
        onError?.(assetCopy.dropAudioFile);
        return;
      }
      if (field.type === 'audio') {
        const duration = await readMediaDuration(file, 'audio');
        if (duration == null) {
          onError?.(assetCopy.unableToReadAudioDuration);
          return;
        }
        const minDurationSec = field.minDurationSec;
        const maxDurationSec = field.maxDurationSec ?? limits.audioMaxDurationSec;
        if (typeof minDurationSec === 'number' && duration < minDurationSec) {
          onError?.(assetCopy.audioMinDuration(minDurationSec));
          return;
        }
        if (typeof maxDurationSec === 'number' && duration > maxDurationSec) {
          onError?.(assetCopy.audioMaxDuration(maxDurationSec));
          return;
        }
        onSelect(field, file, slotIndex, { durationSec: duration });
        return;
      }
      const maxSizeMB = field.type === 'image'
        ? null
        : constraints.maxVideoSizeMB ?? limits.videoMaxMB;
      if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
        onError?.(assetCopy.fileTooLarge(maxSizeMB));
        return;
      }
      onSelect(field, file, slotIndex);
    },
    [
      acceptFormats,
      assetCopy,
      constraints.maxVideoSizeMB,
      field,
      limits.audioMaxDurationSec,
      limits.videoMaxMB,
      onError,
      onSelect,
    ]
  );

  const onInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>, slotIndex: number) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      await handleFile(file, slotIndex);
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>, slotIndex: number) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (file) {
        await handleFile(file, slotIndex);
        return;
      }
      const text = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');
      if (onUrlSelect && /^https?:\/\//i.test(text.trim())) {
        onUrlSelect(field, text.trim(), slotIndex);
      }
    },
    [field, handleFile, onUrlSelect]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent<HTMLDivElement>, slotIndex: number) => {
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      for (let index = 0; index < clipboard.items.length; index += 1) {
        const item = clipboard.items[index];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            await handleFile(file, slotIndex);
            return;
          }
        }
      }
      const text = clipboard.getData('text/plain').trim();
      if (onUrlSelect && /^https?:\/\//i.test(text)) {
        event.preventDefault();
        onUrlSelect(field, text, slotIndex);
      }
    },
    [field, handleFile, onUrlSelect]
  );

  const helperLines = useMemo(() => {
    const lines: string[] = [];
    if (field.type === 'image') {
      if (acceptFormats.length) {
        lines.push(assetCopy.formats(acceptFormats.map((ext) => ext.toUpperCase()).join(', ')));
      } else {
        lines.push(assetCopy.formats('PNG, JPG, WebP'));
      }
      const maxImage = caps?.maxUploadMB ?? constraints.maxImageSizeMB ?? limits.imageMaxMB;
      if (maxImage) lines.push(assetCopy.mbMax(maxImage));
    } else if (field.type === 'video') {
      lines.push(assetCopy.formats('MP4, MOV'));
      const maxVideo = constraints.maxVideoSizeMB ?? limits.videoMaxMB;
      if (maxVideo) lines.push(assetCopy.mbMax(maxVideo));
      if (limits.videoMaxDurationSec) lines.push(assetCopy.secondsMax(limits.videoMaxDurationSec));
    } else {
      lines.push(assetCopy.formats('MP3, WAV, M4A'));
      const maxAudio = constraints.maxAudioSizeMB ?? limits.audioMaxMB ?? limits.videoMaxMB;
      if (maxAudio) lines.push(assetCopy.mbMax(maxAudio));
      const minAudioDuration = field.minDurationSec;
      const maxAudioDuration = field.maxDurationSec ?? limits.audioMaxDurationSec;
      if (typeof minAudioDuration === 'number' && typeof maxAudioDuration === 'number') {
        lines.push(assetCopy.secondsRequired(minAudioDuration, maxAudioDuration));
      } else if (typeof maxAudioDuration === 'number') {
        lines.push(assetCopy.secondsMax(maxAudioDuration));
      }
      if (field.id === 'audio_url') {
        lines.push(assetCopy.videoLengthFollowsAudio);
      }
    }
    if (field.maxCount && field.maxCount > 1) {
      lines.push(assetCopy.upToFiles(field.maxCount));
    }
    if (field.minCount && field.minCount > 1) {
      lines.push(assetCopy.atLeastFiles(field.minCount));
    }
    return lines;
  }, [
    acceptFormats,
    assetCopy,
    caps?.maxUploadMB,
    constraints.maxAudioSizeMB,
    constraints.maxImageSizeMB,
    constraints.maxVideoSizeMB,
    field.id,
    field.maxCount,
    field.maxDurationSec,
    field.minCount,
    field.minDurationSec,
    field.type,
    limits.audioMaxDurationSec,
    limits.audioMaxMB,
    limits.imageMaxMB,
    limits.videoMaxDurationSec,
    limits.videoMaxMB,
  ]);

  const fieldTitle =
    role === 'primary'
      ? field.label ?? assetCopy.primaryImageFallback
      : role === 'reference'
        ? field.label ?? assetCopy.additionalReferencesFallback
        : role === 'frame'
          ? field.label ?? assetCopy.frameFallback
          : field.label;
  const roleDescription =
    role === 'primary'
      ? assetCopy.primaryRoleDescription
      : role === 'reference'
        ? assetCopy.referenceRoleDescription
        : role === 'frame'
          ? assetCopy.frameRoleDescription
          : null;
  const detailsTooltip = [
    roleDescription,
    field.description,
    referenceWarning && role !== 'frame' && VEO_REFERENCE_WARNING_ENGINES.has(engine.id) ? referenceWarning : null,
    helperLines.length ? helperLines.join(' • ') : null,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n');
  const fullBleedSingleAsset =
    !isCollectionField &&
    displaySlots.length === 1 &&
    displaySlots[0]?.asset != null &&
    displaySlots[0].asset?.kind !== 'audio';
  const remainingSlotCount = isCollectionField ? Math.max(0, maxCount - filledAssetCount) : 0;
  const multiSlotGridClass = isCollectionField
    ? displaySlots.length <= 1
      ? 'grid-cols-1'
      : 'grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3'
    : displaySlots.length >= 4
      ? 'grid-cols-2 lg:grid-cols-4'
      : displaySlots.length === 3
        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
        : displaySlots.length <= 1
          ? 'grid-cols-1'
          : 'grid-cols-1 sm:grid-cols-2';
  const shouldLimitSoloWidth = isSoloField && displaySlots.length === 1;

  return (
    <div
      className={clsx(
        'flex min-w-0',
        shouldLimitSoloWidth ? 'w-full flex-none sm:max-w-[640px]' : 'w-full flex-1',
        className
      )}
    >
      <div
        className={clsx(
          'flex w-full flex-col rounded-input border border-dashed border-border bg-surface-glass-80 text-text-secondary dark:border-white/[0.07] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.018))] dark:text-white/68',
          fullBleedSingleAsset ? 'relative min-h-[260px] overflow-hidden' : 'gap-4 p-4',
          disabled && 'opacity-70'
        )}
      >
        <div
          className={clsx(
            'flex items-center justify-between gap-3',
            fullBleedSingleAsset && 'absolute left-4 right-4 top-4 z-10'
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={clsx(
                'truncate text-sm font-medium',
                fullBleedSingleAsset ? 'text-on-inverse drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]' : 'text-text-primary dark:text-white/92'
              )}
            >
              {fieldTitle}
            </span>
            {detailsTooltip ? (
              <button
                type="button"
                className={clsx(
                  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] transition',
                  fullBleedSingleAsset
                    ? 'border border-surface-on-media-25 bg-surface-on-media-dark-35 text-on-inverse backdrop-blur hover:bg-surface-on-media-dark-50'
                    : 'border border-border/80 text-text-muted hover:border-text-muted hover:text-text-primary dark:border-white/10 dark:bg-white/[0.03] dark:text-white/55 dark:hover:border-white/16 dark:hover:bg-white/[0.06] dark:hover:text-white'
                )}
                title={detailsTooltip}
                aria-label={detailsTooltip}
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <svg aria-hidden viewBox="0 0 20 20" className="h-3.5 w-3.5">
                  <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 9.1V13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="10" cy="6.5" r="0.9" fill="currentColor" />
                </svg>
              </button>
            ) : null}
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>

        <div
          className={clsx(
            'grid gap-2',
            fullBleedSingleAsset && 'h-full',
            multiSlotGridClass
          )}
        >
          {displaySlots.map(({ asset, slotIndex }) => {
            const canOpenLibrary = Boolean(onOpenLibrary && (field.type === 'image' || field.type === 'video'));
            const slotLabel = resolveSlotLabel(field, role, slotIndex, assetCopy);

            return (
              <AssetDropzoneSlot
                key={`${field.id}-slot-${slotIndex}`}
                accept={accept}
                asset={asset}
                assetCopy={assetCopy}
                canOpenLibrary={canOpenLibrary}
                disabled={disabled}
                disabledReason={disabledReason}
                displaySlotCount={displaySlots.length}
                engineId={engine.id}
                field={field}
                filledAssetCount={filledAssetCount}
                fullBleedSingleAsset={fullBleedSingleAsset}
                helperLines={helperLines}
                hideRequiredSlotCopy={hideRequiredSlotCopy}
                inputRef={(element) => {
                  inputRefs.current[slotIndex] = element;
                }}
                isCollectionField={isCollectionField}
                minCount={minCount}
                roleDescription={roleDescription}
                slotIndex={slotIndex}
                slotLabel={slotLabel}
                onDisabledAttempt={handleDisabledAttempt}
                onDrop={(event, targetSlotIndex) => {
                  void handleDrop(event, targetSlotIndex);
                }}
                onInputChange={(event, targetSlotIndex) => {
                  void onInputChange(event, targetSlotIndex);
                }}
                onOpenLibrarySlot={(targetSlotIndex) => onOpenLibrary?.(field, targetSlotIndex)}
                onPaste={(event, targetSlotIndex) => {
                  void handlePaste(event, targetSlotIndex);
                }}
                onRemoveSlot={(targetSlotIndex) => onRemove?.(field, targetSlotIndex)}
                onSelectFileSlot={(targetSlotIndex) => inputRefs.current[targetSlotIndex]?.click()}
              />
            );
          })}
        </div>
        {isCollectionField ? (
          <p className="text-[11px] leading-none text-text-muted dark:text-white/45">
            {assetCopy.slotsRemaining(remainingSlotCount)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
