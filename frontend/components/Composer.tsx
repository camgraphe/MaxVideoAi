'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import type { Ref, ReactNode } from 'react';
import type { EngineCaps, EngineInputField, Mode, PreflightResponse } from '@/types/engines';
import type { EngineCaps as CapabilityCaps } from '@/fixtures/engineCaps';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CURRENCY_LOCALE } from '@/lib/intl';
import {
  AssetDropzone,
  type AssetFieldConfig,
  type AssetFieldRole,
  type AssetSlotAttachment,
  type AssetUploadMeta,
} from '@/components/AssetDropzone';
import { useI18n } from '@/lib/i18n/I18nProvider';
export type ComposerAttachment = AssetSlotAttachment;
export type { AssetFieldConfig, AssetFieldRole, AssetUploadMeta };

export type MultiPromptScene = {
  id: string;
  prompt: string;
  duration: number;
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
  promptPlaceholder?: string;
  promptPlaceholderWithAsset?: string;
  negativePromptField?: EngineInputField;
  negativePromptRequired?: boolean;
  assetFields: AssetFieldConfig[];
  assets: Record<string, (ComposerAttachment | null)[]>;
  onAssetAdd?: (field: EngineInputField, file: File, slotIndex?: number, meta?: AssetUploadMeta) => void;
  onAssetRemove?: (field: EngineInputField, index: number) => void;
  onNotice?: (message: string) => void;
  onOpenLibrary?: (field: EngineInputField, slotIndex: number) => void;
  onAssetUrlSelect?: (field: EngineInputField, url: string, slotIndex: number) => void;
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
  afterAssets?: ReactNode;
  disableGenerate?: boolean;
  workflowNotice?: string | null;
  generateLabel?: string;
  generateLoadingLabel?: string;
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
  promptPlaceholder,
  promptPlaceholderWithAsset,
  negativePromptField,
  negativePromptRequired = false,
  assetFields,
  assets,
  onAssetAdd,
  onAssetRemove,
  onNotice,
  onOpenLibrary,
  onAssetUrlSelect,
  settingsBar,
  modeToggles,
  activeManualMode,
  onModeToggle,
  promotedActions,
  multiPrompt,
  extraFields,
  afterAssets,
  disableGenerate,
  workflowNotice,
  generateLabel,
  generateLoadingLabel,
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
    const useCustomAssetOrder = engine.id.startsWith('ltx-2-3') || engine.id.startsWith('lumaRay2');
    if (!useCustomAssetOrder) {
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
  const assetFieldLayoutClass = useMemo(() => {
    if (!useLtxAssetGridLayout) {
      return 'flex flex-wrap gap-4';
    }
    if (orderedAssetFields.length >= 4) {
      return 'grid gap-4 md:grid-cols-2 xl:grid-cols-4';
    }
    return 'grid gap-4 md:grid-cols-2 xl:grid-cols-3';
  }, [orderedAssetFields.length, useLtxAssetGridLayout]);
  const promptPlaceholderValue = hasReferenceImage
    ? promptPlaceholderWithAsset ?? composerCopy.prompt.placeholderWithImage ?? promptPlaceholder ?? composerCopy.prompt.placeholder
    : promptPlaceholder ?? composerCopy.prompt.placeholder;
  const visibleModeToggles = modeToggles && modeToggles.length > 1 ? modeToggles : null;

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

  const resolvedGenerateLabel = isLoading
    ? generateLoadingLabel ?? composerCopy.button.loading
    : generateLabel ?? composerCopy.button.idle;

  return (
    <Card className="overflow-visible border-border/85 p-4 md:p-5 dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(22,32,43,0.96),rgba(16,23,31,0.98))] dark:shadow-[0_24px_56px_rgba(0,0,0,0.30)]">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            {visibleModeToggles ? (
              <div className="flex flex-wrap gap-2">
                {visibleModeToggles.map((entry) => {
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
                      className="min-h-0 h-10 rounded-2xl px-4 py-0 text-[12px] font-semibold dark:border-white/12 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
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
                  <div className="rounded-input border border-border bg-surface-glass-80 px-3 py-2 text-[12px] text-text-secondary dark:border-white/8 dark:bg-white/[0.04] dark:text-white/70">
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
                'overflow-visible rounded-[28px] border bg-surface dark:bg-[linear-gradient(180deg,rgba(22,32,43,0.94),rgba(19,28,38,0.98))]',
                'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]',
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
                    className="min-h-0 h-8 rounded-full px-3 py-0 text-[10px] font-semibold uppercase tracking-micro dark:border-white/12 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
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
                    className="min-h-0 h-8 rounded-full px-2.5 py-0 text-[10px] font-semibold dark:border-white/12 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
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
                    className="rounded-input border border-border bg-surface p-3 text-sm text-text-secondary dark:border-white/8 dark:bg-white/[0.04] dark:text-white/72"
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
                      className="mt-2 w-full rounded-input border border-border bg-surface px-3 py-2 text-sm leading-5 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/8 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-white/35"
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
                        className="w-20 rounded-input border border-border bg-surface px-2 py-1 text-right text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/8 dark:bg-white/[0.03] dark:text-white"
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
                placeholder={promptPlaceholderValue}
                rows={6}
                aria-invalid={promptTooLong || undefined}
                className={clsx(
                  'min-h-[180px] w-full border-0 bg-transparent px-5 pb-4 pt-0 text-sm leading-6 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-0 dark:text-white dark:placeholder:text-white/32',
                  promptTooLong ? 'focus-visible:ring-error' : ''
                )}
                ref={textareaRef}
              />
            )}

            {(settingsBar || onGenerate) ? (
              <div className="border-t border-border/65 px-4 py-3 dark:border-white/[0.06]">
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
                          <span
                            className={clsx(
                              'relative z-10 inline-flex items-center rounded-full px-3.5 py-1 text-sm font-semibold normal-case backdrop-blur',
                              isGenerateDisabled
                                ? 'border border-border/80 bg-surface-2 text-text-secondary shadow-none'
                                : 'border border-white/25 bg-surface text-text-primary shadow-[0_8px_18px_rgba(15,23,42,0.12)]'
                            )}
                          >
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
                assetFieldLayoutClass
              )}
            >
              {orderedAssetFields.map(({ field, required, role, headerAction }) => (
                <AssetDropzone
                  key={field.id}
                  engine={engine}
                  caps={caps}
                  field={field}
                  required={required}
                  isSoloField={orderedAssetFields.length === 1}
                  role={role}
                  assets={assets[field.id] ?? []}
                  headerAction={headerAction}
                  onSelect={onAssetAdd}
                  onRemove={onAssetRemove}
                  onError={onNotice}
                  onOpenLibrary={onOpenLibrary}
                  onUrlSelect={onAssetUrlSelect}
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
            {afterAssets}
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
              className="h-11 w-full rounded-input border border-border bg-surface px-4 text-sm leading-5 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/8 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/35"
            />
          </div>
        ) : null}

        {error ? (
          <div className="rounded-input border border-error-border bg-error-bg px-3 py-2 text-[13px] text-error whitespace-pre-line">
            {error}
          </div>
        ) : null}

        {extraFields ? <div className="space-y-4 border-t border-border/65 pt-4 dark:border-white/[0.06]">{extraFields}</div> : null}
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
