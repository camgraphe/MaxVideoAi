"use client";

import clsx from 'clsx';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatResolutionLabel } from '@/lib/resolution-labels';
import { matchesDurationOptionValue } from '@/components/settings-controls/settings-control-duration';
import {
  SettingsKlingV3Controls,
  SettingsSeedanceAdvancedControls,
} from '@/components/settings-controls/settings-control-engine-advanced';
import { SettingsGenericAdvancedFields } from '@/components/settings-controls/settings-control-generic-fields';
import { FieldGroup, RangeWithInput } from '@/components/settings-controls/settings-control-parts';
import type { SettingsControlsProps } from '@/components/settings-controls/settings-control-types';
import { useSettingsControlState } from '@/components/settings-controls/useSettingsControlState';

export { DEFAULT_CONTROLS_COPY, mergeControlsCopy } from '@/components/settings-controls/settings-control-copy';

export function SettingsControls({
  engine,
  caps,
  durationSec,
  durationOption,
  onDurationChange,
  numFrames,
  onNumFramesChange,
  resolution,
  onResolutionChange,
  aspectRatio,
  onAspectRatioChange,
  mode,
  iterations,
  onIterationsChange,
  seedLocked,
  onSeedLockedChange,
  showLoopControl = false,
  loopEnabled,
  onLoopChange,
  showAudioControl = false,
  audioEnabled,
  onAudioChange,
  audioControlDisabled = false,
  audioControlNote,
  focusRefs,
  showExtendControl = true,
  cfgScale,
  onCfgScaleChange,
  durationManaged = false,
  durationManagedLabel,
  showKlingV3Controls = false,
  showKlingV3VoiceControls = true,
  klingShotType = 'customize',
  onKlingShotTypeChange,
  voiceIdsValue = '',
  onVoiceIdsChange,
  voiceControlActive = false,
  showSeedanceControls = false,
  seedValue = '',
  onSeedChange,
  cameraFixed = false,
  onCameraFixedChange,
  safetyChecker = true,
  onSafetyCheckerChange,
  showSafetyCheckerControl = false,
  advancedFields = [],
  advancedFieldValues = {},
  onAdvancedFieldChange,
  variant = 'full',
}: SettingsControlsProps) {
  const showCore = variant !== 'advanced';
  const {
    advancedHasContent,
    aspectOptions,
    audioNotice,
    canToggleAudio,
    controlsCopy,
    durationMaxSeconds,
    durationOptionsContainerRef,
    durationRange,
    durationSliderRef,
    effectiveCfgScale,
    enumeratedDurationOptions,
    frameOptions,
    frameOptionsContainerRef,
    guidance,
    hasGenericAdvancedFields,
    initInfluence,
    isAdvancedOpen,
    isLtxFastLong,
    promptStrength,
    resolutionLocked,
    resolutionOptions,
    resolvedDurationManagedLabel,
    seed,
    setGuidance,
    setInitInfluence,
    setInternalCfgScale,
    setIsAdvancedOpen,
    setPromptStrength,
    setSeed,
    showAspectControl,
    showAudioToggle,
    showResolutionControl,
  } = useSettingsControlState({
    advancedFields,
    audioControlDisabled,
    audioControlNote,
    audioEnabled,
    caps,
    cfgScale,
    durationManagedLabel,
    durationOption,
    durationSec,
    engine,
    focusRefs,
    loopEnabled,
    mode,
    numFrames,
    onAdvancedFieldChange,
    onAudioChange,
    onDurationChange,
    onLoopChange,
    onNumFramesChange,
    showAudioControl,
    showExtendControl,
    showKlingV3Controls,
    showLoopControl,
    showSafetyCheckerControl,
    showSeedanceControls,
  });

  if (variant === 'advanced') {
    if (!advancedHasContent) return null;

    return (
      <div className="space-y-3">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-0 h-auto w-full justify-between px-0 py-0 text-left font-normal"
          onClick={() => setIsAdvancedOpen((prev) => !prev)}
          aria-expanded={isAdvancedOpen}
        >
          <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
            {controlsCopy.advancedTitle}
          </span>
          <svg
            className={clsx('h-4 w-4 text-text-muted transition-transform', isAdvancedOpen ? 'rotate-180' : 'rotate-0')}
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Button>
        {isAdvancedOpen ? (
          <div className="space-y-4 rounded-input border border-border bg-surface-glass-60 p-3">
            {showLoopControl && typeof loopEnabled === 'boolean' && onLoopChange ? (
              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{controlsCopy.loop.label}</span>
                  <div className="flex flex-wrap gap-2">
                    {[true, false].map((option) => (
                      <Button
                        key={option ? 'loop-on' : 'loop-off'}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onLoopChange(option)}
                        className={clsx(
                          'min-h-0 h-auto px-2.5 py-1 text-[12px]',
                          option === loopEnabled
                            ? 'border-brand bg-brand text-on-brand'
                            : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2'
                        )}
                      >
                        {option ? controlsCopy.loop.on : controlsCopy.loop.off}
                      </Button>
                    ))}
                  </div>
                </label>
              </div>
            ) : null}

            {!showSeedanceControls ? (
              <div className="grid gap-3 md:grid-cols-3 md:items-end">
                <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
                  <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{controlsCopy.seed.label}</span>
                  <input
                    type="number"
                    placeholder={controlsCopy.seed.placeholder}
                    value={onSeedChange ? seedValue : seed}
                    onChange={(e) => {
                      setSeed(e.currentTarget.value);
                      onSeedChange?.(e.currentTarget.value);
                    }}
                    className="h-10 rounded-input border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label className="inline-flex min-h-[40px] items-center gap-2 text-[13px] text-text-secondary">
                  <input
                    type="checkbox"
                    checked={Boolean(seedLocked)}
                    onChange={(e) => onSeedLockedChange?.(e.currentTarget.checked)}
                  />
                  <span>{controlsCopy.seed.lock}</span>
                </label>
                {showSafetyCheckerControl ? (
                  <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
                    <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">Safety checker</span>
                    <div className="flex flex-wrap gap-2">
                      {[true, false].map((option) => (
                        <Button
                          key={option ? 'generic-safety-on' : 'generic-safety-off'}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onSafetyCheckerChange?.(option)}
                          className={clsx(
                            'min-h-0 h-auto px-3 py-1.5 text-[13px]',
                            option === safetyChecker
                              ? 'border-brand bg-brand text-on-brand'
                              : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2'
                          )}
                        >
                          {option ? 'On' : 'Off'}
                        </Button>
                      ))}
                    </div>
                  </label>
                ) : null}
              </div>
            ) : null}

            {engine.params.promptStrength ? (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{controlsCopy.promptStrength}</span>
                <RangeWithInput
                  value={promptStrength ?? engine.params.promptStrength.default ?? 0.5}
                  min={engine.params.promptStrength.min ?? 0}
                  max={engine.params.promptStrength.max ?? 1}
                  step={engine.params.promptStrength.step ?? 0.05}
                  onChange={(value) => setPromptStrength(value)}
                />
              </div>
            ) : null}

            {engine.params.guidance ? (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{controlsCopy.guidance}</span>
                <RangeWithInput
                  value={guidance ?? engine.params.guidance.default ?? 0.5}
                  min={engine.params.guidance.min ?? 0}
                  max={engine.params.guidance.max ?? 1}
                  step={engine.params.guidance.step ?? 0.05}
                  onChange={(value) => setGuidance(value)}
                />
              </div>
            ) : null}

            {mode === 'i2v' && engine.params.initInfluence ? (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{controlsCopy.inputInfluence}</span>
                <RangeWithInput
                  value={initInfluence ?? engine.params.initInfluence.default ?? 0.5}
                  min={engine.params.initInfluence.min ?? 0}
                  max={engine.params.initInfluence.max ?? 1}
                  step={engine.params.initInfluence.step ?? 0.05}
                  onChange={(value) => setInitInfluence(value)}
                />
              </div>
            ) : null}

            {showExtendControl && engine.extend ? (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{controlsCopy.extend.label}</span>
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-secondary">
                  <span>{controlsCopy.extend.action}</span>
                  <input type="number" min={1} max={30} defaultValue={5} className="h-10 w-20 rounded-input border border-border bg-surface px-2 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <span>{controlsCopy.extend.unit}</span>
                </div>
              </div>
            ) : null}

            {engine.keyframes ? <div className="text-[12px] text-text-muted">{controlsCopy.keyframes}</div> : null}

            {hasGenericAdvancedFields ? (
              <SettingsGenericAdvancedFields
                fields={advancedFields}
                values={advancedFieldValues}
                onChange={onAdvancedFieldChange}
              />
            ) : null}

            {showKlingV3Controls ? (
              <SettingsKlingV3Controls
                klingShotType={klingShotType}
                layout="compact"
                mode={mode}
                onKlingShotTypeChange={onKlingShotTypeChange}
                onVoiceIdsChange={onVoiceIdsChange}
                showVoiceControls={showKlingV3VoiceControls}
                voiceControlActive={voiceControlActive}
                voiceIdsValue={voiceIdsValue}
              />
            ) : null}

            {showSeedanceControls ? (
              <SettingsSeedanceAdvancedControls
                cameraFixed={cameraFixed}
                layout="compact"
                onCameraFixedChange={onCameraFixedChange}
                onSafetyCheckerChange={onSafetyCheckerChange}
                onSeedChange={onSeedChange}
                safetyChecker={safetyChecker}
                seedValue={seedValue}
              />
            ) : null}

            {engine.params.cfg_scale ? (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{controlsCopy.cfgScale}</span>
                <RangeWithInput
                  value={effectiveCfgScale}
                  min={engine.params.cfg_scale.min ?? 0}
                  max={engine.params.cfg_scale.max ?? 1}
                  step={engine.params.cfg_scale.step ?? 0.01}
                  onChange={(value) => {
                    if (onCfgScaleChange) {
                      onCfgScaleChange(value);
                    } else {
                      setInternalCfgScale(value);
                    }
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="space-y-4 p-4">
      {showCore && (
        <>
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">
                {controlsCopy.core.title}
              </h2>
              <p className="text-[12px] text-text-muted">{controlsCopy.core.subtitle}</p>
              {audioNotice && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-2 px-3 py-1 text-[11px] font-semibold text-text-secondary">
                  <span className="text-[9px] text-text-muted">●</span>
                  <span>{audioNotice}</span>
                </div>
              )}
            </div>
          </header>

          <div className="grid grid-gap-sm">
            {frameOptions && frameOptions.length ? (
              <div className="flex flex-col gap-2 text-sm text-text-secondary" ref={frameOptionsContainerRef}>
                <span className="text-[12px] uppercase tracking-micro text-text-muted">
                  {controlsCopy.frames.label}
                  <span className="ml-2 align-middle text-[11px] text-text-muted/80">
                    {(controlsCopy.frames.options ?? 'Options: {options}').replace('{options}', frameOptions.join(', '))}
                  </span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {frameOptions.map((option) => {
                    const active = numFrames === option;
                    return (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onNumFramesChange?.(option)}
                        disabled={!onNumFramesChange}
                        className={clsx(
                          'min-h-0 h-auto px-3 py-1.5 text-[13px] font-medium',
                          active
                            ? 'border-brand bg-brand text-on-brand'
                            : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2',
                          !onNumFramesChange && 'cursor-not-allowed opacity-60'
                        )}
                      >
                        {(controlsCopy.frames.unit ?? '{count} frames').replace('{count}', String(option))}
                      </Button>
                    );
                  })}
                </div>
                <span className="text-[11px] text-text-muted">{controlsCopy.frames.hint}</span>
              </div>
            ) : durationManaged ? (
              <div className="rounded-input border border-dashed border-border bg-surface-glass-60 p-3 text-[12px] text-text-muted">
                {resolvedDurationManagedLabel}
              </div>
            ) : enumeratedDurationOptions && enumeratedDurationOptions.length ? (
              <div className="flex flex-col gap-2 text-sm text-text-secondary">
                <span className="text-[12px] uppercase tracking-micro text-text-muted">
                  {controlsCopy.duration.optionsLabel}
                  <span className="ml-2 align-middle text-[11px] text-text-muted/80">
                    {(controlsCopy.duration.maxLabel ?? 'Max {seconds}s').replace('{seconds}', String(durationMaxSeconds))}
                  </span>
                </span>
                <div className="flex flex-wrap gap-2" ref={durationOptionsContainerRef}>
                  {enumeratedDurationOptions.map((option) => {
                    const active = matchesDurationOptionValue(option, durationOption, durationSec);
                    return (
                      <Button
                        key={String(option.raw)}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onDurationChange(option.raw)}
                        className={clsx(
                          'min-h-0 h-auto px-3 py-1.5 text-[13px] font-medium',
                          active
                            ? 'border-brand bg-brand text-on-brand'
                            : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2'
                        )}
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : durationRange ? (
              <label className="flex flex-col gap-2 text-sm text-text-secondary">
                <span className="text-[12px] uppercase tracking-micro text-text-muted">
                  {controlsCopy.duration.rangeLabel}
                  <span className="ml-2 align-middle text-[11px] text-text-muted/80">
                    {(controlsCopy.duration.rangeHint ?? 'Min {min}s · Max {max}s')
                      .replace('{min}', String(durationRange.min))
                      .replace('{max}', String(engine.maxDurationSec))}
                  </span>
                </span>
                <div className="flex items-center gap-4 rounded-input border border-border bg-surface px-3 py-2">
                  <input
                    type="range"
                    min={durationRange.min}
                    max={engine.maxDurationSec}
                    value={durationSec}
                    onChange={(event) => onDurationChange(Number(event.currentTarget.value))}
                    className="range-input h-1 flex-1 appearance-none overflow-hidden rounded-full bg-hairline"
                    ref={durationSliderRef}
                  />
                  <input
                    type="number"
                    min={durationRange.min}
                    max={engine.maxDurationSec}
                    value={durationSec}
                    onChange={(event) => onDurationChange(Number(event.currentTarget.value))}
                    className="w-16 rounded-input border border-border bg-surface px-2 py-1 text-right text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </label>
            ) : (
              <div className="rounded-input border border-dashed border-border bg-surface-glass-60 p-3 text-[12px] text-text-muted">
                {controlsCopy.duration.managed}
              </div>
            )}

            {showResolutionControl && (
              <FieldGroup
                label={controlsCopy.resolution.label}
                options={resolutionOptions}
                value={resolution}
                onChange={onResolutionChange}
                focusRef={focusRefs?.resolution}
                disabled={resolutionLocked}
                labelFor={(opt) => {
                  const resolutionCopy = controlsCopy.resolution;
                  const optionKey = String(opt);
                  const baseMap: Record<string, string> = {
                    '512P': '512P',
                    '768P': '768P',
                    '720p': `720p ${resolutionCopy.hd}`,
                    '1080p': `1080p ${resolutionCopy.fullHd}`,
                    '1080P': `1080P ${resolutionCopy.fullHd}`,
                    '4k': `4K ${resolutionCopy.ultraHd}`,
                    auto: resolutionCopy.auto,
                  };
                  const formattedResolution = formatResolutionLabel(engine.id, optionKey);
                  let label = baseMap[optionKey] ?? optionKey;
                  if (formattedResolution !== optionKey) {
                    label = formattedResolution;
                  }
                  if (engine.id.includes('pro') && resolutionCopy.proSuffix) {
                    label = `${label} ${resolutionCopy.proSuffix}`;
                  }
                  return label;
                }}
              />
            )}
            {isLtxFastLong ? (
              <p className="text-[11px] text-text-muted">
                LTX Fast: durations above 10s run at 1080p / 25 fps (Fal constraint).
              </p>
            ) : null}

            {showAspectControl && (
              <FieldGroup
                label={controlsCopy.aspect.label}
                options={aspectOptions}
                value={aspectRatio}
                onChange={onAspectRatioChange}
                iconFor={(opt) =>
                  ({
                    '16:9': '/assets/icons/ar-16-9.svg',
                    '9:16': '/assets/icons/ar-9-16.svg',
                    '1:1': '/assets/icons/ar-1-1.svg',
                    '4:5': '/assets/icons/ar-4-5.svg',
                  } as Record<string, string | undefined>)[String(opt)] || undefined
                }
                labelFor={(opt) => {
                  const labels: Record<string, string> = {
                    auto: controlsCopy.aspect.options.auto,
                    source: controlsCopy.aspect.options.source,
                    custom: controlsCopy.aspect.options.custom,
                  };
                  return labels[String(opt)] ?? String(opt);
                }}
              />
            )}
          </div>

          {onIterationsChange && (
            <div className="-mt-2 mb-1 flex items-center gap-2 px-1">
              <span className="text-[11px] uppercase tracking-micro text-text-muted">{controlsCopy.iterationsLabel}</span>
              {[1, 2, 3, 4].map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onIterationsChange(n)}
                  className={clsx(
                    'min-h-0 h-auto px-2.5 py-1 text-[12px]',
                    iterations === n
                      ? 'border-brand bg-brand text-on-brand'
                      : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2'
                  )}
                >
                  X{n}
                </Button>
              ))}
            </div>
          )}
          {showAudioToggle && (
            <div className="-mt-1 flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-micro text-text-muted">{controlsCopy.audio.label}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!canToggleAudio) return;
                  onAudioChange?.(!audioEnabled);
                }}
                disabled={!canToggleAudio}
                className={clsx(
                  'min-h-0 h-auto px-2.5 py-1 text-[12px] font-medium',
                  !canToggleAudio && 'cursor-not-allowed opacity-60',
                  audioEnabled
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2'
                )}
                aria-label={`${controlsCopy.audio.label}: ${audioEnabled ? controlsCopy.audio.on : controlsCopy.audio.off}`}
                aria-pressed={audioEnabled}
              >
                {audioEnabled ? controlsCopy.audio.on : controlsCopy.audio.off}
              </Button>
            </div>
          )}
          {showLoopControl && typeof loopEnabled === 'boolean' && onLoopChange && (
            <div className="-mt-1 flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-micro text-text-muted">{controlsCopy.loop.label}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onLoopChange(!loopEnabled)}
                className={clsx(
                  'min-h-0 h-auto px-2.5 py-1 text-[12px] font-medium',
                  loopEnabled
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2'
                )}
                aria-pressed={loopEnabled}
              >
                {loopEnabled ? controlsCopy.loop.on : controlsCopy.loop.off}
              </Button>
            </div>
          )}
        </>
      )}
      <div className="rounded-input border border-border bg-surface">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-0 h-auto w-full justify-between px-3 py-2 text-left font-normal"
          onClick={() => setIsAdvancedOpen((prev) => !prev)}
          aria-expanded={isAdvancedOpen}
        >
          <span className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">
            {controlsCopy.advancedTitle}
          </span>
          <svg
            className={clsx('h-4 w-4 text-text-muted transition-transform', isAdvancedOpen ? 'rotate-180' : 'rotate-0')}
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Button>
        {isAdvancedOpen && (
          <div className="stack-gap-sm border-t border-border px-3 pb-3 pt-2">
            {!showSeedanceControls && (
              <>
                <label className="flex flex-col gap-2 text-sm text-text-secondary">
                  <span className="text-[12px] uppercase tracking-micro text-text-muted">{controlsCopy.seed.label}</span>
                  <input
                    type="number"
                    placeholder={controlsCopy.seed.placeholder}
                    value={seed}
                    onChange={(e) => setSeed(e.currentTarget.value)}
                    className="rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label className="inline-flex items-center gap-2 text-[13px] text-text-secondary">
                  <input
                    type="checkbox"
                    checked={Boolean(seedLocked)}
                    onChange={(e) => onSeedLockedChange?.(e.currentTarget.checked)}
                  />
                  <span>{controlsCopy.seed.lock}</span>
                </label>
              </>
            )}

            {engine.params.promptStrength && (
              <div className="space-y-2">
                <span className="text-[12px] uppercase tracking-micro text-text-muted">{controlsCopy.promptStrength}</span>
                <RangeWithInput
                  value={promptStrength ?? engine.params.promptStrength.default ?? 0.5}
                  min={engine.params.promptStrength.min ?? 0}
                  max={engine.params.promptStrength.max ?? 1}
                  step={engine.params.promptStrength.step ?? 0.05}
                  onChange={(value) => setPromptStrength(value)}
                />
              </div>
            )}

            {engine.params.guidance && (
              <div className="space-y-2">
                <span className="text-[12px] uppercase tracking-micro text-text-muted">{controlsCopy.guidance}</span>
                <RangeWithInput
                  value={guidance ?? engine.params.guidance.default ?? 0.5}
                  min={engine.params.guidance.min ?? 0}
                  max={engine.params.guidance.max ?? 1}
                  step={engine.params.guidance.step ?? 0.05}
                  onChange={(value) => setGuidance(value)}
                />
              </div>
            )}

            {mode === 'i2v' && engine.params.initInfluence && (
              <div className="space-y-2">
                <h4 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">
                  {controlsCopy.inputInfluence}
                </h4>
                <RangeWithInput
                  value={initInfluence ?? engine.params.initInfluence.default ?? 0.5}
                  min={engine.params.initInfluence.min ?? 0}
                  max={engine.params.initInfluence.max ?? 1}
                  step={engine.params.initInfluence.step ?? 0.05}
                  onChange={(value) => setInitInfluence(value)}
                />
              </div>
            )}

            {showExtendControl && engine.extend && (
              <div className="space-y-2">
                <h4 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">
                  {controlsCopy.extend.label}
                </h4>
                <div className="flex items-center gap-2 text-[13px]">
                  <span>{controlsCopy.extend.action}</span>
                  <input type="number" min={1} max={30} defaultValue={5} className="w-20 rounded-input border border-border bg-surface px-2 py-1 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <span>{controlsCopy.extend.unit}</span>
                </div>
              </div>
            )}

            {engine.keyframes && (
              <div className="text-[12px] text-text-muted">{controlsCopy.keyframes}</div>
            )}

            {showKlingV3Controls && (
              <SettingsKlingV3Controls
                klingShotType={klingShotType}
                layout="panel"
                mode={mode}
                onKlingShotTypeChange={onKlingShotTypeChange}
                onVoiceIdsChange={onVoiceIdsChange}
                showVoiceControls={showKlingV3VoiceControls}
                voiceControlActive={voiceControlActive}
                voiceIdsValue={voiceIdsValue}
              />
            )}

            {showSeedanceControls && (
              <SettingsSeedanceAdvancedControls
                cameraFixed={cameraFixed}
                layout="panel"
                onCameraFixedChange={onCameraFixedChange}
                onSafetyCheckerChange={onSafetyCheckerChange}
                onSeedChange={onSeedChange}
                safetyChecker={safetyChecker}
                seedValue={seedValue}
              />
            )}

            {engine.params.cfg_scale && (
              <div className="space-y-2">
                <span className="text-[12px] uppercase tracking-micro text-text-muted">{controlsCopy.cfgScale}</span>
                <RangeWithInput
                  value={effectiveCfgScale}
                  min={engine.params.cfg_scale.min ?? 0}
                  max={engine.params.cfg_scale.max ?? 1}
                  step={engine.params.cfg_scale.step ?? 0.01}
                  onChange={(value) => {
                    if (onCfgScaleChange) {
                      onCfgScaleChange(value);
                    } else {
                      setInternalCfgScale(value);
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
