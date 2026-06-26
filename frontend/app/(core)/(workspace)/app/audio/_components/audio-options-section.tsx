'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Check,
  ChevronDown,
  Clock3,
  Gauge,
  Headphones,
  Mic2,
  Play,
  SlidersHorizontal,
  Sparkles,
  Volume2,
} from 'lucide-react';

import { UIIcon } from '@/components/ui/UIIcon';
import {
  coerceAudioIntensity,
  coerceAudioMood,
  coerceSeedAudioOutputFormat,
  coerceSeedAudioSampleRate,
  coerceSeedAudioVoice,
  DEFAULT_SEED_AUDIO_OUTPUT_FORMAT,
  DEFAULT_SEED_AUDIO_SAMPLE_RATE,
  DEFAULT_SEED_AUDIO_VOICE,
  type AudioIntensity,
  type AudioMood,
  type AudioPackId,
  type AudioSeedAudioOutputFormat,
  type AudioSeedAudioSampleRate,
  type AudioSeedAudioVoice,
} from '@/lib/audio-generation';
import {
  DEFAULT_INTENSITY,
  DEFAULT_MOOD,
  resolveProviderLabel,
} from '../_lib/audio-workspace-helpers';
import { buildSeedAudioVoiceOption } from '../_lib/seed-audio-voice-metadata';
import type { AudioWorkspaceCopy } from '../copy';
import { AudioSelectControl, ToggleRow } from './audio-workspace-controls';

type AudioOption = {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
};

export function AudioOptionsSection({
  copy,
  durationOptions,
  exportAudioFile,
  intensity,
  intensityOptions,
  manualDurationSec,
  mood,
  moodOptions,
  musicEnabled,
  onExportAudioFileChange,
  onIntensityChange,
  onManualDurationChange,
  onMoodChange,
  onMusicEnabledChange,
  onSeedAudioOutputFormatChange,
  onSeedAudioPitchChange,
  onSeedAudioSampleRateChange,
  onSeedAudioSpeedChange,
  onSeedAudioVoiceChange,
  onSeedAudioVolumeChange,
  pack,
  seedAudioOutputFormat,
  seedAudioOutputFormatOptions,
  seedAudioPitch,
  seedAudioPitchOptions,
  seedAudioSampleRate,
  seedAudioSampleRateOptions,
  seedAudioSpeed,
  seedAudioSpeedOptions,
  seedAudioVoice,
  seedAudioVoiceOptions,
  seedAudioVolume,
  seedAudioVolumeOptions,
  showExportToggle,
  showIntensity,
  showManualDuration,
  showMood,
  showMusicToggle,
  showSeedAudioVoice,
  showVoiceFields,
}: {
  copy: AudioWorkspaceCopy;
  durationOptions: AudioOption[];
  exportAudioFile: boolean;
  intensity: AudioIntensity;
  intensityOptions: AudioOption[];
  manualDurationSec: number;
  mood: AudioMood;
  moodOptions: AudioOption[];
  musicEnabled: boolean;
  onExportAudioFileChange: (next: boolean) => void;
  onIntensityChange: (next: AudioIntensity) => void;
  onManualDurationChange: (next: number) => void;
  onMoodChange: (next: AudioMood) => void;
  onMusicEnabledChange: (next: boolean) => void;
  onSeedAudioOutputFormatChange: (next: AudioSeedAudioOutputFormat) => void;
  onSeedAudioPitchChange: (next: number) => void;
  onSeedAudioSampleRateChange: (next: AudioSeedAudioSampleRate) => void;
  onSeedAudioSpeedChange: (next: number) => void;
  onSeedAudioVoiceChange: (next: AudioSeedAudioVoice) => void;
  onSeedAudioVolumeChange: (next: number) => void;
  pack: AudioPackId;
  seedAudioOutputFormat: AudioSeedAudioOutputFormat;
  seedAudioOutputFormatOptions: AudioOption[];
  seedAudioPitch: number;
  seedAudioPitchOptions: AudioOption[];
  seedAudioSampleRate: AudioSeedAudioSampleRate;
  seedAudioSampleRateOptions: AudioOption[];
  seedAudioSpeed: number;
  seedAudioSpeedOptions: AudioOption[];
  seedAudioVoice: AudioSeedAudioVoice;
  seedAudioVoiceOptions: AudioOption[];
  seedAudioVolume: number;
  seedAudioVolumeOptions: AudioOption[];
  showExportToggle: boolean;
  showIntensity: boolean;
  showManualDuration: boolean;
  showMood: boolean;
  showMusicToggle: boolean;
  showSeedAudioVoice: boolean;
  showVoiceFields: boolean;
}) {
  return (
    <div className="rounded-[12px] border border-hairline bg-surface p-4 shadow-card lg:col-span-2">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {showMood ? (
          <AudioSelectControl
            label={copy.controls.mood}
            value={mood}
            options={moodOptions}
            icon={Sparkles}
            onChange={(next) => onMoodChange(coerceAudioMood(next) ?? DEFAULT_MOOD)}
          />
        ) : null}
        {showSeedAudioVoice ? (
          <SeedAudioVoiceDropdown
            copy={copy}
            value={seedAudioVoice}
            options={seedAudioVoiceOptions}
            onChange={(next) => onSeedAudioVoiceChange(coerceSeedAudioVoice(String(next)) ?? DEFAULT_SEED_AUDIO_VOICE)}
          />
        ) : null}
        {showVoiceFields ? (
          <AudioSelectControl
            label={copy.controls.seedAudioOutputFormat}
            value={seedAudioOutputFormat}
            options={seedAudioOutputFormatOptions}
            icon={AudioLines}
            onChange={(next) =>
              onSeedAudioOutputFormatChange(coerceSeedAudioOutputFormat(String(next)) ?? DEFAULT_SEED_AUDIO_OUTPUT_FORMAT)
            }
          />
        ) : null}
        {showVoiceFields ? (
          <AudioSelectControl
            label={copy.controls.seedAudioSampleRate}
            value={seedAudioSampleRate}
            options={seedAudioSampleRateOptions}
            icon={Play}
            onChange={(next) =>
              onSeedAudioSampleRateChange(coerceSeedAudioSampleRate(next) ?? DEFAULT_SEED_AUDIO_SAMPLE_RATE)
            }
          />
        ) : null}
        {showIntensity ? (
          <AudioSelectControl
            label={copy.controls.intensity}
            value={intensity}
            options={intensityOptions}
            icon={Gauge}
            onChange={(next) => onIntensityChange(coerceAudioIntensity(next) ?? DEFAULT_INTENSITY)}
          />
        ) : null}
        {showVoiceFields ? (
          <AudioSelectControl
            label={copy.controls.seedAudioSpeed}
            value={seedAudioSpeed}
            options={seedAudioSpeedOptions}
            icon={Gauge}
            onChange={(next) => {
              const numericValue = Number(next);
              if (seedAudioSpeedOptions.some((option) => option.value === numericValue)) {
                onSeedAudioSpeedChange(numericValue);
              }
            }}
          />
        ) : null}
        {showVoiceFields ? (
          <AudioSelectControl
            label={copy.controls.seedAudioVolume}
            value={seedAudioVolume}
            options={seedAudioVolumeOptions}
            icon={Volume2}
            onChange={(next) => {
              const numericValue = Number(next);
              if (seedAudioVolumeOptions.some((option) => option.value === numericValue)) {
                onSeedAudioVolumeChange(numericValue);
              }
            }}
          />
        ) : null}
        {showVoiceFields ? (
          <AudioSelectControl
            label={copy.controls.seedAudioPitch}
            value={seedAudioPitch}
            options={seedAudioPitchOptions}
            icon={SlidersHorizontal}
            onChange={(next) => {
              const numericValue = Number(next);
              if (seedAudioPitchOptions.some((option) => option.value === numericValue)) {
                onSeedAudioPitchChange(numericValue);
              }
            }}
          />
        ) : null}
        {showManualDuration ? (
          <AudioSelectControl
            label={copy.controls.duration}
            value={manualDurationSec}
            options={durationOptions}
            icon={Clock3}
            onChange={(next) => {
              const numericDuration = Number(next);
              if (durationOptions.some((option) => option.value === numericDuration)) {
                onManualDurationChange(numericDuration);
              }
            }}
          />
        ) : null}
      </div>

      <details className="group mt-4 rounded-[10px] border border-hairline bg-bg">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
            <UIIcon icon={SlidersHorizontal} size={16} />
            {copy.controls.advanced.title}
          </span>
          <ChevronDown className="h-4 w-4 text-text-muted transition group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-3 border-t border-hairline p-4 md:grid-cols-2">
          {showMusicToggle ? (
            <ToggleRow
              label={copy.controls.musicToggle.label}
              description={copy.controls.musicToggle.description}
              checked={musicEnabled}
              onChange={onMusicEnabledChange}
            />
          ) : null}
          {showExportToggle ? (
            <ToggleRow
              label={copy.controls.exportToggle.label}
              description={copy.controls.exportToggle.description}
              checked={exportAudioFile}
              onChange={onExportAudioFileChange}
            />
          ) : null}
          <div className="rounded-[10px] border border-hairline bg-surface px-4 py-3">
            <p className="text-sm font-semibold text-text-primary">{copy.controls.providerStack}</p>
            <p className="mt-1 text-sm text-text-secondary">{resolveProviderLabel(copy, pack)}</p>
          </div>
        </div>
      </details>
    </div>
  );
}

function SeedAudioVoiceDropdown({
  copy,
  value,
  options,
  onChange,
}: {
  copy: AudioWorkspaceCopy;
  value: AudioSeedAudioVoice;
  options: AudioOption[];
  onChange: (next: AudioSeedAudioVoice) => void;
}) {
  const voiceOptions = options
    .map((option) => {
      const voice = coerceSeedAudioVoice(String(option.value));
      return voice ? buildSeedAudioVoiceOption(voice, option.label) : null;
    })
    .filter((option): option is NonNullable<typeof option> => Boolean(option));
  const selectedVoice =
    voiceOptions.find((option) => option.value === value) ??
    buildSeedAudioVoiceOption(DEFAULT_SEED_AUDIO_VOICE, copy.controls.seedAudioVoices[DEFAULT_SEED_AUDIO_VOICE]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (dropdownRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  return (
    <div className="min-w-0">
      <span className="mb-2 block text-sm font-semibold text-text-primary">{copy.controls.seedAudioVoice}</span>
      <details
        ref={dropdownRef}
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="group relative min-w-0"
      >
        <summary className="inline-flex h-10 w-full min-w-[140px] cursor-pointer list-none items-center justify-between gap-2 rounded-full border border-border bg-surface px-3 py-0 text-[12px] font-medium text-text-primary shadow-none transition hover:border-border-hover hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-surface dark:text-white/92 dark:hover:border-white/16 dark:hover:bg-surface-hover">
          <span className="inline-flex min-w-0 flex-1 items-center gap-2">
            <UIIcon icon={Mic2} size={15} strokeWidth={1.8} />
            <span className="truncate">{selectedVoice.name}</span>
            <span className="hidden shrink-0 gap-0.5 sm:inline-flex" aria-hidden>
              {selectedVoice.languages.slice(0, 3).map((language) => (
                <span key={language.code} title={language.label} className="text-sm leading-none">
                  {language.flag}
                </span>
              ))}
            </span>
            {selectedVoice.mixed ? (
              <span
                aria-label={selectedVoice.mixedTooltip}
                title={selectedVoice.mixedTooltip}
                className="shrink-0 rounded-full border border-brand/20 bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold leading-none text-brand"
              >
                Mixed
              </span>
            ) : null}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted transition group-open:rotate-180" aria-hidden />
        </summary>
        <div
          role="listbox"
          aria-label={copy.controls.seedAudioVoice}
          className="absolute bottom-full left-0 z-[80] mb-2 w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-card border border-border bg-surface p-1 shadow-card dark:border-white/10 dark:bg-[#121a25] dark:shadow-[0_18px_38px_rgba(0,0,0,0.42)]"
        >
          <div className="max-h-[320px] space-y-1 overflow-y-auto overflow-x-hidden pr-1 text-[12px]">
            {voiceOptions.map((option) => {
              const active = option.value === value;
              return (
                <div
                  key={option.value}
                  className={[
                    'grid grid-cols-[minmax(0,1fr)_150px] items-center gap-2 rounded-input px-2 py-2',
                    active ? 'bg-surface-2 text-text-primary dark:bg-white/[0.12] dark:text-white' : '',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className="flex min-w-0 items-center gap-2 rounded-input px-1 py-1 text-left text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-white/70 dark:hover:text-white"
                  >
                    <UIIcon icon={Mic2} size={15} strokeWidth={1.8} />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-semibold">{option.name}</span>
                        {option.mixed ? (
                          <span
                            aria-label={option.mixedTooltip}
                            title={option.mixedTooltip}
                            className="shrink-0 rounded-full border border-brand/20 bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold leading-none text-brand"
                          >
                            Mixed
                          </span>
                        ) : null}
                      </span>
                      <span
                        className="mt-1 flex flex-wrap gap-1"
                        aria-label={option.languages.map((language) => language.label).join(', ')}
                      >
                        {option.languages.map((language) => (
                          <span key={language.code} title={language.label} className="text-sm leading-none">
                            {language.flag}
                          </span>
                        ))}
                      </span>
                    </span>
                    {active ? <Check className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden /> : null}
                  </button>
                  {option.sampleUrl ? (
                    <audio controls src={option.sampleUrl} className="h-8 w-full" />
                  ) : (
                    <span className="flex min-h-8 items-center gap-2 rounded-[8px] border border-dashed border-hairline bg-bg px-2 py-1 text-[11px] font-medium text-text-secondary">
                      <UIIcon icon={Headphones} size={14} />
                      <span className="truncate">{copy.controls.seedAudioSamplePending}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </details>
    </div>
  );
}
