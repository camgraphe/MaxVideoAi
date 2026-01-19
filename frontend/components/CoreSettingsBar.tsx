'use client';

import clsx from 'clsx';
import { useMemo } from 'react';
import type { EngineCaps, Mode } from '@/types/engines';
import type { EngineCaps as CapabilityCaps } from '@/fixtures/engineCaps';
import { DEFAULT_CONTROLS_COPY, mergeControlsCopy } from '@/components/SettingsControls';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { SelectMenu } from '@/components/ui/SelectMenu';

interface CoreSettingsBarProps {
  engine: EngineCaps;
  mode: Mode;
  caps?: CapabilityCaps;
  durationSec: number;
  durationOption?: number | string | null;
  onDurationChange: (value: number | string) => void;
  numFrames?: number | null;
  onNumFramesChange?: (value: number) => void;
  resolution: string;
  onResolutionChange: (value: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (value: string) => void;
  iterations?: number;
  onIterationsChange?: (value: number) => void;
  showAudioControl?: boolean;
  audioEnabled?: boolean;
  onAudioChange?: (value: boolean) => void;
  showLoopControl?: boolean;
  loopEnabled?: boolean;
  onLoopChange?: (value: boolean) => void;
}

type DurationOptionMeta = {
  raw: number | string;
  value: number;
  label: string;
};

function parseDurationOptionValue(option: number | string): DurationOptionMeta {
  if (typeof option === 'number') {
    return {
      raw: option,
      value: option,
      label: `${option}s`,
    };
  }
  const numeric = Number(option.replace(/[^\d.]/g, ''));
  return {
    raw: option,
    value: Number.isFinite(numeric) ? numeric : 0,
    label: option,
  };
}

function matchesDurationOptionValue(option: DurationOptionMeta, raw: number | string | null | undefined, seconds: number): boolean {
  if (raw != null) {
    if (typeof raw === 'number') {
      return Math.abs(option.value - raw) < 0.001;
    }
    if (typeof raw === 'string') {
      if (raw === option.raw || raw === option.label) return true;
      const numeric = Number(raw.replace(/[^\d.]/g, ''));
      if (Number.isFinite(numeric)) {
        return Math.abs(option.value - numeric) < 0.001;
      }
    }
  }
  return Math.abs(option.value - seconds) < 0.001;
}

function SelectGroup({
  label,
  options,
  value,
  onChange,
  disabled,
  className,
}: {
  label: string;
  options: { value: string | number | boolean; label: string; disabled?: boolean }[];
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (!options.length) return null;
  return (
    <label className={clsx('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-[10px] uppercase tracking-micro text-text-muted">{label}</span>
      <SelectMenu options={options} value={value} onChange={onChange} disabled={disabled} />
    </label>
  );
}

export function CoreSettingsBar({
  engine,
  mode,
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
  iterations,
  onIterationsChange,
  showAudioControl = false,
  audioEnabled,
  onAudioChange,
  showLoopControl = false,
  loopEnabled,
  onLoopChange,
}: CoreSettingsBarProps) {
  const { t } = useI18n();
  const localizedControls = t('workspace.generate.controls', DEFAULT_CONTROLS_COPY) as
    | Partial<typeof DEFAULT_CONTROLS_COPY>
    | undefined;
  const controlsCopy = useMemo(() => mergeControlsCopy(localizedControls), [localizedControls]);

  const frameOptions = useMemo(() => (caps?.frames && caps.frames.length ? caps.frames : null), [caps?.frames]);
  const enumeratedDurationOptions = useMemo(() => {
    if (!caps?.duration) return null;
    if ('options' in caps.duration) {
      return caps.duration.options.map(parseDurationOptionValue).filter((entry) => entry.value > 0);
    }
    return null;
  }, [caps]);
  const durationRange = useMemo(() => {
    if (!caps?.duration) return null;
    return 'min' in caps.duration ? caps.duration : null;
  }, [caps]);

  const isLtx2FastLong = engine.id === 'ltx-2-fast' && durationSec > 10;
  const resolutionOptions = useMemo(() => {
    const base = caps?.resolution && caps.resolution.length ? caps.resolution : engine.resolutions;
    if (isLtx2FastLong) return base.filter((value) => value === '1080p');
    return base;
  }, [caps?.resolution, engine.resolutions, isLtx2FastLong]);

  const aspectOptions = useMemo(() => {
    if (caps) {
      if (caps.aspectRatio && caps.aspectRatio.length) return caps.aspectRatio;
      return [];
    }
    return engine.aspectRatios;
  }, [caps, engine.aspectRatios]);

  const durationLabel = controlsCopy.duration.optionsLabel ?? 'Duration';
  const framesLabel = controlsCopy.frames.label ?? 'Frames';
  const resolutionLabel = controlsCopy.resolution.label ?? 'Resolution';
  const aspectLabel = controlsCopy.aspect.label ?? 'Aspect';
  const iterationsLabel = controlsCopy.iterationsLabel ?? 'Iterations';
  const audioLabel = controlsCopy.audio.label ?? 'Audio';
  const loopLabel = controlsCopy.loop.label ?? 'Loop';

  const durationOptions =
    frameOptions && frameOptions.length
      ? frameOptions.map((option) => ({
          value: option,
          label: (controlsCopy.frames.unit ?? '{count} frames').replace('{count}', String(option)),
        }))
      : enumeratedDurationOptions?.map((option) => ({
          value: option.raw,
          label: option.label,
        })) ?? [];

  const durationValue = frameOptions && frameOptions.length
    ? numFrames ?? frameOptions[0]
    : enumeratedDurationOptions && enumeratedDurationOptions.length
      ? enumeratedDurationOptions.find((option) => matchesDurationOptionValue(option, durationOption, durationSec))?.raw ?? enumeratedDurationOptions[0].raw
      : durationSec;

  const resolutionOptionsList = resolutionOptions.map((option) => {
    const resolutionCopy = controlsCopy.resolution;
    const optionKey = String(option);
    const baseMap: Record<string, string> = {
      '512P': '512P',
      '768P': '768P',
      '720p': `720p ${resolutionCopy.hd}`,
      '1080p': `1080p ${resolutionCopy.fullHd}`,
      '1080P': `1080P ${resolutionCopy.fullHd}`,
      '4k': `4K ${resolutionCopy.ultraHd}`,
      auto: resolutionCopy.auto,
    };
    let label = baseMap[optionKey] ?? optionKey;
    if (engine.id.includes('pro') && resolutionCopy.proSuffix) {
      label = `${label} ${resolutionCopy.proSuffix}`;
    }
    return { value: option, label };
  });

  const aspectOptionsList = aspectOptions.map((option) => {
    const labels: Record<string, string> = {
      auto: controlsCopy.aspect.options.auto,
      source: controlsCopy.aspect.options.source,
      custom: controlsCopy.aspect.options.custom,
    };
    return { value: option, label: labels[String(option)] ?? String(option) };
  });

  const showResolutionControl = resolutionOptions.length > 0 && !caps?.resolutionLocked;
  const showAspectControl = aspectOptions.length > 0;
  const audioIncluded = Boolean(engine.audio) && mode !== 'r2v' && !showAudioControl;
  const durationRangeOptions = durationRange
    ? Array.from({ length: engine.maxDurationSec - durationRange.min + 1 }, (_, index) => {
        const value = durationRange.min + index;
        return { value, label: `${value}s` };
      })
    : [];

  return (
    <div className="min-w-0 flex-1">
      <div className="grid grid-cols-2 grid-gap-sm sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {frameOptions || (enumeratedDurationOptions && enumeratedDurationOptions.length) ? (
          <SelectGroup
            label={frameOptions ? framesLabel : durationLabel}
            options={durationOptions}
            value={durationValue}
            onChange={(value) => {
              if (frameOptions && frameOptions.length) {
                onNumFramesChange?.(Number(value));
                return;
              }
              onDurationChange(value as number | string);
            }}
          />
        ) : durationRange ? (
          <SelectGroup
            label={controlsCopy.duration.rangeLabel ?? 'Duration'}
            options={durationRangeOptions}
            value={durationSec}
            onChange={(value) => onDurationChange(Number(value))}
          />
        ) : null}

        {showResolutionControl && (
          <SelectGroup
            label={resolutionLabel}
            options={resolutionOptionsList}
            value={resolution}
            onChange={(value) => onResolutionChange(String(value))}
          />
        )}

        {showAspectControl && (
          <SelectGroup
            label={aspectLabel}
            options={aspectOptionsList}
            value={aspectRatio}
            onChange={(value) => onAspectRatioChange(String(value))}
          />
        )}

        {onIterationsChange && (
          <SelectGroup
            label={iterationsLabel}
            options={[1, 2, 3, 4].map((value) => ({ value, label: `x${value}` }))}
            value={Math.max(1, iterations ?? 1)}
            onChange={(value) => onIterationsChange(Number(value))}
          />
        )}

        {showAudioControl && typeof audioEnabled === 'boolean' && onAudioChange && (
          <SelectGroup
            label={audioLabel}
            options={[
              { value: true, label: controlsCopy.audio.on },
              { value: false, label: controlsCopy.audio.off },
            ]}
            value={audioEnabled}
            onChange={(value) => onAudioChange(Boolean(value))}
          />
        )}

        {showLoopControl && typeof loopEnabled === 'boolean' && onLoopChange && (
          <SelectGroup
            label={loopLabel}
            options={[
              { value: true, label: controlsCopy.loop.on },
              { value: false, label: controlsCopy.loop.off },
            ]}
            value={loopEnabled}
            onChange={(value) => onLoopChange(Boolean(value))}
          />
        )}
        {audioIncluded && controlsCopy.core.audioIncluded && (
          <div className="col-span-2 sm:col-span-3 lg:col-span-4 xl:col-span-5">
            <span className="inline-flex items-center rounded-full border border-hairline bg-surface-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-micro text-text-secondary">
              {controlsCopy.core.audioIncluded}
            </span>
          </div>
        )}
      </div>
      {isLtx2FastLong && (
        <p className="mt-2 text-[10px] text-text-muted">
          LTX-2 Fast: durations above 10s run at 1080p / 25 fps (Fal constraint).
        </p>
      )}
    </div>
  );
}
