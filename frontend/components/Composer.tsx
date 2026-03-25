'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import type { Ref, ChangeEvent, DragEvent, ReactNode } from 'react';
import type { EngineCaps, EngineInputField, Mode, PreflightResponse } from '@/types/engines';
import type { EngineCaps as CapabilityCaps } from '@/fixtures/engineCaps';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button, ButtonLink } from '@/components/ui/Button';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getLocalizedAssetDropzoneCopy, normalizeUiLocale } from '@/lib/ltx-localization';

const VEO_REFERENCE_WARNING_ENGINES = new Set(['veo-3-1', 'veo-3-1-fast']);

export type ComposerAttachment = {
  kind: 'image' | 'video' | 'audio';
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  status?: 'uploading' | 'ready' | 'error';
  error?: string;
};

export type AssetFieldRole = 'primary' | 'reference' | 'frame' | 'generic';

export type AssetFieldConfig = {
  field: EngineInputField;
  required: boolean;
  role?: AssetFieldRole;
};

export type MultiPromptScene = {
  id: string;
  prompt: string;
  duration: number;
};

type AssetUploadMeta = {
  durationSec?: number;
};

type ComposerModeToggle = {
  mode: Mode | null;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
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
  onAssetAdd?: (field: EngineInputField, file: File, slotIndex?: number, meta?: AssetUploadMeta) => void;
  onAssetRemove?: (field: EngineInputField, index: number) => void;
  onNotice?: (message: string) => void;
  onOpenLibrary?: (field: EngineInputField, slotIndex: number) => void;
  settingsBar?: ReactNode;
  modeToggles?: ComposerModeToggle[];
  activeManualMode?: Mode | null;
  onModeToggle?: (mode: Mode | null) => void;
  multiPrompt?: {
    enabled: boolean;
    scenes: MultiPromptScene[];
    totalDurationSec: number;
    minDurationSec: number;
    maxDurationSec: number;
    onToggle: (enabled: boolean) => void;
    onAddScene: () => void;
    onRemoveScene: (id: string) => void;
    onUpdateScene: (id: string, patch: Partial<Pick<MultiPromptScene, 'prompt' | 'duration'>>) => void;
    error?: string | null;
  } | null;
  extraFields?: ReactNode;
  disableGenerate?: boolean;
  workflowNotice?: string | null;
}

const DEFAULT_COMPOSER_COPY = {
  title: 'Composer',
  subtitle: 'Enhance prompt • Non-destructive reruns',
  badges: {
    payg: 'Pay-as-you-go',
    priceBefore: 'Price-before',
    alwaysCurrent: 'Always-current',
  },
  priceLabel: 'This render: {amount}',
  memberLabel: 'Member price — You save {percent}%',
  labels: {
    required: 'Required',
    optional: 'Optional',
  },
  prompt: {
    placeholder: 'Describe the scene…',
    placeholderWithImage: 'Describe how the image should move / transform…',
  },
  negativePrompt: {
    placeholder: 'Elements to avoid…',
    requiredHint: 'Required',
  },
  assetSlots: {
    imageCtaLabel: 'Generate reference images',
    imageCtaHref: '/app/image',
    referenceWarning:
      'Veo 3.1 models treat this image as art direction and may reshape faces/outfits. For stricter face fidelity, try Pika 2.2 Image→Video or Kling 2.5 Turbo.',
  },
  shortcuts: {
    generate: 'Cmd+Enter • Generate',
    price: 'G • Price-before',
    seed: 'S • Lock seed',
  },
  iterationsLabel: '×{count}',
  button: {
    idle: 'Generate',
    loading: 'Checking price…',
  },
} as const;

type ComposerCopy = typeof DEFAULT_COMPOSER_COPY;

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
  settingsBar,
  modeToggles,
  activeManualMode,
  onModeToggle,
  multiPrompt,
  extraFields,
  disableGenerate,
  workflowNotice,
}: Props) {
  const { t } = useI18n();
  const composerCopy = useMemo<ComposerCopy>(() => {
    const localized = t('workspace.generate.composer', DEFAULT_COMPOSER_COPY) as Partial<ComposerCopy> | undefined;
    if (!localized) {
      return DEFAULT_COMPOSER_COPY;
    }
    return {
      ...DEFAULT_COMPOSER_COPY,
      ...localized,
      badges: {
        ...DEFAULT_COMPOSER_COPY.badges,
        ...(localized.badges ?? {}),
      },
      prompt: {
        ...DEFAULT_COMPOSER_COPY.prompt,
        ...(localized.prompt ?? {}),
      },
      negativePrompt: {
        ...DEFAULT_COMPOSER_COPY.negativePrompt,
        ...(localized.negativePrompt ?? {}),
      },
      shortcuts: {
        ...DEFAULT_COMPOSER_COPY.shortcuts,
        ...(localized.shortcuts ?? {}),
      },
      labels: {
        ...DEFAULT_COMPOSER_COPY.labels,
        ...(localized.labels ?? {}),
      },
      button: {
        ...DEFAULT_COMPOSER_COPY.button,
        ...(localized.button ?? {}),
      },
      assetSlots: {
        ...DEFAULT_COMPOSER_COPY.assetSlots,
        ...(localized.assetSlots ?? {}),
      },
    };
  }, [t]);
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
  const multiPromptEnabled = Boolean(multiPrompt?.enabled);
  const promptMaxChars = engine.inputLimits.promptMaxChars;
  const promptCharCount = prompt.length;
  const promptTooLong = !multiPromptEnabled && typeof promptMaxChars === 'number' && promptCharCount > promptMaxChars;
  const promptValueReady = multiPromptEnabled ? true : Boolean(prompt.trim());
  const isGenerateDisabled =
    Boolean(disableGenerate) ||
    isLoading ||
    promptTooLong ||
    (promptRequired && !promptValueReady) ||
    (negativePromptField && negativePromptRequired && !negativePromptValue);
  const showSoraImageWarning = engine.id.startsWith('sora-2') && assetFields.some((entry) => entry.field.type === 'image');
  const hasReferenceImage = useMemo(() => {
    return assetFields.some((entry) => {
      if (entry.field.type !== 'image') return false;
      const entries = assets[entry.field.id] ?? [];
      return entries.some((asset) => asset?.kind === 'image');
    });
  }, [assetFields, assets]);
  const orderedAssetFields = useMemo(() => {
    if (!engine.id.startsWith('ltx-2-3')) {
      return assetFields;
    }

    const order = new Map<string, number>([
      ['image_url', 0],
      ['end_image_url', 1],
      ['audio_url', 2],
      ['video_url', 3],
    ]);

    return [...assetFields].sort((left, right) => {
      const leftRank = order.get(left.field.id) ?? 99;
      const rightRank = order.get(right.field.id) ?? 99;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return left.field.id.localeCompare(right.field.id);
    });
  }, [assetFields, engine.id]);
  const useLtxAssetGridLayout = engine.id.startsWith('ltx-2-3');
  const promptPlaceholder = hasReferenceImage
    ? composerCopy.prompt.placeholderWithImage ?? composerCopy.prompt.placeholder
    : composerCopy.prompt.placeholder;

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
    if (isGenerateDisabled) return;
    triggerButtonAnimation();
    onGenerate?.();
  }, [isGenerateDisabled, onGenerate, triggerButtonAnimation]);

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
    <Card className="stack-gap-lg p-5">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-text-primary">{promptLabel}</span>
              {modeToggles && modeToggles.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {modeToggles.map((entry) => {
                    const active = activeManualMode === entry.mode;
                    return (
                      <Button
                        key={entry.mode ?? 'base'}
                        type="button"
                        size="sm"
                        variant={active ? 'primary' : 'outline'}
                        onClick={() => onModeToggle?.(entry.mode === null ? null : active ? null : entry.mode)}
                        disabled={entry.disabled}
                        title={entry.disabledReason}
                        className="min-h-0 h-auto rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-micro"
                      >
                        {entry.label}
                      </Button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              {multiPrompt && (
                <Button
                  type="button"
                  size="sm"
                  variant={multiPromptEnabled ? 'primary' : 'outline'}
                  onClick={() => multiPrompt.onToggle(!multiPromptEnabled)}
                  className="min-h-0 h-auto px-3 py-1.5 text-[11px] uppercase tracking-micro"
                >
                  {multiPromptEnabled ? 'Multi-prompt on' : 'Multi-prompt'}
                </Button>
              )}
              {formattedPrice && (
                <Chip
                  variant="outline"
                  className="chip-price px-3 py-1.5 font-semibold shadow-sm"
                >
                  {composerCopy.priceLabel.replace('{amount}', formattedPrice)}
                </Chip>
              )}
              {memberDiscount && memberDiscount.amountCents > 0 && (
                <Chip className="px-3 py-1.5 text-brand" variant="outline">
                  {composerCopy.memberLabel.replace(
                    '{percent}',
                    String(Math.round((memberDiscount.percentApplied ?? 0) * 100))
                  )}
                </Chip>
              )}
            </div>
          </div>
          {promptDescription && (
            <p className="text-[12px] text-text-muted">{promptDescription}</p>
          )}
          {workflowNotice ? (
            <div className="rounded-input border border-border bg-surface-glass-80 px-3 py-2 text-[12px] text-text-secondary">
              {workflowNotice}
            </div>
          ) : null}
          {multiPromptEnabled && multiPrompt ? (
            <div className="space-y-3">
              {multiPrompt.scenes.map((scene, index) => (
                <div
                  key={scene.id}
                  className="rounded-input border border-border bg-surface p-3 text-sm text-text-secondary"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] uppercase tracking-micro text-text-muted">Scene {index + 1}</span>
                    {multiPrompt.scenes.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => multiPrompt.onRemoveScene(scene.id)}
                        className="min-h-0 h-auto px-2 py-1 text-[11px]"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <textarea
                    value={scene.prompt}
                    onChange={(event) => multiPrompt.onUpdateScene(scene.id, { prompt: event.currentTarget.value })}
                    placeholder={`Scene ${index + 1} prompt`}
                    rows={3}
                    className="mt-2 w-full rounded-input border border-border bg-surface px-3 py-2 text-sm leading-5 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="mt-2 flex items-center gap-2 text-[12px] text-text-muted">
                    <span>Duration (s)</span>
                    <input
                      type="number"
                      min={multiPrompt.minDurationSec}
                      max={multiPrompt.maxDurationSec}
                      value={scene.duration}
                      onChange={(event) =>
                        multiPrompt.onUpdateScene(scene.id, {
                          duration: Math.max(0, Math.round(Number(event.currentTarget.value))),
                        })
                      }
                      className="w-20 rounded-input border border-border bg-surface px-2 py-1 text-right text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-text-muted">
                <span>
                  Total: {multiPrompt.totalDurationSec}s · Min {multiPrompt.minDurationSec}s · Max {multiPrompt.maxDurationSec}s
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={multiPrompt.onAddScene}
                  className="min-h-0 h-auto px-3 py-1.5 text-[11px] uppercase tracking-micro"
                >
                  + Scene
                </Button>
              </div>
              {multiPrompt.error && (
                <div className="rounded-input border border-error-border bg-error-bg px-3 py-2 text-[12px] text-error">
                  {multiPrompt.error}
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(event) => onPromptChange(event.currentTarget.value)}
                placeholder={promptPlaceholder}
                rows={6}
                aria-invalid={promptTooLong || undefined}
                className={clsx(
                  'w-full rounded-input border bg-surface px-4 py-3 text-sm leading-5 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  promptTooLong ? 'border-error-border focus-visible:ring-error' : 'border-border'
                )}
                ref={textareaRef}
              />
              {typeof promptMaxChars === 'number' ? (
                <div
                  className={clsx(
                    'mt-2 flex justify-end text-[12px]',
                    promptTooLong ? 'text-error' : 'text-text-muted'
                  )}
                >
                  {promptCharCount}/{promptMaxChars} characters
                </div>
              ) : null}
            </div>
          )}
        </div>

        {(settingsBar || onGenerate) && (
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end lg:flex-nowrap">
            {settingsBar ? <div className="min-w-0 flex-1">{settingsBar}</div> : null}
            {onGenerate ? (
              <Button
                type="button"
                size="md"
                disabled={isGenerateDisabled}
                className={clsx(
                  'relative w-full shrink-0 px-5 py-3 uppercase tracking-micro sm:w-auto',
                  'overflow-hidden transform-gpu transition-transform duration-200 ease-out',
                  'border border-brand shadow-card',
                  'disabled:border-border disabled:bg-surface disabled:text-text-muted disabled:shadow-none',
                  isButtonAnimating && !isGenerateDisabled ? 'animate-button-pop' : '',
                  isGenerateDisabled ? '' : 'active:scale-[0.97]'
                )}
                onClick={handleGenerateClick}
              >
                <span className="relative z-10">{isLoading ? composerCopy.button.loading : composerCopy.button.idle}</span>
                <span
                  aria-hidden
                  className={clsx(
                    'pointer-events-none absolute inset-0 rounded-input bg-surface-on-media-20 opacity-0 transition-opacity duration-200 ease-out',
                    isPulseVisible && !isGenerateDisabled ? 'opacity-100' : ''
                  )}
                />
              </Button>
            ) : null}
          </div>
        )}

        {error && (
          <div className="rounded-input border border-error-border bg-error-bg px-3 py-2 text-[13px] text-error whitespace-pre-line">
            {error}
          </div>
        )}

        {negativePromptField && (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] uppercase tracking-micro text-text-muted">{negativePromptLabel}</span>
              {negativePromptRequired && (
                <span className="text-[11px] text-text-muted/80">{composerCopy.negativePrompt.requiredHint}</span>
              )}
            </div>
            <input
              type="text"
              value={negativePrompt ?? ''}
              onChange={(event) => onNegativePromptChange?.(event.currentTarget.value)}
              placeholder={negativePromptDescription ?? composerCopy.negativePrompt.placeholder}
              className="w-full rounded-input border border-border bg-surface px-4 py-2 text-sm leading-5 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {negativePromptDescription && (
              <p className="text-[12px] text-text-muted">{negativePromptDescription}</p>
            )}
          </div>
        )}

        {assetFields.length > 0 && (
          <div className="space-y-2">
            <div
              className={clsx(
                'text-sm',
                useLtxAssetGridLayout ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'flex flex-wrap gap-4'
              )}
            >
              {orderedAssetFields.map(({ field, required, role }) => (
                <AssetDropzone
                  key={field.id}
                  engine={engine}
                  caps={caps}
                  field={field}
                  required={required}
                  role={role}
                  assets={assets[field.id] ?? []}
                  onSelect={onAssetAdd}
                  onRemove={onAssetRemove}
                  onError={onNotice}
                  onOpenLibrary={onOpenLibrary}
                  assetSlotCta={
                    field.type === 'image'
                      ? { href: composerCopy.assetSlots.imageCtaHref, label: composerCopy.assetSlots.imageCtaLabel }
                      : undefined
                  }
                  referenceWarning={composerCopy.assetSlots.referenceWarning}
                />
              ))}
            </div>
            {showSoraImageWarning ? (
              <p className="text-[12px] text-text-muted" role="note">
                Real people — including public figures — cannot be generated. Input images with faces of humans are currently rejected.{' '}
                <span className="font-semibold uppercase tracking-micro text-[11px] text-text-muted">OpenAI</span>
              </p>
            ) : null}
          </div>
        )}

        {extraFields ? <div className="space-y-2">{extraFields}</div> : null}
      </div>
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
  role?: AssetFieldRole;
  assets: (ComposerAttachment | null)[];
  onSelect?: (field: EngineInputField, file: File, slotIndex: number, meta?: AssetUploadMeta) => void;
  onRemove?: (field: EngineInputField, index: number) => void;
  onError?: (message: string) => void;
  onOpenLibrary?: (field: EngineInputField, slotIndex: number) => void;
  assetSlotCta?: { href: string; label: string };
  referenceWarning?: string;
}

function AssetDropzone({
  engine,
  caps,
  field,
  required,
  role = 'generic',
  assets,
  onSelect,
  onRemove,
  onError,
  onOpenLibrary,
  assetSlotCta,
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
      if (!file) return;
      await handleFile(file, slotIndex);
    },
    [handleFile]
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
    caps?.maxUploadMB,
    constraints.maxAudioSizeMB,
    constraints.maxImageSizeMB,
    constraints.maxVideoSizeMB,
    field.maxCount,
    field.maxDurationSec,
    field.id,
    field.minDurationSec,
    field.minCount,
    field.type,
    limits.audioMaxDurationSec,
    limits.audioMaxMB,
    limits.imageMaxMB,
    limits.videoMaxDurationSec,
    limits.videoMaxMB,
    assetCopy,
  ]);

  return (
    <div className="flex min-w-[260px] flex-1">
      <div className="flex w-full flex-col gap-4 rounded-input border border-dashed border-border bg-surface-glass-80 p-4 text-text-secondary">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-sm font-medium text-text-primary">
              {role === 'primary'
                ? field.label ?? assetCopy.primaryImageFallback
                : role === 'reference'
                  ? field.label ?? assetCopy.additionalReferencesFallback
                  : role === 'frame'
                    ? field.label ?? assetCopy.frameFallback
                    : field.label}
            </span>
            {(role === 'primary' || role === 'reference' || role === 'frame' || field.description) && (
              <p className="text-[11px] text-text-muted">
                {role === 'primary'
                  ? assetCopy.primaryRoleDescription
                  : role === 'reference'
                    ? assetCopy.referenceRoleDescription
                    : role === 'frame'
                      ? assetCopy.frameRoleDescription
                      : null}
                {field.description ? ` ${field.description}` : ''}
              </p>
            )}
            {referenceWarning && role !== 'frame' && VEO_REFERENCE_WARNING_ENGINES.has(engine.id) && (
              <p className="mt-1 text-[11px] text-state-warning">{referenceWarning}</p>
            )}
          </div>
          <span className={clsx('rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-micro', required ? 'border-brand text-brand' : 'border-border text-text-muted')}>
            {required ? assetCopy.required : assetCopy.optional}
          </span>
        </div>

        <div
          className={clsx(
            'grid gap-2',
            slotAssets.length <= 1 ? 'sm:grid-cols-1' : 'sm:grid-cols-2'
          )}
        >
          {slotAssets.map((asset, index) => {
            const slotRequired = index < minCount;
            const showRequiredHint = slotRequired && engine.id !== 'wan-2-6' && !hideRequiredSlotCopy;
            const slotLabel = hideRequiredSlotCopy
              ? assetCopy.imageSlot
              : slotRequired
                ? assetCopy.required
                : assetCopy.optional;
            const allowClick = asset === null || maxCount === 0;
            return (
              <div
                key={`${field.id}-slot-${index}`}
                className={clsx(
                  'relative flex h-36 w-full flex-col justify-center overflow-hidden rounded-card border border-border/70 bg-surface text-center text-[12px] text-text-muted transition',
                  allowClick ? 'cursor-pointer hover:border-text-muted hover:bg-surface-2' : 'cursor-default'
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
                      <img src={asset.previewUrl} alt={asset.name} className="absolute inset-0 h-full w-full bg-surface object-contain" />
                    ) : asset.kind === 'audio' ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-surface p-4">
                        <audio src={asset.previewUrl} controls className="w-full" />
                      </div>
                    ) : (
                      <>
                            <video src={asset.previewUrl} controls className="absolute inset-0 h-full w-full bg-black object-contain" />
                            <AudioEqualizerBadge tone="light" size="sm" label={assetCopy.videoIncludesAudio} />
                          </>
                        )}
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-surface-on-media-dark-50 px-2 py-1 text-[11px] text-on-inverse">
                      <span className="truncate" title={asset.name}>
                        {asset.name}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-0 h-auto rounded-full bg-surface-glass-90 px-2 py-0.5 text-[10px] font-medium text-text-secondary shadow-none hover:bg-surface hover:text-text-primary"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemove?.(field, index);
                        }}
                      >
                        {assetCopy.remove}
                      </Button>
                    </div>
                    {asset.status === 'uploading' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-surface-on-media-dark-50 px-3 text-xs font-medium uppercase tracking-widest text-on-inverse">
                        {assetCopy.uploading}
                      </div>
                    )}
                    {asset.status === 'error' && (
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
                    )}
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1.5 px-3 text-center">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                      {assetCopy.slotSuffix(slotLabel)}
                    </span>
                    <span className="text-[11px] text-text-muted">
                      {assetCopy.addFile(helperLines.length > 0 ? helperLines.join(' • ') : '')}
                    </span>
                    {showRequiredHint && <span className="text-[10px] text-warning">{assetCopy.neededBeforeGenerating}</span>}
                    {(field.type === 'image' || field.type === 'video') && (
                      <div className="flex w-full items-center justify-center gap-2 pt-1">
                        {assetSlotCta ? (
                          <ButtonLink
                            href={assetSlotCta.href}
                            size="sm"
                            variant="outline"
                            className="min-h-0 h-auto flex-1 rounded-full border-brand px-2 py-1 text-[10px] font-semibold text-brand hover:bg-surface-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {assetSlotCta.label}
                          </ButtonLink>
                        ) : null}
                        {onOpenLibrary ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-0 h-auto flex-1 rounded-full border-border px-2 py-1 text-[10px] font-semibold text-text-secondary hover:border-text-muted hover:bg-transparent hover:text-text-primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenLibrary(field, index);
                            }}
                          >
                            {assetCopy.library}
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
                {asset && onOpenLibrary && (field.type === 'image' || field.type === 'video') && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="absolute bottom-2 right-2 min-h-0 h-auto rounded-full bg-surface-glass-90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary shadow-none hover:bg-surface hover:text-text-primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenLibrary(field, index);
                    }}
                  >
                    {assetCopy.library}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
