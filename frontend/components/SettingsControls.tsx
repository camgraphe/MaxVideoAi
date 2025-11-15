"use client";

import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, Ref } from 'react';
import type { EngineCaps, Mode } from '@/types/engines';
import type { EngineCaps as CapabilityCaps } from '@/fixtures/engineCaps';
import { Card } from '@/components/ui/Card';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface Props {
  engine: EngineCaps;
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
  fps: number;
  onFpsChange: (value: number) => void;
  mode: Mode;
  iterations?: number;
  onIterationsChange?: (value: number) => void;
  seedLocked?: boolean;
  onSeedLockedChange?: (value: boolean) => void;
  apiKey?: string;
  onApiKeyChange?: (value: string) => void;
  showApiKeyField?: boolean;
  showLoopControl?: boolean;
  loopEnabled?: boolean;
  onLoopChange?: (value: boolean) => void;
  focusRefs?: {
    duration?: Ref<HTMLElement>;
    resolution?: Ref<HTMLDivElement>;
  };
  showExtendControl?: boolean;
}

const DEFAULT_CONTROLS_COPY = {
  core: {
    title: 'Core settings',
    subtitle: 'Duration, Aspect, Resolution',
    audioIncluded: 'Audio included in every render',
  },
  billingTip: {
    label: 'Billing tip:',
    body: 'Add your OpenAI API key in Advanced settings to bill runs directly through OpenAI. Leave it blank to route charges via FAL credits.',
  },
  frames: {
    label: 'Frames',
    options: 'Options: {options}',
    unit: '{count} frames',
    hint: 'Frames control clip length; values are forwarded without converting to seconds.',
  },
  duration: {
    optionsLabel: 'Duration',
    maxLabel: 'Max {seconds}s',
    rangeLabel: 'Duration — seconds',
    rangeHint: 'Min {min}s · Max {max}s',
    managed: 'Duration is managed directly by this engine.',
  },
  resolution: {
    label: 'Resolution',
    auto: 'Auto',
    hd: '• HD',
    fullHd: '• Full HD',
    ultraHd: '• Ultra HD',
    proSuffix: '• Pro',
  },
  aspect: {
    label: 'Aspect',
    options: {
      auto: 'Auto',
      source: 'Source',
      custom: 'Custom',
    },
  },
  iterationsLabel: 'Iterations',
  loop: {
    label: 'Loop',
    on: 'On',
    off: 'Off',
  },
  advancedTitle: 'Advanced settings',
  seed: {
    label: 'Seed',
    placeholder: 'Random',
    lock: 'Lock seed',
  },
  fpsSuffix: '{value} fps',
  promptStrength: 'Prompt strength',
  guidance: 'Guidance',
  apiKey: {
    label: 'OpenAI API key',
    placeholder: 'sk-...',
    note: 'Provide your OpenAI key to bill directly through your account. We do not store the key server-side.',
  },
  inputInfluence: 'Input influence',
  extend: {
    label: 'Extend',
    action: 'Extend by',
    unit: 'seconds',
  },
  keyframes: 'Keyframes supported (Pika 2.2)',
} as const;

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
  fps,
  onFpsChange,
  mode,
  iterations,
  onIterationsChange,
  seedLocked,
  onSeedLockedChange,
  apiKey,
  onApiKeyChange,
  showApiKeyField = false,
  showLoopControl = false,
  loopEnabled,
  onLoopChange,
  focusRefs,
  showExtendControl = true,
}: Props) {
  const { t } = useI18n();
  const localizedControls = t('workspace.generate.controls', DEFAULT_CONTROLS_COPY) as
    | Partial<typeof DEFAULT_CONTROLS_COPY>
    | undefined;
  const controlsCopy = useMemo(() => {
    const source = localizedControls ?? {};
    return {
      ...DEFAULT_CONTROLS_COPY,
      ...source,
      core: { ...DEFAULT_CONTROLS_COPY.core, ...(source.core ?? {}) },
      billingTip: { ...DEFAULT_CONTROLS_COPY.billingTip, ...(source.billingTip ?? {}) },
      frames: { ...DEFAULT_CONTROLS_COPY.frames, ...(source.frames ?? {}) },
      duration: { ...DEFAULT_CONTROLS_COPY.duration, ...(source.duration ?? {}) },
      resolution: { ...DEFAULT_CONTROLS_COPY.resolution, ...(source.resolution ?? {}) },
      aspect: {
        ...DEFAULT_CONTROLS_COPY.aspect,
        ...(source.aspect ?? {}),
        options: {
          ...DEFAULT_CONTROLS_COPY.aspect.options,
          ...(source.aspect?.options ?? {}),
        },
      },
      loop: { ...DEFAULT_CONTROLS_COPY.loop, ...(source.loop ?? {}) },
      seed: { ...DEFAULT_CONTROLS_COPY.seed, ...(source.seed ?? {}) },
      apiKey: { ...DEFAULT_CONTROLS_COPY.apiKey, ...(source.apiKey ?? {}) },
      extend: { ...DEFAULT_CONTROLS_COPY.extend, ...(source.extend ?? {}) },
    } as typeof DEFAULT_CONTROLS_COPY;
  }, [localizedControls]);
  const [seed, setSeed] = useState<string>('');
  const [guidance, setGuidance] = useState<number | null>(null);
  const [initInfluence, setInitInfluence] = useState<number | null>(null);
  const [promptStrength, setPromptStrength] = useState<number | null>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);


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
    if (caps?.resolution && caps.resolution.length) return caps.resolution;
    return engine.resolutions;
  }, [caps?.resolution, engine.resolutions]);

  const aspectOptions = useMemo(() => {
    if (caps) {
      if (caps.aspectRatio && caps.aspectRatio.length) return caps.aspectRatio;
      return [];
    }
    return engine.aspectRatios;
  }, [caps, engine.aspectRatios]);

  const showResolutionControl = resolutionOptions.length > 0;
  const showAspectControl = aspectOptions.length > 0;
  const audioIncluded = Boolean(engine.audio);

  return (
    <Card className="space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">
            {controlsCopy.core.title}
          </h2>
          <p className="text-[12px] text-text-muted">{controlsCopy.core.subtitle}</p>
          {audioIncluded && controlsCopy.core.audioIncluded && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accentSoft/10 px-3 py-1 text-[11px] font-semibold text-accent">
              <span className="text-[9px] text-accent">●</span>
              <span>{controlsCopy.core.audioIncluded}</span>
            </div>
          )}
        </div>
      </header>

      {showApiKeyField && (
        <div className="rounded-input border border-dashed border-border bg-white/80 p-3 text-[12px] text-text-muted">
          <span className="font-semibold text-text-secondary">{controlsCopy.billingTip.label}</span>{' '}
          {controlsCopy.billingTip.body}
        </div>
      )}

      <div className="grid gap-3">
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
                  <button
                    key={option}
                    type="button"
                    onClick={() => onNumFramesChange?.(option)}
                    disabled={!onNumFramesChange}
                    className={clsx(
                      'rounded-input border px-3 py-1.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'border-accent bg-accent text-white'
                      : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10',
                      !onNumFramesChange && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    {(controlsCopy.frames.unit ?? '{count} frames').replace('{count}', String(option))}
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] text-text-muted">{controlsCopy.frames.hint}</span>
          </div>
        ) : enumeratedDurationOptions && enumeratedDurationOptions.length ? (
          <div className="flex flex-col gap-2 text-sm text-text-secondary">
            <span className="text-[12px] uppercase tracking-micro text-text-muted">
              {controlsCopy.duration.optionsLabel}
              <span className="ml-2 align-middle text-[11px] text-text-muted/80">
                {(controlsCopy.duration.maxLabel ?? 'Max {seconds}s').replace('{seconds}', String(engine.maxDurationSec))}
              </span>
            </span>
            <div className="flex flex-wrap gap-2" ref={durationOptionsContainerRef}>
              {enumeratedDurationOptions.map((option) => {
                const active = matchesDurationOptionValue(option, durationOption, durationSec);
                return (
                  <button
                    key={String(option.raw)}
                    type="button"
                    onClick={() => onDurationChange(option.raw)}
                    className={clsx(
                      'rounded-input border px-3 py-1.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'border-accent bg-accent text-white'
                        : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10'
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {engine.id.startsWith('sora-2') && (
              <p className="text-[11px] text-text-tertiary">
                L’API Fal expose 4/8/12&nbsp;s (l’app Sora peut afficher 15/25&nbsp;s Pro).
              </p>
            )}
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
            <div className="flex items-center gap-3 rounded-input border border-border bg-white px-3 py-2">
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
                className="w-16 rounded-input border border-border bg-white px-2 py-1 text-right text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </label>
        ) : (
          <div className="rounded-input border border-dashed border-border bg-white/60 p-3 text-[12px] text-text-muted">
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
              let label = baseMap[optionKey] ?? optionKey;
              if (engine.id.includes('pro') && resolutionCopy.proSuffix) {
                label = `${label} ${resolutionCopy.proSuffix}`;
              }
              return label;
            }}
          />
        )}

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
            <button
              key={n}
              type="button"
              onClick={() => onIterationsChange(n)}
              className={clsx(
                'rounded-input border px-2.5 py-1 text-[12px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                iterations === n
                  ? 'border-accent bg-accent text-white'
                  : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10'
              )}
            >
              X{n}
            </button>
          ))}
        </div>
      )}
      {showLoopControl && typeof loopEnabled === 'boolean' && onLoopChange && (
        <div className="-mt-1 flex items-center justify-between px-1">
          <span className="text-[11px] uppercase tracking-micro text-text-muted">{controlsCopy.loop.label}</span>
          <button
            type="button"
            onClick={() => onLoopChange(!loopEnabled)}
            className={clsx(
              'rounded-input border px-2.5 py-1 text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              loopEnabled
                ? 'border-accent bg-accent text-white'
                : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10'
            )}
            aria-pressed={loopEnabled}
          >
            {loopEnabled ? controlsCopy.loop.on : controlsCopy.loop.off}
          </button>
        </div>
      )}
      <div className="rounded-input border border-border bg-white">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
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
        </button>
        {isAdvancedOpen && (
          <div className="space-y-3 border-t border-border px-3 pb-3 pt-2">
            <label className="flex flex-col gap-2 text-sm text-text-secondary">
              <span className="text-[12px] uppercase tracking-micro text-text-muted">{controlsCopy.seed.label}</span>
              <input
                type="number"
                placeholder={controlsCopy.seed.placeholder}
                value={seed}
                onChange={(e) => setSeed(e.currentTarget.value)}
                className="rounded-input border border-border bg-white px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

            {engine.fps.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {engine.fps.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onFpsChange(option)}
                  className={clsx(
                      'rounded-input border px-3 py-1.5 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      option === fps
                        ? 'border-accent bg-accent text-white'
                        : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10'
                    )}
                  >
                    {(controlsCopy.fpsSuffix ?? '{value} fps').replace('{value}', String(option))}
                  </button>
                ))}
              </div>
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

            {showApiKeyField && (
              <div className="space-y-2">
                <span className="text-[12px] uppercase tracking-micro text-text-muted">{controlsCopy.apiKey.label}</span>
                <input
                  type="password"
                  placeholder={controlsCopy.apiKey.placeholder}
                  autoComplete="off"
                  value={apiKey ?? ''}
                  onChange={(event) => onApiKeyChange?.(event.currentTarget.value)}
                  className="rounded-input border border-border bg-white px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-[11px] text-text-muted">
                  {controlsCopy.apiKey.note}
                </p>
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
                  <input type="number" min={1} max={30} defaultValue={5} className="w-20 rounded-input border border-border bg-white px-2 py-1 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <span>{controlsCopy.extend.unit}</span>
                </div>
              </div>
            )}

            {engine.keyframes && (
              <div className="text-[12px] text-text-muted">{controlsCopy.keyframes}</div>
            )}
          </div>
        )}
      </div>

    </Card>
  );
}

interface FieldGroupProps {
  label: string;
  options: (string | number)[];
  value: string;
  onChange: (value: string) => void;
  focusRef?: Ref<HTMLDivElement>;
  labelFor?: (option: string | number) => string;
  iconFor?: (option: string | number) => string | undefined;
}

function FieldGroup({ label, options, value, onChange, focusRef, labelFor, iconFor }: FieldGroupProps) {
  return (
    <div
      className={clsx(
        'rounded-input border border-border bg-white p-3 text-sm text-text-secondary',
        focusRef && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      ref={focusRef}
      tabIndex={focusRef ? -1 : undefined}
    >
      <span className="text-[12px] uppercase tracking-micro text-text-muted">{label}</span>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(String(option))}
            className={clsx(
              'rounded-input border px-3 py-1.5 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              String(option) === value
                ? 'border-accent bg-accent text-white'
                : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10'
            )}
          >
            {iconFor && iconFor(option) && (
              <Image src={iconFor(option)!} alt="" width={14} height={14} className="mr-2 inline-block h-3.5 w-3.5 align-[-2px]" />
            )}
            {labelFor ? labelFor(option) : String(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

function RangeWithInput({
  value,
  min = 0,
  max = 1,
  step = 0.05,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="range-input h-1 flex-1 appearance-none overflow-hidden rounded-full bg-hairline"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="w-20 rounded-input border border-border bg-white px-2 py-1 text-right text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
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
