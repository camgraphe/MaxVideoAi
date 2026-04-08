'use client';

import clsx from 'clsx';
import { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export type KlingElementAsset = {
  id: string;
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

interface KlingElementsBuilderProps {
  elements: KlingElementState[];
  onAddElement: () => void;
  onRemoveElement: (id: string) => void;
  onAddAsset: (elementId: string, slot: 'frontal' | 'reference' | 'video', file: File, index?: number) => void;
  onRemoveAsset: (elementId: string, slot: 'frontal' | 'reference' | 'video', index?: number) => void;
  onOpenLibrary?: (elementId: string, slot: 'frontal' | 'reference', index?: number) => void;
  maxReferenceImages?: number;
  disableAdd?: boolean;
}

function AssetSlot({
  label,
  asset,
  accept,
  onSelect,
  onRemove,
  onOpenLibrary,
  disabled,
}: {
  label: string;
  asset: KlingElementAsset | null;
  accept: string;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onOpenLibrary?: () => void;
  disabled?: boolean;
}) {
  const allowLibrary = typeof onOpenLibrary === 'function' && accept.startsWith('image/');

  return (
    <div className="rounded-input border border-border bg-surface p-3 text-sm text-text-secondary">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] uppercase tracking-micro text-text-muted">{label}</span>
        {asset && (
          <div className="flex items-center gap-1">
            {allowLibrary ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onOpenLibrary}
                className="min-h-0 h-auto px-2 py-1 text-[11px]"
              >
                Library
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onRemove}
              className="min-h-0 h-auto px-2 py-1 text-[11px]"
            >
              Remove
            </Button>
          </div>
        )}
      </div>
      {asset ? (
        <div className="mt-2 flex items-center gap-3">
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
              {asset.status === 'uploading' ? 'Uploading…' : asset.status === 'error' ? asset.error ?? 'Upload failed' : 'Ready'}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <label
            className={clsx(
              'inline-flex cursor-pointer items-center gap-2 rounded-input border border-dashed border-border px-3 py-2 text-[12px] text-text-muted hover:border-text-muted',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            <input
              type="file"
              accept={accept}
              className="hidden"
              disabled={disabled}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (!file || disabled) return;
                onSelect(file);
                event.currentTarget.value = '';
              }}
            />
            Upload
          </label>
          {allowLibrary ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenLibrary}
              disabled={disabled}
              className="min-h-0 h-auto px-3 py-2 text-[12px]"
            >
              Library
            </Button>
          ) : null}
        </div>
      )}
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
}: KlingElementsBuilderProps) {
  const referenceSlots = useMemo(() => Math.max(1, maxReferenceImages), [maxReferenceImages]);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Elements (Kling v3)</h3>
          <p className="text-[12px] text-text-muted">
            Use a frontal image plus at least one reference image, or a video reference, for each element.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAddElement}
          disabled={disableAdd}
          className="min-h-0 h-auto px-3 py-1.5 text-[11px] uppercase tracking-micro"
        >
          + Element
        </Button>
      </div>
      <div className="space-y-4">
        {elements.map((element, index) => (
          <div key={element.id} className="rounded-input border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] uppercase tracking-micro text-text-muted">Element {index + 1}</span>
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
                onSelect={(file) => onAddAsset(element.id, 'video', file)}
                onRemove={() => onRemoveAsset(element.id, 'video')}
              />
            </div>
            <div className="mt-3 grid grid-gap-sm md:grid-cols-3">
              {Array.from({ length: referenceSlots }).map((_, slotIndex) => (
                <AssetSlot
                  key={`${element.id}-ref-${slotIndex}`}
                  label={`Reference ${slotIndex + 1}`}
                  asset={element.references[slotIndex] ?? null}
                  accept="image/*"
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
