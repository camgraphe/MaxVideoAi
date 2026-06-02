'use client';

import clsx from 'clsx';
import { useId, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { AssetFieldTooltip } from '@/components/asset-dropzone/AssetFieldTooltip';
import { AssetMediaPickerMenu } from '@/components/asset-dropzone/AssetMediaPickerMenu';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getLocalizedAssetDropzoneCopy, normalizeUiLocale } from '@/lib/ltx-localization';

const SUBJECT_REFERENCE_DETAILS =
  'Use a frontal image plus at least one reference image, or a video reference, for each subject.';

type AssetDropzoneCopy = ReturnType<typeof getLocalizedAssetDropzoneCopy>;

export type KlingElementAsset = {
  id: string;
  assetId?: string;
  previewUrl: string;
  name: string;
  kind: 'image' | 'video';
  status: 'uploading' | 'ready' | 'error';
  error?: string;
  url?: string;
};

export type KlingElementState = {
  id: string;
  frontal: KlingElementAsset | null;
  references: (KlingElementAsset | null)[];
  video: KlingElementAsset | null;
};

export interface KlingElementsBuilderProps {
  elements: KlingElementState[];
  onAddElement: () => void;
  onRemoveElement: (id: string) => void;
  onAddAsset: (elementId: string, slot: 'frontal' | 'reference' | 'video', file: File, index?: number) => void;
  onRemoveAsset: (elementId: string, slot: 'frontal' | 'reference' | 'video', index?: number) => void;
  onOpenLibrary?: (elementId: string, slot: 'frontal' | 'reference' | 'video', index?: number) => void;
  maxReferenceImages?: number;
  disableAdd?: boolean;
  videoReferenceDisabledReason?: string | null;
}

function AssetSlot({
  label,
  asset,
  accept,
  assetCopy,
  onSelect,
  onRemove,
  onOpenLibrary,
  disabled,
  disabledReason,
}: {
  label: string;
  asset: KlingElementAsset | null;
  accept: string;
  assetCopy: AssetDropzoneCopy;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onOpenLibrary?: () => void;
  disabled?: boolean;
  disabledReason?: string | null;
}) {
  const allowLibrary = typeof onOpenLibrary === 'function' && (accept.startsWith('image/') || accept.startsWith('video/'));
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuId = useId();
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file || disabled) return;
    if (accept.startsWith('image/') && !file.type.startsWith('image/')) return;
    if (accept.startsWith('video/') && !file.type.startsWith('video/')) return;
    onSelect(file);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFile(event.dataTransfer.files?.[0]);
  };

  const triggerUpload = () => {
    if (disabled) return;
    setPickerOpen(false);
    inputRef.current?.click();
  };

  const triggerLibrary = () => {
    if (disabled || !allowLibrary) return;
    setPickerOpen(false);
    onOpenLibrary?.();
  };

  const openPicker = () => {
    if (disabled) return;
    setPickerOpen(true);
  };

  const handlePickerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && pickerOpen) {
      event.stopPropagation();
      setPickerOpen(false);
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openPicker();
  };

  return (
    <div
      className={clsx(
        'relative rounded-input border border-border bg-surface p-3 text-sm text-text-secondary',
        pickerOpen && 'z-30 overflow-visible'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] uppercase tracking-micro text-text-muted">{label}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        title={disabledReason ?? undefined}
        onChange={handleInputChange}
      />
      {asset ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          aria-controls={pickerOpen ? menuId : undefined}
          title={disabled ? disabledReason ?? undefined : assetCopy.chooseMedia}
          className={clsx(
            'relative mt-2 flex min-h-[76px] items-center gap-3 rounded-input border border-border bg-surface-2 p-2 pr-10 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            disabled
              ? 'cursor-default opacity-70'
              : 'cursor-pointer hover:border-brand/45 hover:bg-surface'
          )}
          onClick={openPicker}
          onKeyDown={handlePickerKeyDown}
        >
          {asset.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.previewUrl}
              alt={asset.name}
              className="h-16 w-24 rounded-input border border-border object-cover"
            />
          ) : (
            <div className="flex h-16 w-24 items-center justify-center rounded-input border border-border bg-surface-2 text-[11px] text-text-muted">
              Video
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[12px] text-text-primary">{asset.name}</p>
            <p className="line-clamp-2 text-[11px] text-text-muted" title={asset.error}>
              {asset.status === 'uploading'
                ? assetCopy.uploading
                : asset.status === 'error'
                  ? asset.error ?? assetCopy.uploadFailed
                  : 'Ready'}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            className="absolute right-2 top-2 h-7 min-h-0 w-7 rounded-full p-0"
            aria-label={assetCopy.remove}
            title={assetCopy.remove}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          aria-controls={pickerOpen ? menuId : undefined}
          title={disabled ? disabledReason ?? undefined : assetCopy.addMedia}
          className={clsx(
            'mt-2 flex min-h-[88px] items-center justify-center rounded-input border border-dashed border-border bg-surface-2/60 text-text-secondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            disabled
              ? 'cursor-not-allowed opacity-60'
              : 'cursor-pointer hover:border-brand/45 hover:bg-surface'
          )}
          onClick={openPicker}
          onKeyDown={handlePickerKeyDown}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={handleDrop}
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-sm">
            {disabled ? (
              <Lock className="h-4 w-4" aria-hidden />
            ) : (
              <Plus className="h-5 w-5" aria-hidden />
            )}
          </span>
          <span className="sr-only">{assetCopy.addMedia}</span>
        </div>
      )}
      {!disabled ? (
        <AssetMediaPickerMenu
          copy={assetCopy}
          canOpenLibrary={allowLibrary}
          menuId={menuId}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onLibrary={triggerLibrary}
          onUpload={triggerUpload}
        />
      ) : null}
      {disabled && disabledReason ? (
        <p className="mt-2 text-[11px] leading-4 text-text-muted">{disabledReason}</p>
      ) : null}
    </div>
  );
}

export function KlingElementsBuilder({
  elements,
  onAddElement,
  onRemoveElement,
  onAddAsset,
  onRemoveAsset,
  onOpenLibrary,
  maxReferenceImages = 3,
  disableAdd = false,
  videoReferenceDisabledReason = null,
}: KlingElementsBuilderProps) {
  const { locale } = useI18n();
  const assetCopy = useMemo(() => getLocalizedAssetDropzoneCopy(normalizeUiLocale(locale)), [locale]);
  const referenceSlots = useMemo(() => Math.max(1, maxReferenceImages), [maxReferenceImages]);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Subject references</h3>
            <AssetFieldTooltip
              tooltipId="kling-subject-reference-details"
              details={[SUBJECT_REFERENCE_DETAILS]}
              fullBleedSingleAsset={false}
            />
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAddElement}
          disabled={disableAdd}
          className="min-h-0 h-auto px-3 py-1.5 text-[11px] uppercase tracking-micro"
        >
          + Subject
        </Button>
      </div>
      <div className="space-y-4">
        {elements.map((element, index) => (
          <div key={element.id} className="rounded-input border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] uppercase tracking-micro text-text-muted">Subject {index + 1}</span>
              {elements.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemoveElement(element.id)}
                  className="min-h-0 h-auto px-2 py-1 text-[11px]"
                >
                  Remove
                </Button>
              )}
            </div>
            <div className="mt-3 grid grid-gap-sm md:grid-cols-2">
              <AssetSlot
                label="Frontal image"
                asset={element.frontal}
                accept="image/*"
                assetCopy={assetCopy}
                onSelect={(file) => onAddAsset(element.id, 'frontal', file)}
                onRemove={() => onRemoveAsset(element.id, 'frontal')}
                onOpenLibrary={
                  onOpenLibrary
                    ? () => onOpenLibrary(element.id, 'frontal')
                    : undefined
                }
              />
              <AssetSlot
                label="Video reference"
                asset={element.video}
                accept="video/*"
                assetCopy={assetCopy}
                onSelect={(file) => onAddAsset(element.id, 'video', file)}
                onRemove={() => onRemoveAsset(element.id, 'video')}
                onOpenLibrary={
                  onOpenLibrary
                    ? () => onOpenLibrary(element.id, 'video')
                    : undefined
                }
                disabled={Boolean(videoReferenceDisabledReason)}
                disabledReason={videoReferenceDisabledReason}
              />
            </div>
            <div className="mt-3 grid grid-gap-sm md:grid-cols-3">
              {Array.from({ length: referenceSlots }).map((_, slotIndex) => (
                <AssetSlot
                  key={`${element.id}-ref-${slotIndex}`}
                  label={`Reference ${slotIndex + 1}`}
                  asset={element.references[slotIndex] ?? null}
                  accept="image/*"
                  assetCopy={assetCopy}
                  onSelect={(file) => onAddAsset(element.id, 'reference', file, slotIndex)}
                  onRemove={() => onRemoveAsset(element.id, 'reference', slotIndex)}
                  onOpenLibrary={
                    onOpenLibrary
                      ? () => onOpenLibrary(element.id, 'reference', slotIndex)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
