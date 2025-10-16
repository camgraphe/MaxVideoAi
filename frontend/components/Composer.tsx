'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import type { Ref, ChangeEvent, DragEvent } from 'react';
import type { EngineCaps, EngineInputField, PreflightResponse } from '@/types/engines';
import type { EngineCaps as CapabilityCaps } from '@/fixtures/engineCaps';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CURRENCY_LOCALE } from '@/lib/intl';

export type ComposerAttachment = {
  kind: 'image' | 'video';
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  status?: 'uploading' | 'ready' | 'error';
  error?: string;
};

export type AssetFieldConfig = {
  field: EngineInputField;
  required: boolean;
};

interface Props {
  engine: EngineCaps;
  caps?: CapabilityCaps;
  prompt: string;
  onPromptChange: (value: string) => void;
  negativePrompt?: string;
  onNegativePromptChange?: (value: string) => void;
  price: number | null;
  currency: string;
  isLoading: boolean;
  error?: string;
  messages?: string[];
  textareaRef?: Ref<HTMLTextAreaElement>;
  onGenerate?: () => void;
  iterations?: number;
  preflight?: PreflightResponse | null;
  promptField?: EngineInputField;
  promptRequired: boolean;
  negativePromptField?: EngineInputField;
  negativePromptRequired?: boolean;
  assetFields: AssetFieldConfig[];
  assets: Record<string, (ComposerAttachment | null)[]>;
  onAssetAdd?: (field: EngineInputField, file: File, slotIndex?: number) => void;
  onAssetRemove?: (field: EngineInputField, index: number) => void;
  onNotice?: (message: string) => void;
  onOpenLibrary?: (field: EngineInputField, slotIndex: number) => void;
}

export function Composer({
  engine,
  caps,
  prompt,
  onPromptChange,
  negativePrompt,
  onNegativePromptChange,
  price,
  currency,
  isLoading,
  error,
  messages,
  textareaRef,
  onGenerate,
  iterations = 1,
  preflight,
  promptField,
  promptRequired,
  negativePromptField,
  negativePromptRequired = false,
  assetFields,
  assets,
  onAssetAdd,
  onAssetRemove,
  onNotice,
  onOpenLibrary,
}: Props) {
  const [isButtonAnimating, setIsButtonAnimating] = useState(false);
  const [isPulseVisible, setIsPulseVisible] = useState(false);
  const animationTimeoutRef = useRef<number | null>(null);

  const formattedPrice = useMemo(() => {
    if (price == null) return null;
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(price);
    } catch {
      return `${currency} ${price.toFixed(2)}`;
    }
  }, [price, currency]);

  const memberDiscount = preflight?.pricing?.discount;
  const promptLabel = promptField?.label ?? 'Prompt';
  const promptDescription = promptField?.description;
  const negativePromptLabel = negativePromptField?.label ?? 'Negative prompt';
  const negativePromptDescription = negativePromptField?.description;
  const negativePromptValue = (negativePrompt ?? '').trim();
  const disableGenerate =
    isLoading ||
    (promptRequired && !prompt.trim()) ||
    (negativePromptField && negativePromptRequired && !negativePromptValue);

  const triggerButtonAnimation = useCallback(() => {
    if (animationTimeoutRef.current) {
      window.clearTimeout(animationTimeoutRef.current);
    }
    setIsButtonAnimating(true);
    setIsPulseVisible(true);
    animationTimeoutRef.current = window.setTimeout(() => {
      setIsButtonAnimating(false);
      setIsPulseVisible(false);
      animationTimeoutRef.current = null;
    }, 240);
  }, []);

  const handleGenerateClick = useCallback(() => {
    if (disableGenerate) return;
    triggerButtonAnimation();
    onGenerate?.();
  }, [disableGenerate, onGenerate, triggerButtonAnimation]);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        window.clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    setIsPulseVisible(false);
    setIsButtonAnimating(false);
  }, [isLoading]);

  return (
    <Card className="space-y-5 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Composer</h2>
          <p className="text-sm text-text-secondary">Enhance prompt • Non-destructive reruns</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <Chip className="px-2.5 py-1" variant="outline">
            Pay-as-you-go
          </Chip>
          <Chip className="px-2.5 py-1" variant="outline">
            Price-before
          </Chip>
          <Chip className="px-2.5 py-1" variant="outline">
            Always-current
          </Chip>
          {formattedPrice && (
            <Chip variant="accent" className="px-3 py-1.5">
              This render: {formattedPrice}
            </Chip>
          )}
          {memberDiscount && memberDiscount.amountCents > 0 && (
            <Chip className="px-3 py-1.5 text-accent" variant="outline">
              Member price — You save {Math.round((memberDiscount.percentApplied ?? 0) * 100)}%
            </Chip>
          )}
        </div>
      </header>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-sm font-medium text-text-primary">{promptLabel}</span>
              {promptDescription && (
                <p className="text-[12px] text-text-muted">{promptDescription}</p>
              )}
            </div>
            <span className={clsx('rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-micro', promptRequired ? 'border-accent text-accent' : 'border-border text-text-muted')}>
              {promptRequired ? 'Required' : 'Optional'}
            </span>
          </div>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(event) => onPromptChange(event.currentTarget.value)}
              placeholder="Describe the shot..."
              rows={6}
              className="w-full rounded-input border border-border bg-white px-4 py-3 pr-28 text-sm leading-5 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              ref={textareaRef}
            />
            <button
              type="button"
              className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-input border border-hairline bg-white px-3 py-1.5 text-[12px] font-medium uppercase tracking-micro text-text-secondary transition hover:border-accentSoft/50 hover:bg-accentSoft/10 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Enhance prompt
            </button>
          </div>
        </div>

        {negativePromptField && (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] uppercase tracking-micro text-text-muted">{negativePromptLabel}</span>
              {negativePromptRequired && (
                <span className="text-[11px] text-text-muted/80">Required</span>
              )}
            </div>
            <input
              type="text"
              value={negativePrompt ?? ''}
              onChange={(event) => onNegativePromptChange?.(event.currentTarget.value)}
              placeholder="Elements to avoid…"
              className="w-full rounded-input border border-border bg-white px-4 py-2 text-sm leading-5 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {negativePromptDescription && (
              <p className="text-[12px] text-text-muted">{negativePromptDescription}</p>
            )}
          </div>
        )}

        {assetFields.length > 0 && (
          <div className="flex flex-wrap gap-3 text-sm">
            {assetFields.map(({ field, required }) => (
              <AssetDropzone
                key={field.id}
                engine={engine}
                caps={caps}
                field={field}
                required={required}
                assets={assets[field.id] ?? []}
                onSelect={onAssetAdd}
                onRemove={onAssetRemove}
                onError={onNotice}
                onOpenLibrary={onOpenLibrary}
              />
            ))}
          </div>
        )}
      </div>

      <footer className="flex flex-col gap-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3 text-xs text-text-muted">
          <span>Cmd+Enter • Generate</span>
          <span>G • Price-before</span>
          <span>S • Lock seed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-black/5 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-micro text-text-secondary">
            ×{Math.max(1, iterations)}
          </span>
          <button
            type="button"
            disabled={disableGenerate}
            className={clsx(
              'relative inline-flex items-center justify-center rounded-input px-5 py-3 text-sm font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'overflow-hidden transform-gpu transition-transform duration-200 ease-out',
              isButtonAnimating && !disableGenerate ? 'animate-button-pop' : '',
              disableGenerate
                ? 'cursor-not-allowed border border-border bg-white text-text-muted'
                : 'border border-accent bg-accent text-white shadow-card hover:brightness-[0.98] active:scale-[0.97]'
            )}
            onClick={handleGenerateClick}
          >
            <span className="relative z-10">{isLoading ? 'Checking price…' : 'Generate'}</span>
            <span
              aria-hidden
              className={clsx(
                'pointer-events-none absolute inset-0 rounded-input bg-white/20 opacity-0 transition-opacity duration-200 ease-out',
                isPulseVisible && !disableGenerate ? 'opacity-100' : ''
              )}
            />
          </button>
        </div>
      </footer>

      {error && <p className="text-sm text-[#F59E0B]">{error}</p>}
      {messages && messages.length > 0 && (
        <ul className="space-y-1 text-xs text-text-muted">
          {messages.map((message) => (
            <li key={message}>• {message}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

interface AssetDropzoneProps {
  engine: EngineCaps;
  caps?: CapabilityCaps;
  field: EngineInputField;
  required: boolean;
  assets: (ComposerAttachment | null)[];
  onSelect?: (field: EngineInputField, file: File, slotIndex: number) => void;
  onRemove?: (field: EngineInputField, index: number) => void;
  onError?: (message: string) => void;
  onOpenLibrary?: (field: EngineInputField, slotIndex: number) => void;
}

function AssetDropzone({ engine, caps, field, required, assets, onSelect, onRemove, onError, onOpenLibrary }: AssetDropzoneProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const maxCount = field.maxCount ?? 0;
  const minCount = field.minCount ?? (required ? 1 : 0);
  const acceptFormats = useMemo(
    () => caps?.acceptsImageFormats?.map((format) => format.toLowerCase()) ?? [],
    [caps?.acceptsImageFormats]
  );
  const accept = field.type === 'image'
    ? acceptFormats.length
      ? acceptFormats.map((ext) => `.${ext.replace(/^\./, '').toLowerCase()}`).join(',')
      : 'image/*'
    : 'video/*';
  const limits = engine.inputLimits;
  const constraints = engine.inputSchema?.constraints ?? {};

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
    (file: File, slotIndex: number) => {
      if (!onSelect) return;
      if (field.type === 'image') {
        if (!file.type.startsWith('image/')) {
          onError?.('Please drop an image file (PNG, JPG, WebP...).');
          return;
        }
        if (acceptFormats.length) {
          const ext = file.name.split('.').pop()?.toLowerCase();
          if (!ext || !acceptFormats.includes(ext)) {
            onError?.(`Format not supported. Allowed: ${acceptFormats.map((entry) => entry.toUpperCase()).join(', ')}`);
            return;
          }
        }
      }
      if (field.type === 'video' && !file.type.startsWith('video/')) {
        onError?.('Please drop a video file (MP4, MOV...).');
        return;
      }
      const maxSizeMB = field.type === 'image'
        ? caps?.maxUploadMB ?? constraints.maxImageSizeMB ?? limits.imageMaxMB
        : constraints.maxVideoSizeMB ?? limits.videoMaxMB;
      if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
        onError?.(`File exceeds the ${maxSizeMB} MB limit.`);
        return;
      }
      onSelect(field, file, slotIndex);
    },
    [acceptFormats, caps?.maxUploadMB, constraints.maxImageSizeMB, constraints.maxVideoSizeMB, field, limits.imageMaxMB, limits.videoMaxMB, onError, onSelect]
  );

  const onInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>, slotIndex: number) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      handleFile(file, slotIndex);
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, slotIndex: number) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      handleFile(file, slotIndex);
    },
    [handleFile]
  );

  const helperLines = useMemo(() => {
    const lines: string[] = [];
    if (field.type === 'image') {
      if (acceptFormats.length) {
        lines.push(`Formats: ${acceptFormats.map((ext) => ext.toUpperCase()).join(', ')}`);
      } else {
        lines.push('Formats: PNG, JPG, WebP');
      }
      const maxImage = caps?.maxUploadMB ?? constraints.maxImageSizeMB ?? limits.imageMaxMB;
      if (maxImage) lines.push(`${maxImage} MB max`);
    } else {
      lines.push('Formats: MP4, MOV');
      const maxVideo = constraints.maxVideoSizeMB ?? limits.videoMaxMB;
      if (maxVideo) lines.push(`${maxVideo} MB max`);
      if (limits.videoMaxDurationSec) lines.push(`${limits.videoMaxDurationSec}s max`);
    }
    if (field.maxCount && field.maxCount > 1) {
      lines.push(`Up to ${field.maxCount} files`);
    }
    if (field.minCount && field.minCount > 1) {
      lines.push(`At least ${field.minCount} files`);
    }
    return lines.join(' • ');
  }, [acceptFormats, caps?.maxUploadMB, constraints.maxImageSizeMB, constraints.maxVideoSizeMB, field.maxCount, field.minCount, field.type, limits.imageMaxMB, limits.videoMaxDurationSec, limits.videoMaxMB]);

  return (
    <div className="flex min-w-[260px] flex-1">
      <div className="flex w-full flex-col gap-3 rounded-input border border-dashed border-border bg-white/80 p-4 text-text-secondary">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-sm font-medium text-text-primary">{field.label}</span>
            {field.description && <p className="text-[11px] text-text-muted">{field.description}</p>}
          </div>
          <span className={clsx('rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-micro', required ? 'border-accent text-accent' : 'border-border text-text-muted')}>
            {required ? 'Required' : 'Optional'}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {slotAssets.map((asset, index) => {
            const slotRequired = index < minCount;
            const allowClick = asset === null || maxCount === 0;
            return (
              <div
                key={`${field.id}-slot-${index}`}
                className={clsx(
                  'relative flex h-36 w-full flex-col justify-center overflow-hidden rounded-card border border-border/70 bg-white text-center text-[12px] text-text-muted transition',
                  allowClick ? 'cursor-pointer hover:border-accentSoft/60 hover:bg-accentSoft/10' : 'cursor-default'
                )}
                onClick={() => {
                  if (!allowClick) return;
                  const input = inputRefs.current[index];
                  if (input) input.click();
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  handleDrop(event, index);
                }}
              >
                <input
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  type="file"
                  accept={accept}
                  className="sr-only"
                  onChange={(event) => onInputChange(event, index)}
                />
                {asset ? (
                  <>
                    {asset.kind === 'image' ? (
                      <img src={asset.previewUrl} alt={asset.name} className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <video src={asset.previewUrl} controls className="absolute inset-0 h-full w-full bg-black object-cover" />
                    )}
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-black/50 px-2 py-1 text-[11px] text-white">
                      <span className="truncate" title={asset.name}>
                        {asset.name}
                      </span>
                      <button
                        type="button"
                        className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-text-secondary transition hover:bg-white hover:text-text-primary"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemove?.(field, index);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    {asset.status === 'uploading' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 px-3 text-xs font-medium uppercase tracking-widest text-white">
                        Uploading…
                      </div>
                    )}
                    {asset.status === 'error' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 px-4 text-center text-xs text-white">
                        <span>{asset.error ?? 'Upload failed'}</span>
                        <button
                          type="button"
                          className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-text-primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemove?.(field, index);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-4">
                    <span className="text-[12px] font-medium text-text-secondary">{slotRequired ? 'Required' : 'Optional'} slot</span>
                    <span>Drag & drop or click to add.</span>
                    {helperLines && <span className="text-[11px] text-text-muted">{helperLines}</span>}
                    {slotRequired && <span className="text-[11px] text-[#F97316]">Needed before generating.</span>}
                  </div>
                )}
                {onOpenLibrary && field.type === 'image' && (
                  <button
                    type="button"
                    className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary shadow transition hover:bg-white hover:text-text-primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenLibrary(field, index);
                    }}
                  >
                    Library
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
