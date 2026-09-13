'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { useMemo, useCallback, useRef, useEffect, useState, useId } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { WorkspaceReferenceSection } from '@/components/composer/WorkspaceReferenceSection.client';
import { workspaceReferenceCopy } from '@/components/composer/workspace-reference-copy';
import { ComposerReferenceFields } from '@/components/composer/ComposerReferenceFields';
import { ComposerMultiPromptEditor } from '@/components/composer/ComposerMultiPromptEditor';
import { ComposerPromotedActionIcon } from '@/components/composer/ComposerPromotedActionIcon';
import { hasMissingRequiredComposerAsset } from '@/components/composer/composer-generation';
import { getWorkspaceAssetFieldRank, getWorkspaceAssetGridClass } from '@/components/composer/composer-layout';
import { DEFAULT_COMPOSER_COPY, type ComposerCopy } from '@/components/composer/composer-copy';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { isHappyHorseEngineId } from '@/lib/happy-horse-workflow';
import { UNIFIED_SEEDANCE_ENGINE_IDS } from '@/lib/seedance-workflow';
import type { ComposerProps } from '@/components/composer/composer-types';

export type {
  AssetFieldConfig,
  AssetFieldRole,
  AssetUploadMeta,
  ComposerAttachment,
  ComposerPromotedAction,
  MultiPromptScene,
} from '@/components/composer/composer-types';

export function Composer({
  density = 'default', compactPrompt = false,
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
  generateControl,
  optionsControl,
  isPricing = false,
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
}: ComposerProps) {
  const { t, locale } = useI18n();
  const promptId = useId();
  const workbenchCopy = workspaceReferenceCopy(locale);
  const workspaceDensity = density === 'workspace';
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
    if (price == null || isPricing || preflight?.ok === false) return null;
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(price);
    } catch {
      return `${currency} ${price.toFixed(2)}`;
    }
  }, [price, currency, isPricing, preflight?.ok]);
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
  const missingRequiredAsset = hasMissingRequiredComposerAsset(assetFields, assets);
  const isGenerateDisabled =
    Boolean(disableGenerate) ||
    isLoading ||
    promptTooLong ||
    (promptRequired && !promptValueReady) ||
    (negativePromptField && negativePromptRequired && !negativePromptValue) ||
    missingRequiredAsset;
  const showSoraImageWarning = engine.id.startsWith('sora-2') && assetFields.some((entry) => entry.field.type === 'image');
  const hasReferenceImage = useMemo(() => {
    return assetFields.some((entry) => {
      if (entry.field.type !== 'image') return false;
      const entries = assets[entry.field.id] ?? [];
      return entries.some((asset) => asset?.kind === 'image');
    });
  }, [assetFields, assets]);
  const orderedAssetFields = useMemo(() => {
    const useCustomAssetOrder =
      engine.id.startsWith('ltx-2-3') ||
      engine.id.startsWith('lumaRay2') ||
      UNIFIED_SEEDANCE_ENGINE_IDS.has(engine.id) ||
      isHappyHorseEngineId(engine.id);
    if (!useCustomAssetOrder) {
      return assetFields;
    }

    return [...assetFields].sort((left, right) => {
      const leftRank = getWorkspaceAssetFieldRank(engine.id, left.field.id);
      const rightRank = getWorkspaceAssetFieldRank(engine.id, right.field.id);
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return left.field.id.localeCompare(right.field.id);
    });
  }, [assetFields, engine.id]);
  const useLtxAssetGridLayout =
    engine.id.startsWith('ltx-2-3') ||
    UNIFIED_SEEDANCE_ENGINE_IDS.has(engine.id) ||
    isHappyHorseEngineId(engine.id);
  const assetFieldLayoutClass = workspaceDensity
    ? getWorkspaceAssetGridClass(orderedAssetFields.length)
    : useLtxAssetGridLayout ? 'grid gap-4 md:grid-cols-2' : 'flex flex-wrap gap-4';
  const promptPlaceholderValue = workspaceDensity && !promptPlaceholder && !promptPlaceholderWithAsset ? workbenchCopy.placeholder : hasReferenceImage
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

  const composerToolbar = (settingsBar || onGenerate) ? (
              <div className={clsx('app-composer-toolbar border-t border-border/65 dark:border-white/[0.06]', workspaceDensity ? 'px-3 py-1' : 'px-4 py-3')}>
                <div className={workspaceDensity
                  ? 'app-composer-toolbar-layout flex gap-3'
                  : 'flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'}>
                  {(settingsBar || (workspaceDensity && (optionsControl || generateControl))) ? (
                    <div className={clsx(
                      'app-composer-settings-group min-w-0 flex-1',
                      workspaceDensity && 'app-composer-settings-inline'
                    )}>
                      {settingsBar}
                      {workspaceDensity ? optionsControl : null}
                      {workspaceDensity ? generateControl : null}
                    </div>
                  ) : null}
                  {!workspaceDensity ? optionsControl : null}
                  {onGenerate ? (
                    <div className={clsx(
                      'flex shrink-0 flex-col gap-2',
                      workspaceDensity ? 'app-composer-submit' : 'lg:items-end'
                    )}>
                      {workspaceDensity && !formattedPrice ? <span className="app-quote-status" role="status">{isPricing ? workbenchCopy.calculating : workbenchCopy.priceUnavailable}</span> : null}
                      <div className={clsx('flex w-full items-center gap-2 lg:w-auto', workspaceDensity && 'app-generation-controls')}>
                        {!workspaceDensity ? generateControl : null}
                        <Button
                          type="button"
                          size="md"
                          disabled={isGenerateDisabled}
                          className={clsx(
                            'app-generation-action relative w-full justify-between overflow-hidden rounded-[24px] text-left',
                            'transform-gpu transition-transform duration-200 ease-out motion-reduce:transform-none motion-reduce:animate-none motion-reduce:transition-none',
                            'border border-brand shadow-card',
                            'disabled:border-border disabled:bg-surface disabled:text-text-muted disabled:shadow-none',
                            workspaceDensity
                              ? '!min-h-11 gap-3 px-4 py-0 lg:w-auto lg:min-w-[176px]'
                              : 'min-w-[220px] gap-4 px-5 py-3',
                            isButtonAnimating && !isGenerateDisabled ? 'animate-button-pop' : '',
                            isGenerateDisabled ? '' : 'active:scale-[0.97]',
                            formattedPrice && !workspaceDensity ? 'sm:min-w-[260px]' : ''
                          )}
                          onClick={handleGenerateClick}
                        >
                          <span className="app-generation-label relative z-10 text-sm font-semibold uppercase tracking-micro">{resolvedGenerateLabel}</span>
                          {formattedPrice ? (
                            <span
                              className={clsx(
                                'app-generation-price relative z-10 inline-flex items-center rounded-full py-1 text-sm font-semibold normal-case backdrop-blur',
                                workspaceDensity ? 'px-3' : 'px-3.5',
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
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null;

  return (
    <Card
      data-composer-density={density}
      className={clsx(
        'overflow-visible border-border/85 dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(22,32,43,0.96),rgba(16,23,31,0.98))] dark:shadow-[0_24px_56px_rgba(0,0,0,0.30)]',
        workspaceDensity ? 'p-3 sm:px-4 sm:py-2' : 'p-4 md:p-5'
      )}
    >
      <div className={workspaceDensity ? 'space-y-2' : 'space-y-4'}>
        <div hidden={workspaceDensity && !visibleModeToggles && !promptDescription && !workflowNotice && !error} className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            {visibleModeToggles ? (
              <div className="app-mode-switch flex flex-wrap gap-2">
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
                      aria-pressed={active}
                      className="!min-h-11 rounded-2xl px-4 py-0 text-[12px] font-semibold dark:border-white/12 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
                    >
                      {entry.label}
                    </Button>
                  );
                })}
              </div>
            ) : null}
            {(promptDescription || workflowNotice || error) && (
              <div className="space-y-1">
                {promptDescription ? <p className="text-[12px] text-text-muted">{promptDescription}</p> : null}
                {workflowNotice ? (
                  <div className="rounded-input border border-border bg-surface-glass-80 px-3 py-2 text-[12px] text-text-secondary dark:border-white/8 dark:bg-white/[0.04] dark:text-white/70">
                    {workflowNotice}
                  </div>
                ) : null}
                {error ? (
                  <div
                    role="alert"
                    className="rounded-input border border-error-border bg-error-bg px-3 py-2 text-[13px] whitespace-pre-line text-error"
                  >
                    {error}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {workspaceDensity && assetFields.length > 0 ? <>
          <WorkspaceReferenceSection engine={engine} caps={caps} assetFields={orderedAssetFields} assets={assets}
            onAssetAdd={onAssetAdd} onAssetRemove={onAssetRemove} onNotice={onNotice}
            onOpenLibrary={onOpenLibrary} onAssetUrlSelect={onAssetUrlSelect} referenceWarning={composerCopy.assetSlots.referenceWarning} />
          {showSoraImageWarning ? <p className="text-xs text-text-muted" role="note">Real people — including public figures — cannot be generated. Input images with faces of humans are currently rejected. OpenAI</p> : null}
          {afterAssets}
        </> : null}

        <div className="space-y-3">
            <div
              className={clsx(
                'app-prompt-surface overflow-visible rounded-[28px] border bg-surface dark:bg-[linear-gradient(180deg,rgba(22,32,43,0.94),rgba(19,28,38,0.98))]',
                'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]',
                promptTooLong ? 'border-error-border' : 'border-border'
              )}
            >
            <div className={clsx(
              'app-prompt-heading flex items-start justify-between px-4',
              workspaceDensity ? 'flex-wrap gap-2 pb-2 pt-3' : 'flex-wrap gap-3 pb-2 pt-4'
            )}>
              <div className={clsx('flex items-center gap-2 pt-1', workspaceDensity && 'shrink-0')}>
                {multiPromptEnabled ? <h2 id={`${promptId}-heading`} className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{promptLabel}</h2> : <label htmlFor={promptId} className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{promptLabel}</label>}
                {typeof promptMaxChars === 'number' ? (
                  <div className={clsx('text-[12px]', promptTooLong ? 'text-error' : 'text-text-muted')}>
                    {promptCharCount}/{promptMaxChars}
                  </div>
                ) : null}
              </div>
              <div className={clsx(
                'flex items-center justify-end',
                workspaceDensity ? 'min-w-0 flex-wrap gap-1.5' : 'flex-wrap gap-2'
              )}>
                {multiPrompt ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={multiPromptEnabled ? 'primary' : 'outline'}
                    onClick={() => multiPrompt.onToggle(!multiPromptEnabled)}
                    className="!min-h-11 sm:!min-h-0 sm:h-8 rounded-full px-3 py-0 text-[10px] font-semibold uppercase tracking-micro dark:border-white/12 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
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
                    className="!min-h-11 sm:!min-h-0 sm:h-8 rounded-full px-2.5 py-0 text-[10px] font-semibold dark:border-white/12 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
                  >
                    <span className="shrink-0">
                      <ComposerPromotedActionIcon icon={action.icon} />
                    </span>
                    <span className="whitespace-nowrap">{action.label}</span>
                  </Button>
                ))}
              </div>
            </div>
            {multiPromptEnabled && multiPrompt ? (
              <ComposerMultiPromptEditor multiPrompt={multiPrompt} labelledBy={`${promptId}-heading`} />
            ) : (
              <textarea
                id={promptId}
                value={prompt}
                onChange={(event) => onPromptChange(event.currentTarget.value)}
                placeholder={promptPlaceholderValue}
                rows={workspaceDensity ? 3 : compactPrompt ? 2 : 6}
                aria-label={promptLabel}
                data-workspace-prompt
                aria-invalid={promptTooLong || undefined}
                className={clsx(
                  workspaceDensity
                    ? 'min-h-[96px] w-full resize-y border-0 bg-transparent px-4 pb-3 pt-0 text-sm leading-5 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-0 dark:text-white dark:placeholder:text-white/32'
                    : 'min-h-[180px] w-full border-0 bg-transparent px-5 pb-4 pt-0 text-sm leading-6 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-0 dark:text-white dark:placeholder:text-white/32',
                  promptTooLong ? 'focus-visible:ring-error' : ''
                )}
                ref={textareaRef}
                suppressHydrationWarning
              />
            )}
            {!workspaceDensity ? composerToolbar : null}
          </div>
        </div>
        {workspaceDensity ? composerToolbar : null}

        {!workspaceDensity && assetFields.length > 0 ? (
          <div className="space-y-2">
            <div
              className={clsx(
                'app-reference-section text-sm',
                assetFieldLayoutClass
              )}
            >
              <ComposerReferenceFields orderedAssetFields={orderedAssetFields} engine={engine} caps={caps} assets={assets}
                onAssetAdd={onAssetAdd} onAssetRemove={onAssetRemove} onNotice={onNotice}
                onOpenLibrary={onOpenLibrary} onAssetUrlSelect={onAssetUrlSelect} referenceWarning={composerCopy.assetSlots.referenceWarning} />
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
              className={clsx('w-full rounded-input border border-border bg-surface px-4 text-sm leading-5 text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/8 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/35', workspaceDensity ? 'h-9' : 'h-11')}
            />
          </div>
        ) : null}

        {extraFields ? <div className={workspaceDensity ? 'space-y-2 border-t border-border/65 pt-2 dark:border-white/[0.06]' : 'space-y-4 border-t border-border/65 pt-4 dark:border-white/[0.06]'}>{extraFields}</div> : null}
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
