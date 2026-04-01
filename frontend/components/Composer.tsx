'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import type { Ref, ChangeEvent, DragEvent, ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import type { EngineCaps, EngineInputField, Mode, PreflightResponse } from '@/types/engines';
import type { EngineCaps as CapabilityCaps } from '@/fixtures/engineCaps';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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

export type ComposerPromotedAction = {
  id: string;
  label: string;
  tooltip?: string;
  active: boolean;
  icon: 'sparkles' | 'shield';
  onToggle: () => void;
  disabled?: boolean;
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
  promotedActions?: ComposerPromotedAction[];
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
    referenceWarning: '',
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
  promotedActions,
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

  const resolvedGenerateLabel = isLoading ? composerCopy.button.loading : composerCopy.button.idle;

  return (
    <Card className="overflow-visible border-border/90 p-4 md:p-5">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            {modeToggles && modeToggles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
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
                      className="min-h-0 h-10 rounded-2xl px-4 py-0 text-[12px] font-semibold"
                    >
                      {entry.label}
                    </Button>
                  );
                })}
              </div>
            ) : null}
            {(promptDescription || workflowNotice) && (
              <div className="space-y-1">
                {promptDescription ? <p className="text-[12px] text-text-muted">{promptDescription}</p> : null}
                {workflowNotice ? (
                  <div className="rounded-input border border-border bg-surface-glass-80 px-3 py-2 text-[12px] text-text-secondary">
                    {workflowNotice}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
            <div
              className={clsx(
                'overflow-visible rounded-[28px] border bg-surface',
                promptTooLong ? 'border-error-border' : 'border-border'
              )}
            >
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-2 pt-4">
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{promptLabel}</span>
                {typeof promptMaxChars === 'number' ? (
                  <div className={clsx('text-[12px]', promptTooLong ? 'text-error' : 'text-text-muted')}>
                    {promptCharCount}/{promptMaxChars}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {multiPrompt ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={multiPromptEnabled ? 'primary' : 'outline'}
                    onClick={() => multiPrompt.onToggle(!multiPromptEnabled)}
                    className="min-h-0 h-8 rounded-full px-3 py-0 text-[10px] font-semibold uppercase tracking-micro"
                  >
                    {multiPromptEnabled ? 'Multi-prompt on' : 'Multi-prompt'}
                  </Button>
                ) : null}
                {promotedActions?.map((action) => (
                  <Button
                    key={action.id}
                    type="button"
                    size="sm"
                    variant={action.active ? 'primary' : 'outline'}
                    onClick={action.onToggle}
                    disabled={action.disabled}
                    title={action.tooltip ?? action.label}
                    aria-label={action.tooltip ?? action.label}
                    aria-pressed={action.active}
                    className="min-h-0 h-8 rounded-full px-2.5 py-0 text-[10px] font-semibold"
                  >
                    <span className="shrink-0">{renderPromotedActionIcon(action.icon)}</span>
                    <span className="whitespace-nowrap">{action.label}</span>
                  </Button>
                ))}
              </div>
            </div>
            {multiPromptEnabled && multiPrompt ? (
              <div className="space-y-3 px-4 pb-4">
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
                    className="min-h-0 h-auto rounded-full px-3 py-1.5 text-[11px] uppercase tracking-micro"
                  >
                    + Scene
                  </Button>
                </div>
                {multiPrompt.error ? (
                  <div className="rounded-input border border-error-border bg-error-bg px-3 py-2 text-[12px] text-error">
                    {multiPrompt.error}
                  </div>
                ) : null}
              </div>
            ) : (
              <textarea
                value={prompt}
                onChange={(event) => onPromptChange(event.currentTarget.value)}
                placeholder={promptPlaceholder}
                rows={6}
                aria-invalid={promptTooLong || undefined}
                className={clsx(
                  'min-h-[180px] w-full border-0 bg-transparent px-5 pb-4 pt-0 text-sm leading-6 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-0',
                  promptTooLong ? 'focus-visible:ring-error' : ''
                )}
                ref={textareaRef}
              />
            )}

            {(settingsBar || onGenerate) ? (
              <div className="border-t border-border/70 px-4 py-3">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  {settingsBar ? <div className="min-w-0 flex-1">{settingsBar}</div> : null}
                  {onGenerate ? (
                    <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                      {memberDiscount && memberDiscount.amountCents > 0 ? (
                        <span className="text-[11px] text-text-muted">
                          {composerCopy.memberLabel.replace(
                            '{percent}',
                            String(Math.round((memberDiscount.percentApplied ?? 0) * 100))
                          )}
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        size="md"
                        disabled={isGenerateDisabled}
                        className={clsx(
                          'relative w-full min-w-[220px] justify-between gap-4 overflow-hidden rounded-[24px] px-5 py-3 text-left',
                          'transform-gpu transition-transform duration-200 ease-out',
                          'border border-brand shadow-card',
                          'disabled:border-border disabled:bg-surface disabled:text-text-muted disabled:shadow-none',
                          isButtonAnimating && !isGenerateDisabled ? 'animate-button-pop' : '',
                          isGenerateDisabled ? '' : 'active:scale-[0.97]',
                          formattedPrice ? 'sm:min-w-[260px]' : ''
                        )}
                        onClick={handleGenerateClick}
                      >
                        <span className="relative z-10 text-sm font-semibold uppercase tracking-micro">{resolvedGenerateLabel}</span>
                        {formattedPrice ? (
                          <span className="relative z-10 inline-flex items-center rounded-full border border-current/15 bg-surface-on-media-20 px-3 py-1 text-sm font-semibold normal-case">
                            {formattedPrice}
                          </span>
                        ) : null}
                        <span
                          aria-hidden
                          className={clsx(
                            'pointer-events-none absolute inset-0 rounded-[24px] bg-surface-on-media-20 opacity-0 transition-opacity duration-200 ease-out',
                            isPulseVisible && !isGenerateDisabled ? 'opacity-100' : ''
                          )}
                        />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {assetFields.length > 0 ? (
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
                  isSoloField={orderedAssetFields.length === 1}
                  role={role}
                  assets={assets[field.id] ?? []}
                  onSelect={onAssetAdd}
                  onRemove={onAssetRemove}
                  onError={onNotice}
                  onOpenLibrary={onOpenLibrary}
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
        ) : null}

        {negativePromptField ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{negativePromptLabel}</span>
              {negativePromptRequired ? (
                <span className="text-[11px] text-text-muted/80">{composerCopy.negativePrompt.requiredHint}</span>
              ) : null}
            </div>
            <input
              type="text"
              value={negativePrompt ?? ''}
              onChange={(event) => onNegativePromptChange?.(event.currentTarget.value)}
              placeholder={negativePromptDescription ?? composerCopy.negativePrompt.placeholder}
              className="h-11 w-full rounded-input border border-border bg-surface px-4 text-sm leading-5 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        ) : null}

        {error ? (
          <div className="rounded-input border border-error-border bg-error-bg px-3 py-2 text-[13px] text-error whitespace-pre-line">
            {error}
          </div>
        ) : null}

        {extraFields ? <div className="space-y-4 border-t border-border/70 pt-4">{extraFields}</div> : null}
      </div>
      {messages && messages.length > 0 ? (
        <ul className="mt-4 space-y-1 text-xs text-text-muted">
          {messages.map((message) => (
            <li key={message}>• {message}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function renderPromotedActionIcon(icon: ComposerPromotedAction['icon']) {
  if (icon === 'shield') {
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
        <path
          d="M10 2.5 4.5 4.8v4.6c0 3.3 2 6.2 5.1 7.5l.4.1.4-.1c3.1-1.3 5.1-4.2 5.1-7.5V4.8L10 2.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m7.8 10.1 1.5 1.5 3-3.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
      <path
        d="M10 2.8 11.6 6l3.5.5-2.6 2.5.6 3.5L10 10.9 6.9 12.5l.6-3.5-2.6-2.5 3.5-.5L10 2.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface AssetDropzoneProps {
  engine: EngineCaps;
  caps?: CapabilityCaps;
  field: EngineInputField;
  required: boolean;
  isSoloField?: boolean;
  role?: AssetFieldRole;
  assets: (ComposerAttachment | null)[];
  onSelect?: (field: EngineInputField, file: File, slotIndex: number, meta?: AssetUploadMeta) => void;
  onRemove?: (field: EngineInputField, index: number) => void;
  onError?: (message: string) => void;
  onOpenLibrary?: (field: EngineInputField, slotIndex: number) => void;
  referenceWarning?: string;
}

function AssetDropzone({
  engine,
  caps,
  field,
  required,
  isSoloField = false,
  role = 'generic',
  assets,
  onSelect,
  onRemove,
  onError,
  onOpenLibrary,
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

  return (
    <div
      className={clsx(
        'flex min-w-[260px]',
        isSoloField ? 'w-full flex-none sm:max-w-[640px]' : 'flex-1'
      )}
    >
      <div
        className={clsx(
          'flex w-full flex-col rounded-input border border-dashed border-border bg-surface-glass-80 text-text-secondary',
          fullBleedSingleAsset ? 'relative min-h-[260px] overflow-hidden' : 'gap-4 p-4'
        )}
      >
        <div className={clsx('flex items-center gap-2', fullBleedSingleAsset && 'absolute left-4 top-4 z-10')}>
          <span
            className={clsx(
              'text-sm font-medium',
              fullBleedSingleAsset ? 'text-on-inverse drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]' : 'text-text-primary'
            )}
          >
            {fieldTitle}
          </span>
          {detailsTooltip ? (
            <button
              type="button"
              className={clsx(
                'inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] transition',
                fullBleedSingleAsset
                  ? 'border border-surface-on-media-25 bg-surface-on-media-dark-35 text-on-inverse backdrop-blur hover:bg-surface-on-media-dark-50'
                  : 'border border-border/80 text-text-muted hover:border-text-muted hover:text-text-primary'
              )}
              title={detailsTooltip}
              aria-label={detailsTooltip}
            >
              <svg aria-hidden viewBox="0 0 20 20" className="h-3.5 w-3.5">
                <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 9.1V13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="10" cy="6.5" r="0.9" fill="currentColor" />
              </svg>
            </button>
          ) : null}
        </div>

        <div
          className={clsx(
            'grid gap-2',
            fullBleedSingleAsset && 'h-full',
            slotAssets.length <= 1 ? 'sm:grid-cols-1' : 'sm:grid-cols-2'
          )}
        >
          {slotAssets.map((asset, index) => {
            const slotRequired = index < minCount;
            const showRequiredHint = slotRequired && engine.id !== 'wan-2-6' && !hideRequiredSlotCopy;
            const canOpenLibrary = Boolean(onOpenLibrary && (field.type === 'image' || field.type === 'video'));
            const flattenSlotSurface = slotAssets.length === 1;
            const filledSingleSlot = flattenSlotSurface && asset != null;
            const allowClick = asset == null || asset?.kind !== 'audio';
            return (
              <div
                key={`${field.id}-slot-${index}`}
                className={clsx(
                  'relative flex w-full flex-col justify-center overflow-hidden text-center text-[12px] text-text-muted transition',
                  filledSingleSlot
                    ? fullBleedSingleAsset
                      ? 'min-h-[260px] h-full rounded-none border-0 bg-transparent'
                      : 'min-h-[228px] rounded-[20px] border border-border/60 bg-surface'
                    : flattenSlotSurface
                    ? 'min-h-[132px] rounded-[18px] border-0 bg-transparent'
                    : 'h-40 rounded-[18px] border border-border/60 bg-surface/80',
                  allowClick
                    ? filledSingleSlot
                      ? 'cursor-pointer hover:border-brand/50'
                      : flattenSlotSurface
                      ? 'cursor-pointer hover:bg-surface-2/70'
                      : 'cursor-pointer hover:border-brand/50 hover:bg-surface-2'
                    : 'cursor-default'
                )}
                onClick={() => {
                  if (!allowClick) return;
                  if (asset) {
                    if (canOpenLibrary) {
                      onOpenLibrary?.(field, index);
                      return;
                    }
                    const input = inputRefs.current[index];
                    if (input) input.click();
                    return;
                  }
                  if (canOpenLibrary) {
                    onOpenLibrary?.(field, index);
                    return;
                  }
                  const input = inputRefs.current[index];
                  if (input) input.click();
                }}
                title={asset ? undefined : canOpenLibrary ? assetCopy.selectAsset : assetCopy.upload}
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
                  <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/75 bg-surface-2/80 text-text-secondary">
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
                    {showRequiredHint && <span className="text-[10px] text-warning">{assetCopy.neededBeforeGenerating}</span>}
                    <div className="flex w-full items-center justify-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-0 h-auto rounded-full border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary hover:border-text-muted hover:bg-transparent hover:text-text-primary"
                        onClick={(event) => {
                          event.stopPropagation();
                          const input = inputRefs.current[index];
                          if (input) input.click();
                        }}
                      >
                        {assetCopy.upload}
                      </Button>
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
