'use client';

import clsx from 'clsx';
import { useMemo, useCallback, useRef } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, ReactNode } from 'react';
import type { EngineCaps, EngineInputField, EngineModeUiCaps as CapabilityCaps } from '@/types/engines';
import { getVisibleAssetSlots } from '@/lib/asset-slot-layout';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getLocalizedAssetDropzoneCopy, normalizeUiLocale } from '@/lib/ltx-localization';
import { AssetFieldTooltip } from '@/components/asset-dropzone/AssetFieldTooltip';
import { AssetDropzoneSlot } from '@/components/asset-dropzone/AssetDropzoneSlot';
import {
  buildAssetFieldTooltipLines,
  readMediaDuration,
  resolveAssetFieldTitle,
  resolveAssetRoleDescription,
  resolveSlotLabel,
  VEO_REFERENCE_WARNING_ENGINES,
} from '@/components/asset-dropzone/asset-dropzone-helpers';
import type { AssetFieldRole, AssetSlotAttachment, AssetUploadMeta } from '@/components/asset-dropzone/asset-dropzone-types';

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
  density?: 'default' | 'compact';
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
  density = 'default',
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
  const limits = engine.inputLimits;
  const constraints = engine.inputSchema?.constraints ?? {};
  const acceptFormats = useMemo(() => {
    const configuredFormats = caps?.acceptsImageFormats?.length ? caps.acceptsImageFormats : constraints.supportedFormats;
    return configuredFormats?.map((format) => format.toLowerCase()) ?? [];
  }, [caps?.acceptsImageFormats, constraints.supportedFormats]);
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
  const renderSlots = useMemo(() => {
    if (!isCollectionField || displaySlots.length <= 1) return displaySlots;
    const emptySlots = displaySlots.filter((slot) => slot.asset == null);
    const filledSlots = displaySlots.filter((slot) => slot.asset != null);
    return [...emptySlots, ...filledSlots];
  }, [displaySlots, isCollectionField]);
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
      if (field.type === 'video') {
        const maxSizeMB = constraints.maxVideoSizeMB ?? limits.videoMaxMB;
        if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
          onError?.(assetCopy.fileTooLarge(maxSizeMB));
          return;
        }
        const duration = await readMediaDuration(file, 'video');
        const maxDurationSec = field.maxDurationSec ?? limits.videoMaxDurationSec;
        if (duration == null && typeof maxDurationSec === 'number') {
          onError?.(assetCopy.unableToReadVideoDuration);
          return;
        }
        if (typeof maxDurationSec === 'number' && duration != null && duration > maxDurationSec) {
          onError?.(assetCopy.videoMaxDuration(maxDurationSec));
          return;
        }
        onSelect(field, file, slotIndex, { durationSec: duration ?? undefined });
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
      limits.videoMaxDurationSec,
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
      const maxVideoDuration = field.maxDurationSec ?? limits.videoMaxDurationSec;
      if (maxVideoDuration) lines.push(assetCopy.secondsMax(maxVideoDuration));
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

  const fieldTitle = resolveAssetFieldTitle(field, role, assetCopy);
  const roleDescription = resolveAssetRoleDescription(role, assetCopy);
  const visibleHelperText = field.type === 'video' && helperLines.length ? helperLines.join(' · ') : null;
  const detailsTooltipLines = buildAssetFieldTooltipLines({
    roleDescription,
    fieldDescription: field.description,
    referenceWarning,
    showReferenceWarning: role !== 'frame' && VEO_REFERENCE_WARNING_ENGINES.has(engine.id),
    helperLines,
  });
  const fullBleedSingleAsset =
    !isCollectionField &&
    displaySlots.length === 1 &&
    displaySlots[0]?.asset != null &&
    displaySlots[0].asset?.kind !== 'audio';
  const remainingSlotCount = isCollectionField ? Math.max(0, maxCount - filledAssetCount) : 0;
  const tooltipId = `asset-field-${engine.id}-${field.id}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  const isSourceVideoDisabledState = disabledReason?.toLowerCase().includes('source video');
  const disabledStatusLabel = isSourceVideoDisabledState ? 'Source video active' : 'Unavailable';
  const compactCollectionLayout = isCollectionField && displaySlots.length > 1;
  const compactDensity = density === 'compact';
  const multiSlotGridClass = isCollectionField
    ? compactCollectionLayout
      ? 'grid-cols-2'
      : displaySlots.length <= 1
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
          fullBleedSingleAsset ? 'relative min-h-[260px] overflow-hidden' : compactDensity ? 'gap-2 p-2.5' : 'gap-4 p-4',
          disabled && disabledReason && 'border-warning-border/70 bg-warning-bg/30 dark:border-[#f6c667]/25 dark:bg-[#f6c667]/[0.045]'
        )}
      >
        <div
          className={clsx(
            'flex items-center justify-between gap-3',
            fullBleedSingleAsset && 'absolute left-4 right-4 top-4 z-10'
          )}
        >
          <div className={clsx('flex min-w-0 items-center gap-2', disabled && disabledReason && 'flex-wrap')}>
            <span
              className={clsx(
                'truncate text-sm font-medium',
                fullBleedSingleAsset ? 'text-on-inverse drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]' : 'text-text-primary dark:text-white/92'
              )}
            >
              {fieldTitle}
            </span>
            <AssetFieldTooltip
              tooltipId={tooltipId}
              details={detailsTooltipLines}
              fullBleedSingleAsset={fullBleedSingleAsset}
            />
            {disabled && disabledReason ? (
              <span className="shrink-0 rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-warning dark:border-[#f6c667]/30 dark:bg-[#f6c667]/10 dark:text-[#f6c667]">
                {disabledStatusLabel}
              </span>
            ) : null}
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
        {disabled && disabledReason && !isSourceVideoDisabledState ? (
          <div
            role="note"
            className="rounded-input border border-warning-border bg-warning-bg px-3 py-2 text-left text-[11px] font-medium leading-4 text-warning dark:border-[#f6c667]/25 dark:bg-[#f6c667]/[0.06] dark:text-white/76"
          >
            {disabledReason}
          </div>
        ) : null}

        <div
          className={clsx(
            'grid gap-2',
            fullBleedSingleAsset && 'h-full',
            multiSlotGridClass
          )}
        >
          {renderSlots.map(({ asset, slotIndex }) => {
            const canOpenLibrary = Boolean(onOpenLibrary && (field.type === 'image' || field.type === 'video'));
            const slotLabel = resolveSlotLabel(field, role, slotIndex, assetCopy);

            return (
              <AssetDropzoneSlot
                key={`${field.id}-slot-${slotIndex}`}
                accept={accept}
                asset={asset}
                assetCopy={assetCopy}
                canOpenLibrary={canOpenLibrary}
                compactDensity={compactDensity}
                compactCollectionLayout={compactCollectionLayout}
                disabled={disabled}
                disabledReason={disabledReason}
                displaySlotCount={displaySlots.length}
                engineId={engine.id}
                filledAssetCount={filledAssetCount}
                fullBleedSingleAsset={fullBleedSingleAsset}
                hideRequiredSlotCopy={hideRequiredSlotCopy}
                inputRef={(element) => {
                  inputRefs.current[slotIndex] = element;
                }}
                isCollectionField={isCollectionField}
                minCount={minCount}
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
        {visibleHelperText || isCollectionField ? (
          <p className="text-[11px] leading-none text-text-muted dark:text-white/45">
            {[visibleHelperText, isCollectionField ? assetCopy.slotsRemaining(remainingSlotCount) : null].filter(Boolean).join(' · ')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
