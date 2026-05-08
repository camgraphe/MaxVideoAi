"use client";

import clsx from 'clsx';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatResolutionLabel } from '@/lib/resolution-labels';
import { matchesDurationOptionValue } from '@/components/settings-controls/settings-control-duration';
import { SettingsAdvancedPanel } from '@/components/settings-controls/SettingsAdvancedPanel';
import { FieldGroup } from '@/components/settings-controls/settings-control-parts';
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
  const controlState = useSettingsControlState({
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
  const {
    aspectOptions,
    audioNotice,
    canToggleAudio,
    controlsCopy,
    durationMaxSeconds,
    durationOptionsContainerRef,
    durationRange,
    durationSliderRef,
    enumeratedDurationOptions,
    frameOptions,
    frameOptionsContainerRef,
    isLtxFastLong,
    resolutionLocked,
    resolutionOptions,
    resolvedDurationManagedLabel,
    showAspectControl,
    showAudioToggle,
    showResolutionControl,
  } = controlState;

  const advancedPanelProps = {
    advancedFieldValues,
    advancedFields,
    cameraFixed,
    engine,
    klingShotType,
    loopEnabled,
    mode,
    onAdvancedFieldChange,
    onCameraFixedChange,
    onCfgScaleChange,
    onKlingShotTypeChange,
    onLoopChange,
    onSafetyCheckerChange,
    onSeedChange,
    onSeedLockedChange,
    onVoiceIdsChange,
    safetyChecker,
    seedLocked,
    seedValue,
    showExtendControl,
    showKlingV3Controls,
    showKlingV3VoiceControls,
    showLoopControl,
    showSafetyCheckerControl,
    showSeedanceControls,
    state: controlState,
    voiceControlActive,
    voiceIdsValue,
  };

  if (variant === 'advanced') {
    return <SettingsAdvancedPanel {...advancedPanelProps} panelVariant="standalone" />;
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
      <SettingsAdvancedPanel {...advancedPanelProps} panelVariant="embedded" />
    </Card>
  );
}
