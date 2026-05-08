import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { DEFAULT_CONTROLS_COPY, mergeControlsCopy } from '@/components/settings-controls/settings-control-copy';
import { matchesDurationOptionValue, parseDurationOptionValue } from '@/components/settings-controls/settings-control-duration';
import type { SettingsControlsProps } from '@/components/settings-controls/settings-control-types';

type UseSettingsControlStateOptions = Pick<
  SettingsControlsProps,
  | 'advancedFields'
  | 'audioControlDisabled'
  | 'audioControlNote'
  | 'audioEnabled'
  | 'caps'
  | 'cfgScale'
  | 'durationManagedLabel'
  | 'durationOption'
  | 'durationSec'
  | 'engine'
  | 'focusRefs'
  | 'loopEnabled'
  | 'mode'
  | 'numFrames'
  | 'onAdvancedFieldChange'
  | 'onAudioChange'
  | 'onDurationChange'
  | 'onLoopChange'
  | 'onNumFramesChange'
  | 'showAudioControl'
  | 'showExtendControl'
  | 'showKlingV3Controls'
  | 'showLoopControl'
  | 'showSafetyCheckerControl'
  | 'showSeedanceControls'
>;

export function useSettingsControlState({
  advancedFields = [],
  audioControlDisabled = false,
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
  showAudioControl = false,
  showExtendControl = true,
  showKlingV3Controls = false,
  showLoopControl = false,
  showSafetyCheckerControl = false,
  showSeedanceControls = false,
}: UseSettingsControlStateOptions) {
  const { t } = useI18n();
  const localizedControls = t('workspace.generate.controls', DEFAULT_CONTROLS_COPY) as
    | Partial<typeof DEFAULT_CONTROLS_COPY>
    | undefined;
  const controlsCopy = useMemo(() => mergeControlsCopy(localizedControls), [localizedControls]);
  const [seed, setSeed] = useState<string>('');
  const [guidance, setGuidance] = useState<number | null>(null);
  const [initInfluence, setInitInfluence] = useState<number | null>(null);
  const [promptStrength, setPromptStrength] = useState<number | null>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [internalCfgScale, setInternalCfgScale] = useState<number | null>(null);

  useEffect(() => {
    setInternalCfgScale(null);
  }, [engine.id, mode]);

  const enumeratedDurationOptions = useMemo(() => {
    if (!caps?.duration) return null;
    if ('options' in caps.duration) {
      return caps.duration.options.map(parseDurationOptionValue).filter((entry) => entry.value > 0);
    }
    return null;
  }, [caps]);
  const durationMaxSeconds = useMemo(() => {
    if (!enumeratedDurationOptions || enumeratedDurationOptions.length === 0) {
      return engine.maxDurationSec;
    }
    return Math.max(...enumeratedDurationOptions.map((option) => option.value));
  }, [engine.maxDurationSec, enumeratedDurationOptions]);

  const durationRange = useMemo(() => {
    if (!caps?.duration) return null;
    return 'min' in caps.duration ? caps.duration : null;
  }, [caps]);

  const frameOptions = useMemo(() => {
    if (!caps?.frames || caps.frames.length === 0) return null;
    return caps.frames;
  }, [caps]);

  useEffect(() => {
    if (!enumeratedDurationOptions || !enumeratedDurationOptions.length) return;
    if (enumeratedDurationOptions.some((option) => matchesDurationOptionValue(option, durationOption, durationSec))) return;
    const fallback = enumeratedDurationOptions[0];
    onDurationChange(fallback.raw);
  }, [enumeratedDurationOptions, durationOption, durationSec, onDurationChange]);

  useEffect(() => {
    if (!frameOptions || !frameOptions.length) return;
    if (typeof numFrames === 'number' && frameOptions.includes(numFrames)) return;
    const fallback = frameOptions[0];
    onNumFramesChange?.(fallback);
  }, [frameOptions, numFrames, onNumFramesChange]);

  const durationOptionsContainerRef = useRef<HTMLDivElement | null>(null);
  const durationSliderRef = useRef<HTMLInputElement | null>(null);
  const frameOptionsContainerRef = useRef<HTMLDivElement | null>(null);
  const isLtxFastLong = (engine.id === 'ltx-2-fast' || engine.id === 'ltx-2-3-fast') && durationSec > 10;

  useEffect(() => {
    const target = focusRefs?.duration;
    if (!target) return;
    let node: HTMLElement | null = null;
    if (frameOptions && frameOptions.length) {
      node = frameOptionsContainerRef.current;
    } else if (enumeratedDurationOptions && enumeratedDurationOptions.length) {
      node = durationOptionsContainerRef.current;
    } else if (durationRange) {
      node = durationSliderRef.current;
    }
    if (typeof target === 'function') {
      target(node as never);
    } else if (target) {
      (target as MutableRefObject<HTMLElement | null>).current = node;
    }
  }, [focusRefs?.duration, frameOptions, enumeratedDurationOptions, durationRange]);

  const resolutionOptions = useMemo(() => {
    const base = caps?.resolution && caps.resolution.length ? caps.resolution : engine.resolutions;
    if (isLtxFastLong) return base.filter((value) => value === '1080p');
    return base;
  }, [caps?.resolution, engine.resolutions, isLtxFastLong]);

  const aspectOptions = useMemo(() => {
    if (caps) {
      if (caps.aspectRatio && caps.aspectRatio.length) return caps.aspectRatio;
      return [];
    }
    return engine.aspectRatios;
  }, [caps, engine.aspectRatios]);
  const resolutionLocked = Boolean(caps?.resolutionLocked);
  const showResolutionControl = resolutionOptions.length > 0;
  const showAspectControl = aspectOptions.length > 0;
  const showAudioToggle = Boolean(showAudioControl && typeof audioEnabled === 'boolean');
  const canToggleAudio = Boolean(onAudioChange) && !audioControlDisabled;
  const audioIncluded = Boolean(engine.audio) && mode !== 'r2v' && !showAudioToggle;
  const resolvedDurationManagedLabel = durationManagedLabel ?? controlsCopy.duration.managed;
  const effectiveCfgScale =
    typeof cfgScale === 'number'
      ? cfgScale
      : internalCfgScale ?? engine.params.cfg_scale?.default ?? 0.5;
  const audioNotice = audioControlNote ?? (audioIncluded ? controlsCopy.core.audioIncluded : null);
  const hasGenericAdvancedFields = advancedFields.length > 0 && typeof onAdvancedFieldChange === 'function';

  const advancedHasContent = Boolean(
    (showLoopControl && typeof loopEnabled === 'boolean' && onLoopChange) ||
      !showSeedanceControls ||
      engine.params.promptStrength ||
      engine.params.guidance ||
      (mode === 'i2v' && engine.params.initInfluence) ||
      (showExtendControl && engine.extend) ||
      engine.keyframes ||
      showKlingV3Controls ||
      showSeedanceControls ||
      showSafetyCheckerControl ||
      engine.params.cfg_scale ||
      hasGenericAdvancedFields
  );

  return {
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
    resolvedDurationManagedLabel,
  };
}
