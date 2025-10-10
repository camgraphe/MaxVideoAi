"use client";

import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, Ref } from 'react';
import type { EngineCaps, Mode } from '@/types/engines';
import { Card } from '@/components/ui/Card';

interface Props {
  engine: EngineCaps;
  duration: number;
  onDurationChange: (value: number) => void;
  resolution: string;
  onResolutionChange: (value: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (value: string) => void;
  fps: number;
  onFpsChange: (value: number) => void;
  addons: { audio: boolean; upscale4k: boolean };
  onAddonToggle: (key: 'audio' | 'upscale4k', value: boolean) => void;
  mode: Mode;
  iterations?: number;
  onIterationsChange?: (value: number) => void;
  viewMode?: 'single' | 'quad';
  onViewModeChange?: (mode: 'single' | 'quad') => void;
  seedLocked?: boolean;
  onSeedLockedChange?: (value: boolean) => void;
  apiKey?: string;
  onApiKeyChange?: (value: string) => void;
  showApiKeyField?: boolean;
  focusRefs?: {
    duration?: Ref<HTMLElement>;
    resolution?: Ref<HTMLDivElement>;
    addons?: Ref<HTMLDivElement>;
  };
}

export function SettingsControls({
  engine,
  duration,
  onDurationChange,
  resolution,
  onResolutionChange,
  aspectRatio,
  onAspectRatioChange,
  fps,
  onFpsChange,
  addons,
  onAddonToggle,
  mode,
  iterations,
  onIterationsChange,
  viewMode,
  onViewModeChange,
  seedLocked,
  onSeedLockedChange,
  apiKey,
  onApiKeyChange,
  showApiKeyField = false,
  focusRefs,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seed, setSeed] = useState<string>('');
  const [jitter, setJitter] = useState<number>(0);
  const [guidance, setGuidance] = useState<number | null>(null);
  const [initInfluence, setInitInfluence] = useState<number | null>(null);
  const [promptStrength, setPromptStrength] = useState<number | null>(null);

  const durationSchemaField = useMemo(() => {
    const schema = engine.inputSchema;
    if (!schema) return null;
    const optionalField = schema.optional?.find((field) => field.id === 'duration_seconds');
    const requiredField = schema.required?.find((field) => field.id === 'duration_seconds');
    return optionalField ?? requiredField ?? null;
  }, [engine]);

  const durationOptions = useMemo<number[] | null>(() => {
    if (!durationSchemaField) return null;
    if (durationSchemaField.type === 'enum' && Array.isArray(durationSchemaField.values) && durationSchemaField.values.length) {
      const parsed = durationSchemaField.values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);
      return parsed.length ? parsed : null;
    }
    const min = typeof durationSchemaField.min === 'number' ? durationSchemaField.min : undefined;
    const max = typeof durationSchemaField.max === 'number' ? durationSchemaField.max : undefined;
    const step = typeof durationSchemaField.step === 'number' ? durationSchemaField.step : undefined;
    if (min != null && max != null && step != null && step > 0 && step <= max - min) {
      const options: number[] = [];
      for (let value = min; value <= max && options.length < 8; value += step) {
        options.push(value);
      }
      return options.length && options.length <= 6 ? options : null;
    }
    return null;
  }, [durationSchemaField]);

  useEffect(() => {
    if (!durationOptions || !durationOptions.length) return;
    if (durationOptions.includes(duration)) return;
    const closest = durationOptions.reduce((prev, current) =>
      Math.abs(current - duration) < Math.abs(prev - duration) ? current : prev
    , durationOptions[0]);
    if (closest !== duration) {
      onDurationChange(closest);
    }
  }, [durationOptions, duration, onDurationChange]);

  const durationOptionsContainerRef = useRef<HTMLDivElement | null>(null);
  const durationSliderRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const target = focusRefs?.duration;
    if (!target) return;
    const node: HTMLElement | null = durationOptions?.length
      ? durationOptionsContainerRef.current
      : durationSliderRef.current;
    if (typeof target === 'function') {
      target(node as never);
    } else {
      (target as MutableRefObject<HTMLElement | null>).current = node;
    }
  }, [focusRefs?.duration, durationOptions]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mvai.showAdvanced');
      if (saved === '1' || saved === 'true') setShowAdvanced(true);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('mvai.showAdvanced', showAdvanced ? '1' : '0');
    } catch {}
  }, [showAdvanced]);

  useEffect(() => {
    if (!engine.audio && addons.audio) {
      onAddonToggle('audio', false);
    }
    if (!engine.upscale4k && addons.upscale4k) {
      onAddonToggle('upscale4k', false);
    }
  }, [engine.audio, engine.upscale4k, addons.audio, addons.upscale4k, onAddonToggle]);

  return (
    <Card className="space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Core settings</h2>
          <p className="text-[12px] text-text-muted">Duration, Aspect, Resolution</p>
        </div>
        <button
          type="button"
          className="rounded-[8px] border border-hairline bg-white px-2.5 py-1.5 text-[12px] font-medium text-text-secondary transition hover:border-accentSoft/50 hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? 'Hide advanced' : 'Show advanced'}
        </button>
      </header>

      {showApiKeyField && (
        <div className="rounded-input border border-dashed border-border bg-white/80 p-3 text-[12px] text-text-muted">
          <span className="font-semibold text-text-secondary">Billing tip:</span>{' '}
          Add your OpenAI API key in Advanced settings to bill runs directly through OpenAI. Leave it blank to route charges via FAL credits.
        </div>
      )}

      <div className="grid gap-3">
        {durationOptions?.length ? (
          <div className="flex flex-col gap-2 text-sm text-text-secondary">
            <span className="text-[12px] uppercase tracking-micro text-text-muted">
              Duration — seconds
              <span className="ml-2 align-middle text-[11px] text-text-muted/80">Max {engine.maxDurationSec}s</span>
            </span>
            <div className="flex flex-wrap gap-2" ref={durationOptionsContainerRef}>
              {durationOptions.map((option) => {
                const active = duration === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onDurationChange(option)}
                    className={clsx(
                      'rounded-input border px-3 py-1.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'border-accent bg-accent text-white'
                        : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10'
                    )}
                  >
                    {option}s
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <label className="flex flex-col gap-2 text-sm text-text-secondary">
            <span className="text-[12px] uppercase tracking-micro text-text-muted">
              Duration — seconds
              <span className="ml-2 align-middle text-[11px] text-text-muted/80">Max {engine.maxDurationSec}s</span>
            </span>
            <div className="flex items-center gap-3 rounded-input border border-border bg-white px-3 py-2">
              <input
                type="range"
                min={1}
                max={engine.maxDurationSec}
                value={duration}
                onChange={(event) => onDurationChange(Number(event.currentTarget.value))}
                className="range-input h-1 flex-1 appearance-none overflow-hidden rounded-full bg-hairline"
                ref={durationSliderRef}
              />
              <input
                type="number"
                min={1}
                max={engine.maxDurationSec}
                value={duration}
                onChange={(event) => onDurationChange(Number(event.currentTarget.value))}
                className="w-16 rounded-input border border-border bg-white px-2 py-1 text-right text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </label>
        )}
      </div>

      {onIterationsChange && (
        <div className="-mt-2 mb-1 flex items-center gap-2 px-1">
          <span className="text-[11px] uppercase tracking-micro text-text-muted">Iterations</span>
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
      {onViewModeChange && (
        <div className="-mt-1 flex items-center gap-2 px-1">
          <span className="text-[11px] uppercase tracking-micro text-text-muted">View</span>
          {(['single', 'quad'] as const).map((modeOption) => {
            const isActive = viewMode === modeOption;
            const iterationsCount = Math.max(1, iterations ?? 1);
            const disabled = modeOption === 'quad' && iterationsCount <= 1;
            return (
              <button
                key={modeOption}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onViewModeChange(modeOption)}
                className={clsx(
                  'rounded-input border px-2.5 py-1 text-[12px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  disabled
                    ? 'cursor-not-allowed border-hairline bg-white text-text-muted/60'
                    : isActive
                      ? 'border-accent bg-accent text-white'
                      : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10'
                )}
                aria-pressed={isActive}
              >
                {modeOption === 'single' ? 'Single' : 'Quad'}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        <FieldGroup
          label="Resolution"
          options={engine.resolutions}
          value={resolution}
          onChange={onResolutionChange}
          focusRef={focusRefs?.resolution}
          labelFor={(opt) => {
            const baseMap: Record<string, string> = {
              '512P': '512P',
              '768P': '768P',
              '720p': '720p • HD',
              '1080p': '1080p • Full HD',
              '4k': '4K • Ultra HD',
              auto: 'Auto',
            };
            let label = baseMap[String(opt)] ?? String(opt);
            if (engine.id.includes('pro')) {
              label = `${label} • Pro`;
            }
            return label;
          }}
        />
        <FieldGroup
          label="Aspect"
          options={engine.aspectRatios}
          value={aspectRatio}
          onChange={onAspectRatioChange}
          iconFor={(opt) =>
            ({
              '16:9': '/assets/icons/ar-16-9.svg',
              '9:16': '/assets/icons/ar-9-16.svg',
              '1:1': '/assets/icons/ar-1-1.svg',
              '4:5': '/assets/icons/ar-4-5.svg'
            } as Record<string, string | undefined>)[String(opt)] || undefined
          }
          labelFor={(opt) => {
            const labels: Record<string, string> = {
              '16:9': '16:9',
              '9:16': '9:16',
              '1:1': '1:1',
              '4:5': '4:5',
              auto: 'Auto',
              source: 'Source',
              custom: 'Custom',
            };
            return labels[String(opt)] ?? String(opt);
          }}
        />
      </div>

      {engine.audio && (
        <div className="flex items-center justify-between rounded-input border border-border bg-white p-3 text-sm text-text-secondary">
          <span className="text-[12px] uppercase tracking-micro text-text-muted">Audio</span>
          <TogglePill
            label="Generate audio"
            disabled={mode !== 't2v'}
            active={addons.audio && mode === 't2v'}
            onClick={() => mode === 't2v' && onAddonToggle('audio', !addons.audio)}
          />
        </div>
      )}

      <div className="space-y-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-micro text-text-muted"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          <svg aria-hidden viewBox="0 0 20 20" className={clsx('h-4 w-4 transition-transform', showAdvanced && 'rotate-90')} fill="none">
            <path d="M7 6l6 4-6 4V6z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Advanced settings
        </button>

       {showAdvanced && (
          <div className="space-y-3 rounded-input border border-border bg-white p-3">
            <label className="flex flex-col gap-2 text-sm text-text-secondary">
              <span className="text-[12px] uppercase tracking-micro text-text-muted">Seed</span>
              <input
                type="number"
                placeholder="Random"
                value={seed}
                onChange={(e) => setSeed(e.currentTarget.value)}
                className="rounded-input border border-border bg-white px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-[13px] text-text-secondary">
                <input
                  type="checkbox"
                  checked={Boolean(seedLocked)}
                  onChange={(e) => onSeedLockedChange?.(e.currentTarget.checked)}
                />
                <span>Lock seed</span>
              </label>
              <label className="flex items-center gap-2 text-[13px] text-text-secondary">
                <span className="text-[12px] uppercase tracking-micro text-text-muted">Jitter</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={jitter}
                  onChange={(e) => setJitter(Number(e.currentTarget.value))}
                  className="w-20 rounded-input border border-border bg-white px-2 py-1 text-right text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="text-[12px] text-text-muted">%</span>
              </label>
            </div>

            {/* Iterations moved to Core next to Duration */}

            {engine.fps.length > 0 && (
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
                    {option} fps
                  </button>
                ))}
              </div>
            )}

            {engine.params.promptStrength && (
              <div className="space-y-2">
                <span className="text-[12px] uppercase tracking-micro text-text-muted">Prompt strength</span>
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
                <span className="text-[12px] uppercase tracking-micro text-text-muted">Guidance</span>
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
                <span className="text-[12px] uppercase tracking-micro text-text-muted">OpenAI API key</span>
                <input
                  type="password"
                  placeholder="sk-..."
                  autoComplete="off"
                  value={apiKey ?? ''}
                  onChange={(event) => onApiKeyChange?.(event.currentTarget.value)}
                  className="rounded-input border border-border bg-white px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-[11px] text-text-muted">
                  Provide your OpenAI key to bill directly through your account. We do not store the key server-side.
                </p>
              </div>
            )}

            {(mode === 'i2v' || mode === 'v2v') && engine.params.initInfluence && (
              <div className="space-y-2">
                <h4 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Input influence</h4>
                <RangeWithInput
                  value={initInfluence ?? engine.params.initInfluence.default ?? 0.5}
                  min={engine.params.initInfluence.min ?? 0}
                  max={engine.params.initInfluence.max ?? 1}
                  step={engine.params.initInfluence.step ?? 0.05}
                  onChange={(value) => setInitInfluence(value)}
                />
              </div>
            )}

            {engine.extend && (
              <div className="space-y-2">
                <h4 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Extend</h4>
                <div className="flex items-center gap-2 text-[13px]">
                  <span>Extend by</span>
                  <input type="number" min={1} max={30} defaultValue={5} className="w-20 rounded-input border border-border bg-white px-2 py-1 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <span>seconds</span>
                </div>
              </div>
            )}

            {/* Removed non-functional Feature/Safety options */}

            {engine.keyframes && (
              <div className="text-[12px] text-text-muted">Keyframes supported (Pika 2.2)</div>
            )}

            <div
              className={clsx(
                'space-y-3',
                focusRefs?.addons && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
              ref={focusRefs?.addons}
              tabIndex={focusRefs?.addons ? -1 : undefined}
            >
              <h3 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Add-ons</h3>
              <div className="flex flex-wrap gap-2">
                {engine.upscale4k && (
                  <TogglePill label="Upscale" active={addons.upscale4k} onClick={() => onAddonToggle('upscale4k', !addons.upscale4k)} />
                )}
              </div>
            </div>

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

function TogglePill({ label, active, onClick, disabled }: { label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={clsx(
        'rounded-input border px-3 py-1.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        disabled
          ? 'cursor-not-allowed border-hairline bg-white text-text-muted/60'
          : active
            ? 'border-accent bg-accent text-white'
            : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10'
      )}
    >
      {label}
    </button>
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
