'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { useMemo, useCallback, useRef } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent, ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import type { EngineCaps, EngineInputField } from '@/types/engines';
import type { EngineCaps as CapabilityCaps } from '@/fixtures/engineCaps';
import { Button } from '@/components/ui/Button';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getLocalizedAssetDropzoneCopy, normalizeUiLocale } from '@/lib/ltx-localization';

const VEO_REFERENCE_WARNING_ENGINES = new Set(['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite']);

export type AssetSlotAttachment = {
  kind: 'image' | 'video' | 'audio';
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  status?: 'uploading' | 'ready' | 'error';
  error?: string;
  badge?: string;
};

export type AssetFieldRole = 'primary' | 'reference' | 'frame' | 'generic';

export type AssetFieldConfig = {
  field: EngineInputField;
  required: boolean;
  role?: AssetFieldRole;
  headerAction?: ReactNode;
};

export type AssetUploadMeta = {
  durationSec?: number;
};

interface AssetDropzoneProps {
  engine: EngineCaps;
  caps?: CapabilityCaps;
  field: EngineInputField;
  required: boolean;
  isSoloField?: boolean;
  role?: AssetFieldRole;
  assets: (AssetSlotAttachment | null)[];
  headerAction?: ReactNode;
  onSelect?: (field: EngineInputField, file: File, slotIndex: number, meta?: AssetUploadMeta) => void;
  onRemove?: (field: EngineInputField, index: number) => void;
  onError?: (message: string) => void;
  onOpenLibrary?: (field: EngineInputField, slotIndex: number) => void;
  onUrlSelect?: (field: EngineInputField, url: string, slotIndex: number) => void;
  referenceWarning?: string;
}

export function AssetDropzone({
  engine,
  caps,
  field,
  required,
  isSoloField = false,
  role = 'generic',
  assets,
  headerAction,
  onSelect,
  onRemove,
  onError,
  onOpenLibrary,
  onUrlSelect,
  referenceWarning,
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
  const readMediaDuration = useCallback((file: File, type: 'audio' | 'video') => {
    return new Promise<number | null>((resolve) => {
      if (typeof window === 'undefined') {
        resolve(null);
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      const element = document.createElement(type);
      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        element.removeAttribute('src');
        element.load?.();
      };
      element.preload = 'metadata';
      element.onloadedmetadata = () => {
        const duration = Number.isFinite(element.duration) ? element.duration : null;
        cleanup();
        resolve(duration);
      };
      element.onerror = () => {
        cleanup();
        resolve(null);
      };
      element.src = objectUrl;
    });
  }, []);
  const hideRequiredSlotCopy =
    field.type === 'image' &&
    (role === 'primary' || role === 'reference') &&
    engine.modes.includes('t2v') &&
    engine.modes.includes('i2v');

  const slotCount = useMemo(() => {
    if (maxCount > 0) return maxCount;
    return Math.max(minCount, assets.length + 1, 1);
  }, [assets.length, maxCount, minCount]);

  const slotAssets = useMemo(() => {
    const list = [...assets];
    if (list.length < slotCount) {
      for (let i = list.length; i < slotCount; i += 1) {
        list.push(null);
      }
    }
    return list;
  }, [assets, slotCount]);

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
      readMediaDuration,
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
  const fullBleedSingleAsset = slotAssets.length === 1 && slotAssets[0] != null && slotAssets[0]?.kind !== 'audio';
  const multiSlotGridClass =
    slotAssets.length >= 4
      ? 'grid-cols-2 lg:grid-cols-4'
      : slotAssets.length === 3
        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
        : slotAssets.length <= 1
          ? 'grid-cols-1'
          : 'grid-cols-1 sm:grid-cols-2';
  const shouldLimitSoloWidth = isSoloField && slotAssets.length === 1;

  return (
    <div
      className={clsx(
        'flex min-w-[260px]',
        shouldLimitSoloWidth ? 'w-full flex-none sm:max-w-[640px]' : 'w-full flex-1'
      )}
    >
      <div
        className={clsx(
          'flex w-full flex-col rounded-input border border-dashed border-border bg-surface-glass-80 text-text-secondary dark:border-white/[0.07] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.018))] dark:text-white/68',
          fullBleedSingleAsset ? 'relative min-h-[260px] overflow-hidden' : 'gap-4 p-4'
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
          {slotAssets.map((asset, index) => {
            const slotRequired = index < minCount;
            const showRequiredHint = slotRequired && engine.id !== 'wan-2-6' && !hideRequiredSlotCopy;
            const canOpenLibrary = Boolean(onOpenLibrary && (field.type === 'image' || field.type === 'video'));
            const flattenSlotSurface = slotAssets.length === 1;
            const filledSingleSlot = flattenSlotSurface && asset != null;
            const allowClick = asset == null || asset?.kind !== 'audio';
            const triggerFilePicker = () => {
              inputRefs.current[index]?.click();
            };
            const triggerLibrary = () => {
              onOpenLibrary?.(field, index);
            };

            const triggerSelection = () => {
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
                key={`${field.id}-slot-${index}`}
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
                    : 'cursor-default'
                )}
                onClick={triggerSelection}
                onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  triggerSelection();
                }}
                title={asset ? undefined : assetCopy.upload}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  void handleDrop(event, index);
                }}
                onPaste={(event) => {
                  void handlePaste(event, index);
                }}
              >
                <input
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  type="file"
                  accept={accept}
                  className="sr-only"
                  onChange={(event) => {
                    void onInputChange(event, index);
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
                        <video src={asset.previewUrl} controls className="absolute inset-0 h-full w-full bg-black object-cover" />
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
                        onRemove?.(field, index);
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
                            onRemove?.(field, index);
                          }}
                        >
                          {assetCopy.remove}
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/75 bg-surface-2/80 text-text-secondary dark:border-brand/25 dark:bg-brand/15 dark:text-brand">
                      <svg aria-hidden viewBox="0 0 20 20" className="h-3.5 w-3.5">
                        <path
                          d="M10 4.5v11m-5.5-5.5h11"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    {showRequiredHint ? <span className="text-[10px] text-warning dark:text-[#f6c667]">{assetCopy.neededBeforeGenerating}</span> : null}
                    <div className="flex w-full flex-wrap items-center justify-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-0 h-auto rounded-full border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary hover:border-text-muted hover:bg-transparent hover:text-text-primary dark:border-white/14 dark:bg-white/[0.045] dark:text-white/78 dark:hover:border-brand/30 dark:hover:bg-white/[0.08] dark:hover:text-white"
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
                          onClick={(event) => {
                            event.stopPropagation();
                            triggerLibrary();
                          }}
                        >
                          {assetCopy.library}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
