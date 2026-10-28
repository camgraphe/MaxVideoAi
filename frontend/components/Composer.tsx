'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { useMemo, useCallback, useRef, useEffect, useState, useId } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { WorkspaceReferenceSection } from '@/components/composer/WorkspaceReferenceSection.client';
import { ComposerCommandBar, useComposerWorkspaceControls } from '@/components/composer/ComposerWorkspaceControls.client';
import { workspaceReferenceCopy } from '@/components/composer/workspace-reference-copy';
import { ComposerReferenceFields } from '@/components/composer/ComposerReferenceFields';
import { ComposerMultiPromptEditor } from '@/components/composer/ComposerMultiPromptEditor';
import { ComposerPromotedActionIcon } from '@/components/composer/ComposerPromotedActionIcon';
import { ComposerGenerationActivity, GenerationSpinner } from '@/components/composer/ComposerGenerationActivity.client';
import { ComposerGenerationQuote } from '@/components/composer/ComposerGenerationQuote.client';
import { ComposerPromptHeader } from '@/components/composer/ComposerPromptHeader.client';
import { ComposerNotices, ComposerReferenceMentionNotice, ComposerSoraImageNotice } from '@/components/composer/ComposerNotices.client';
import { useComposerVideoSourceWorkflow } from '@/components/composer/useComposerVideoSourceWorkflow';
import { useComposerReferenceMentions } from '@/components/composer/useComposerReferenceMentions';
import { hasMissingRequiredComposerAsset } from '@/components/composer/composer-generation';
import { videoExtensionCopy } from '@/lib/video-extension';
import { videoModifyCopy } from '@/lib/video-source-workflow';
import { getWorkspaceAssetFieldRank, getWorkspaceAssetGridClass } from '@/components/composer/composer-layout';
import { DEFAULT_COMPOSER_COPY, type ComposerCopy } from '@/components/composer/composer-copy';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { isHappyHorseEngineId } from '@/lib/happy-horse-workflow';
import { UNIFIED_SEEDANCE_ENGINE_IDS } from '@/lib/seedance-workflow';
import { PromptAssistanceComposer } from '@/components/composer/PromptAssistanceComposer.client';
import { PROMPT_ASSISTANCE_PREVIEW } from '@/lib/prompt-assistance/preview-state';
import assistanceStyles from '@/components/composer/prompt-assistance.module.css';
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
  density = 'default', compactPrompt = false, assistance,
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
  referenceAuthAction, subjectReferences,
  assets,
  onAssetAdd,
  onPrepareVideoExcerpt,
  onVideoExcerptEditorChange,
  onAssetRemove,
  onNotice,
  onOpenLibrary,
  onAssetUrlSelect,
  settingsBar,
  settingsNotice,
  generateControl,
  optionsControl,
  isPricing = false,
  modeToggles,
  activeManualMode,
  onModeToggle,
  promotedActions,
  multiPrompt,
  extraFields,
  beforeAssets,
  afterAssets,
  disableGenerate,
  workflowNotice,
  generateLabel,
  generateLoadingLabel,
  pendingGenerations = [],
}: ComposerProps) {
  const { t, locale } = useI18n();
  const promptId = useId();
  const workspaceControls = useComposerWorkspaceControls();
  const workbenchCopy = workspaceReferenceCopy(locale);
  const workspaceDensity = density === 'workspace';
  const assistanceEnabled = Boolean(workspaceDensity && assistance && PROMPT_ASSISTANCE_PREVIEW && (!engine.activeVideoOperation || promptField));
  const referenceMentions = useComposerReferenceMentions({ engine, assetFields, assets, prompt, onPromptChange, textareaRef, multiPrompt });
  const { excerptNeedsRange, excerptEditorOpen, handleExcerptEditorChange, extensionWorkflow, sourceMode, videoSourceWorkflow, extensionCopy, extensionSourceState, extensionNotice, extensionQuoteStatus } = useComposerVideoSourceWorkflow({ engine, assets, activeManualMode, caps, onPrepareVideoExcerpt, onVideoExcerptEditorChange, workspaceDensity, locale });
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
    if (price == null || isPricing || excerptEditorOpen || excerptNeedsRange || (videoSourceWorkflow && extensionSourceState !== 'ready') || preflight?.ok === false) return null;
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(price);
    } catch {
      return `${currency} ${price.toFixed(2)}`;
    }
  }, [price, currency, isPricing, preflight?.ok, videoSourceWorkflow, extensionSourceState, excerptEditorOpen, excerptNeedsRange]);
  const promptLabel = promptField?.label ?? 'Prompt';
  const promptDescription = videoSourceWorkflow ? undefined : promptField?.description;
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
    referenceMentions.needsReview ||
    excerptEditorOpen || excerptNeedsRange ||
    isLoading ||
    isPricing ||
    (videoSourceWorkflow && extensionSourceState !== 'ready') ||
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
  const promptPlaceholderValue = videoSourceWorkflow ? extensionCopy.prompt : workspaceDensity && !promptPlaceholder && !promptPlaceholderWithAsset ? workbenchCopy.placeholder : hasReferenceImage
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
    ? generateLoadingLabel ?? (workspaceDensity ? workbenchCopy.sending : composerCopy.button.loading)
    : generateLabel ?? (videoSourceWorkflow ? (extensionWorkflow ? videoExtensionCopy(locale).extend : videoModifyCopy(locale, sourceMode === 'reframe').action) : composerCopy.button.idle);
  // Keep requested values saved, but do not present them as a configured result
  // until the required source is usable. Create's optional references stay independent.
  const sourceSettingsPending = Boolean(videoSourceWorkflow &&
    (extensionSourceState !== 'ready' || excerptNeedsRange || excerptEditorOpen));

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
                      {!sourceSettingsPending ? settingsBar : null}
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
                      <div className={clsx('flex w-full items-center gap-2 lg:w-auto', workspaceDensity && 'app-generation-controls')}>
                        {!workspaceDensity ? generateControl : null}
                        <ComposerGenerationActivity entries={pendingGenerations} submitting={isLoading}>
                          <Button
                            type="button"
                            size="md"
                            disabled={isGenerateDisabled}
                            aria-busy={isLoading || undefined}
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
                            <span className="app-generation-label relative z-10 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-micro">{isLoading && workspaceDensity ? <GenerationSpinner /> : null}{resolvedGenerateLabel}</span>
                            <ComposerGenerationQuote workspace={workspaceDensity} hasPrice={Boolean(formattedPrice)} isPricing={isPricing} waitingLabel={extensionQuoteStatus}>{formattedPrice ? (
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
                            ) : null}</ComposerGenerationQuote>
                            <span
                              aria-hidden
                              className={clsx(
                                'pointer-events-none absolute inset-0 rounded-[24px] bg-surface-on-media-20 opacity-0 transition-opacity duration-200 ease-out',
                                isPulseVisible && !isGenerateDisabled ? 'opacity-100' : ''
                              )}
                            />
                          </Button>
                        </ComposerGenerationActivity>
                      </div>
                    </div>
                  ) : null}
                </div>
                {settingsNotice}
              </div>
            ) : null;

  const renderReferences = (insert?: (token: string) => void) => workspaceDensity && (assetFields.length > 0 || subjectReferences) ? <>
          <WorkspaceReferenceSection compact={assistanceEnabled} engine={engine} caps={caps} assetFields={orderedAssetFields} assets={assets}
            mentions={referenceMentions.mentions} onInsertMention={!multiPromptEnabled && (!engine.activeVideoOperation || promptField) ? insert ?? referenceMentions.insert : undefined}
            extensionWorkflow={extensionWorkflow} videoSourceWorkflow={videoSourceWorkflow}
            referenceAuthAction={referenceAuthAction} subjectReferences={subjectReferences}
            onPrepareVideoExcerpt={onPrepareVideoExcerpt} onVideoExcerptEditorChange={handleExcerptEditorChange}
            onAssetAdd={onAssetAdd} onAssetRemove={onAssetRemove} onNotice={onNotice}
            onOpenLibrary={onOpenLibrary} onAssetUrlSelect={onAssetUrlSelect} referenceWarning={composerCopy.assetSlots.referenceWarning} />
          {showSoraImageWarning ? <ComposerSoraImageNotice workspace /> : null}
          {afterAssets}
        </> : null;
  const promptEditor = (
        <div hidden={Boolean(engine.activeVideoOperation && !promptField)} className="space-y-3">
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
              <ComposerPromptHeader promptId={promptId} promptLabel={promptLabel} prompt={prompt} onPromptChange={onPromptChange}
                promptMaxChars={promptMaxChars} promptTooLong={promptTooLong} multiPromptEnabled={multiPromptEnabled} locale={locale}
                multiPromptAction={multiPrompt ? <Button type="button" size="sm" variant={multiPromptEnabled ? 'primary' : 'ghost'}
                  aria-label={multiPromptEnabled ? 'Multi-prompt on' : 'Multi-prompt'} aria-pressed={multiPromptEnabled}
                  title={multiPromptEnabled ? 'Multi-prompt on' : 'Multi-prompt'} onClick={() => multiPrompt.onToggle(!multiPromptEnabled)}
                  className="!min-h-11 min-w-11 rounded-full px-2 py-0 text-[11px] font-medium">
                  <span className="sm:hidden">{locale.startsWith('fr') ? 'Scènes' : locale.startsWith('es') ? 'Escenas' : 'Scenes'}</span>
                  <span className="hidden sm:inline">Multi-prompt</span>
                </Button> : undefined} />
              {promotedActions?.length ? <div className={clsx(
                'flex items-center justify-end',
                workspaceDensity ? 'min-w-0 flex-wrap gap-1.5' : 'flex-wrap gap-2'
              )}>
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
              </div> : null}
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
                ref={referenceMentions.attachInput}
                suppressHydrationWarning
              />
            )}
            {!workspaceDensity ? composerToolbar : null}
          </div>
        </div>
  );
  return (
    <Card
      data-composer-density={density}
      className={clsx(
        assistanceEnabled && assistanceStyles.composer,
        'overflow-visible border-border/85 dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(22,32,43,0.96),rgba(16,23,31,0.98))] dark:shadow-[0_24px_56px_rgba(0,0,0,0.30)]',
        workspaceDensity ? 'p-3 sm:px-4 sm:py-2' : 'p-4 md:p-5'
      )}
    >
      <div className={workspaceDensity ? 'space-y-2' : 'space-y-4'}>
        <div hidden={workspaceDensity && (assistanceEnabled || !visibleModeToggles) && !promptDescription && !workflowNotice && !extensionNotice && !error} className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            {!assistanceEnabled && visibleModeToggles ? (
              <ComposerCommandBar modes={visibleModeToggles} workspaceDensity={workspaceDensity}
                activeManualMode={activeManualMode} onModeToggle={onModeToggle} />
            ) : null}
            <ComposerNotices promptDescription={promptDescription} workflowNotice={workflowNotice} extensionNotice={extensionNotice} error={error} />
          </div>
        </div>

        {beforeAssets}
        {!assistanceEnabled ? workspaceControls?.modelControl : null}
        {!assistanceEnabled ? renderReferences() : null}

        {referenceMentions.needsReview ? <ComposerReferenceMentionNotice
          locale={locale} changed={referenceMentions.changed} onReview={referenceMentions.review} /> : null}

        {assistanceEnabled && assistance ? <PromptAssistanceComposer referencesBeforeInput={sourceSettingsPending} context={{ ...assistance, scopeKey: JSON.stringify([assistance.scopeKey, engine.id, activeManualMode]), contextKey: JSON.stringify([assistance.contextKey, assets, negativePrompt, multiPrompt?.scenes]) }}
          modeControl={<ComposerCommandBar modes={visibleModeToggles} workspaceDensity={workspaceDensity} activeManualMode={activeManualMode} onModeToggle={onModeToggle} compact />}
          locale={locale} modelLabel={engine.label} draftText={prompt} onApplyText={onPromptChange} maxLength={promptMaxChars} blocked={referenceMentions.needsReview || isLoading}
          disabledReason={multiPromptEnabled ? 'Help with multiple scenes will be available in a later step.' : undefined} renderReferences={renderReferences}>{promptEditor}</PromptAssistanceComposer> : promptEditor}
        {workspaceDensity ? composerToolbar : null}

        {!workspaceDensity && assetFields.length > 0 ? (
          <div className="space-y-2">
            <div
              className={clsx(
                'app-reference-section text-sm',
                assetFieldLayoutClass
              )}
            >
              <ComposerReferenceFields videoSourceWorkflow={videoSourceWorkflow} orderedAssetFields={orderedAssetFields} engine={engine} caps={caps} assets={assets}
                onPrepareVideoExcerpt={onPrepareVideoExcerpt} onVideoExcerptEditorChange={handleExcerptEditorChange}
                onAssetAdd={onAssetAdd} onAssetRemove={onAssetRemove} onNotice={onNotice}
                onOpenLibrary={onOpenLibrary} onAssetUrlSelect={onAssetUrlSelect} referenceWarning={composerCopy.assetSlots.referenceWarning} />
            </div>
            {showSoraImageWarning ? <ComposerSoraImageNotice /> : null}
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
