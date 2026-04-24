'use client';

import clsx from 'clsx';
import { useMemo } from 'react';
import type { EngineCaps, EngineModeUiCaps as CapabilityCaps, Mode } from '@/types/engines';
import { DEFAULT_CONTROLS_COPY, mergeControlsCopy } from '@/components/SettingsControls';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { formatResolutionLabel } from '@/lib/resolution-labels';

interface CoreSettingsBarProps {
  engine: EngineCaps;
  mode: Mode;
  caps?: CapabilityCaps;
  iterations?: number;
  onIterationsChange?: (value: number) => void;
  durationSec: number;
  durationOption?: number | string | null;
  onDurationChange: (value: number | string) => void;
  numFrames?: number | null;
  onNumFramesChange?: (value: number) => void;
  resolution: string;
  onResolutionChange: (value: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (value: string) => void;
  fps: number;
  onFpsChange: (value: number) => void;
  showAudioControl?: boolean;
  audioEnabled?: boolean;
  onAudioChange?: (value: boolean) => void;
  audioControlDisabled?: boolean;
  audioControlNote?: string;
  durationManaged?: boolean;
  durationManagedLabel?: string;
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

function ControlIcon({ kind }: { kind: 'duration' | 'resolution' | 'aspect' | 'audio' | 'iterations' | 'fps' }) {
  if (kind === 'duration') {
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
        <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6.5v4l2.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'resolution') {
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
        <rect x="3.5" y="4.5" width="13" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 9.8h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'aspect') {
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
        <rect x="3.5" y="5.5" width="13" height="9" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 8v4m4-4v4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'iterations') {
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
        <path
          d="M6 6.5h8a2.5 2.5 0 1 1 0 5H7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m9.2 8.8-2.7 2.7 2.7 2.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === 'audio') {
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
        <path
          d="M4.5 11.8H7l4 3.2V5L7 8.2H4.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.3 8a3.4 3.4 0 0 1 0 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M15.5 6.2a6 6 0 0 1 0 7.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === 'fps') {
    return (
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
        <path
          d="M4 10h3l1.4-3.2L11 13l1.6-3H16"
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
      <path d="M5 11.5V8.2a5 5 0 0 1 10 0v3.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.2 12.5h-.7A1.5 1.5 0 0 1 3 11V9.8a1.5 1.5 0 0 1 1.5-1.5h.7v4.2Zm10.3 0h.7A1.5 1.5 0 0 0 17 11V9.8a1.5 1.5 0 0 0-1.5-1.5h-.7v4.2Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function createInlineLabel(kind: 'duration' | 'resolution' | 'aspect' | 'iterations' | 'audio' | 'fps', label: string) {
  return (
    <span className="inline-flex items-center gap-2">
      <ControlIcon kind={kind} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function InlineSelectControl({
  kind,
  options,
  value,
  onChange,
  disabled,
  className,
}: {
  kind: 'duration' | 'resolution' | 'aspect' | 'iterations' | 'audio' | 'fps';
  options: { value: string | number | boolean; label: string; disabled?: boolean }[];
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (!options.length) return null;
  return (
    <div className={clsx('min-w-0', className)}>
      <SelectMenu
        options={options.map((option) => ({
          ...option,
          label: createInlineLabel(kind, String(option.label)),
        }))}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="min-w-0"
        buttonClassName="min-h-0 h-10 rounded-full border-border bg-surface px-3 py-0 text-[12px] font-medium shadow-none dark:border-white/10 dark:bg-white/[0.07] dark:text-white/92 dark:hover:border-white/16 dark:hover:bg-white/[0.1]"
        menuPlacement="top"
      />
    </div>
  );
}

export function CoreSettingsBar({
  engine,
  mode,
  caps,
  iterations = 1,
  onIterationsChange,
  durationSec,
  durationOption,
  onDurationChange,
  numFrames,
  onNumFramesChange,
  resolution,
  onResolutionChange,
  aspectRatio,
  onAspectRatioChange,
  fps,
  onFpsChange,
  showAudioControl = false,
  audioEnabled,
  onAudioChange,
  audioControlDisabled = false,
  audioControlNote,
  durationManaged = false,
  durationManagedLabel,
}: CoreSettingsBarProps) {
  const { t } = useI18n();
  const localizedControls = t('workspace.generate.controls', DEFAULT_CONTROLS_COPY) as
    | Partial<typeof DEFAULT_CONTROLS_COPY>
    | undefined;
  const controlsCopy = useMemo(() => mergeControlsCopy(localizedControls), [localizedControls]);
  const iterationOptions = useMemo(
    () =>
      [1, 2, 3, 4].map((value) => ({
        value,
        label: `${value}x`,
      })),
    []
  );

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

  const isLtxFastLong = (engine.id === 'ltx-2-fast' || engine.id === 'ltx-2-3-fast') && durationSec > 10;
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
  const fpsOptions = useMemo(() => {
    const base = Array.isArray(caps?.fps)
      ? caps.fps
      : typeof caps?.fps === 'number'
        ? [caps.fps]
        : engine.fps;
    if (isLtxFastLong) return base.filter((value) => value === 25);
    return base;
  }, [caps?.fps, engine.fps, isLtxFastLong]);
  const resolvedDurationManagedLabel = durationManagedLabel ?? controlsCopy.duration.managed;

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
    const formattedResolution = formatResolutionLabel(engine.id, optionKey);
    let label = baseMap[optionKey] ?? optionKey;
    if (formattedResolution !== optionKey) {
      label = formattedResolution;
    }
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
  const showFpsControl = fpsOptions.length > 1 || isLtxFastLong;
  const audioIncluded = Boolean(engine.audio) && mode !== 'r2v' && !showAudioControl;
  const audioSelectLocked = audioIncluded || !showAudioControl || audioControlDisabled;
  const audioValue = audioIncluded ? true : showAudioControl ? Boolean(audioEnabled) : false;
  const audioOptions = [
    { value: true, label: controlsCopy.audio.on },
    { value: false, label: controlsCopy.audio.off },
  ];
  const fpsOptionsList = fpsOptions.map((option) => ({
    value: option,
    label: (controlsCopy.fpsSuffix ?? '{value} fps').replace('{value}', String(option)),
  }));
  const audioNotice = audioIncluded ? null : audioControlNote ?? null;
  const durationRangeOptions = durationRange
    ? Array.from({ length: engine.maxDurationSec - durationRange.min + 1 }, (_, index) => {
        const value = durationRange.min + index;
        return { value, label: `${value}s` };
      })
    : [];

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {durationManaged ? (
          <div
            className="inline-flex min-h-[40px] items-center rounded-full border border-dashed border-border bg-surface-glass-60 px-3 text-[11px] font-semibold uppercase tracking-micro text-text-muted"
            title={resolvedDurationManagedLabel}
          >
            {resolvedDurationManagedLabel}
          </div>
        ) : frameOptions || (enumeratedDurationOptions && enumeratedDurationOptions.length) ? (
          <InlineSelectControl
            kind="duration"
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
          <InlineSelectControl
            kind="duration"
            options={durationRangeOptions}
            value={durationSec}
            onChange={(value) => onDurationChange(Number(value))}
          />
        ) : null}

        {showResolutionControl ? (
          <InlineSelectControl
            kind="resolution"
            options={resolutionOptionsList}
            value={resolution}
            onChange={(value) => onResolutionChange(String(value))}
          />
        ) : null}

        {showAspectControl ? (
          <InlineSelectControl
            kind="aspect"
            options={aspectOptionsList}
            value={aspectRatio}
            onChange={(value) => onAspectRatioChange(String(value))}
          />
        ) : null}

        {showFpsControl ? (
          <InlineSelectControl
            kind="fps"
            options={fpsOptionsList}
            value={fps}
            onChange={(value) => onFpsChange(Number(value))}
          />
        ) : null}

        <InlineSelectControl
          kind="audio"
          options={audioOptions}
          value={audioValue}
          onChange={(value) => {
            if (audioSelectLocked || typeof onAudioChange !== 'function') return;
            onAudioChange(Boolean(value));
          }}
          disabled={audioSelectLocked}
        />

        {onIterationsChange ? (
          <InlineSelectControl
            kind="iterations"
            options={iterationOptions}
            value={iterations}
            onChange={(value) => onIterationsChange(Number(value))}
          />
        ) : null}
      </div>
      {audioNotice || isLtxFastLong ? (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
          {audioNotice ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-2 px-3 py-1 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
              <span>{audioNotice}</span>
            </span>
          ) : null}
          {isLtxFastLong ? (
            <span>
              LTX Fast: durations above 10s are limited to 1080p / 25 fps.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
