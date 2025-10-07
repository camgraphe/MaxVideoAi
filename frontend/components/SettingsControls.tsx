"use client";

import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { Ref } from 'react';
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
  seedLocked?: boolean;
  onSeedLockedChange?: (value: boolean) => void;
  focusRefs?: {
    duration?: Ref<HTMLInputElement>;
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
  seedLocked,
  onSeedLockedChange,
  focusRefs,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seed, setSeed] = useState<string>('');
  const [jitter, setJitter] = useState<number>(0);
  const [guidance, setGuidance] = useState<number | null>(null);
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [initInfluence, setInitInfluence] = useState<number | null>(null);
  const [promptStrength, setPromptStrength] = useState<number | null>(null);

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

      <div className="grid gap-3">
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
              ref={focusRefs?.duration}
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

      <div className="space-y-3">
        <FieldGroup
          label="Resolution"
          options={engine.resolutions}
          value={resolution}
          onChange={onResolutionChange}
          focusRef={focusRefs?.resolution}
          labelFor={(opt) =>
            ({
              '512P': '512P',
              '768P': '768P',
              '720p': '720p • HD',
              '1080p': '1080p • Full HD',
              '4k': '4K • Ultra HD'
            } as Record<string, string>)[
              String(opt)
            ] || String(opt)
          }
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
        />
      </div>

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
          {engine.audio && (
            <TogglePill
              label="Generate audio"
              disabled={mode !== 't2v'}
              active={addons.audio && mode === 't2v'}
              onClick={() => mode === 't2v' && onAddonToggle('audio', !addons.audio)}
            />
          )}
        </div>
        {engine.audio && mode !== 't2v' && (
          <p className="text-[12px] text-text-muted">Audio is only available in Text → Video mode.</p>
        )}
      </div>

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
            <div className="grid gap-3 md:grid-cols-2">
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
              <div className="flex items-end justify-between gap-3">
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
            </div>

            {/* Iterations moved to Core next to Duration */}

            <FieldGroup
              label="FPS"
              options={engine.fps.map(String)}
              value={String(fps)}
              onChange={(value) => onFpsChange(Number(value))}
              labelFor={(opt) => `${opt} fps`}
            />

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

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-text-secondary">
                <span className="text-[12px] uppercase tracking-micro text-text-muted">Negative prompt</span>
                <input
                  type="text"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.currentTarget.value)}
                  className="rounded-input border border-border bg-white px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </div>

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

            {engine.audio && (
              <div className="space-y-2">
                <h4 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Audio</h4>
                <div className="flex flex-wrap gap-2 text-[13px]">
                  {['Generate', 'Replace', 'Enhance'].map((label) => (
                    <span key={label} className="rounded-input border border-hairline bg-white px-3 py-1.5 text-text-secondary">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {engine.upscale4k && (
              <div className="space-y-2">
                <h4 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Upscale</h4>
                <div className="flex flex-wrap items-center gap-3 text-[13px]">
                  <span className="rounded-input border border-hairline bg-white px-3 py-1.5 text-text-secondary">Method: Neural 4x</span>
                  <span className="rounded-input border border-hairline bg-white px-3 py-1.5 text-text-secondary">Intensity: Medium</span>
                </div>
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

            <div className="grid gap-3 md:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-[13px] text-text-secondary">
                <input type="checkbox" />
                <span>Feature this render</span>
              </label>
              <label className="inline-flex items-center gap-2 text-[13px] text-text-secondary">
                <span className="text-[12px] uppercase tracking-micro text-text-muted">Safety</span>
                <select className="rounded-input border border-border bg-white px-2 py-1 text-[13px] text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option>Standard</option>
                  <option>Strict</option>
                </select>
              </label>
            </div>

            {engine.keyframes && (
              <div className="text-[12px] text-text-muted">Keyframes supported (Pika 2.2)</div>
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
