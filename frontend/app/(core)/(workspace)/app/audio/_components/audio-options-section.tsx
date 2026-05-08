import {
  AudioLines,
  ChevronDown,
  Clock3,
  Gauge,
  Languages,
  Mic2,
  Play,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';

import { UIIcon } from '@/components/ui/UIIcon';
import {
  coerceAudioIntensity,
  coerceAudioLanguage,
  coerceAudioMood,
  coerceAudioVoiceDelivery,
  coerceAudioVoiceGender,
  coerceAudioVoiceProfile,
  type AudioIntensity,
  type AudioLanguage,
  type AudioMood,
  type AudioPackId,
  type AudioVoiceDelivery,
  type AudioVoiceGender,
  type AudioVoiceProfile,
} from '@/lib/audio-generation';
import {
  DEFAULT_INTENSITY,
  DEFAULT_LANGUAGE,
  DEFAULT_MOOD,
  DEFAULT_VOICE_DELIVERY,
  DEFAULT_VOICE_GENDER,
  DEFAULT_VOICE_PROFILE,
  resolveProviderLabel,
} from '../_lib/audio-workspace-helpers';
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
  language,
  languageOptions,
  manualDurationSec,
  mood,
  moodOptions,
  musicEnabled,
  onExportAudioFileChange,
  onIntensityChange,
  onLanguageChange,
  onManualDurationChange,
  onMoodChange,
  onMusicEnabledChange,
  onVoiceDeliveryChange,
  onVoiceGenderChange,
  onVoiceProfileChange,
  pack,
  showExportToggle,
  showIntensity,
  showManualDuration,
  showMood,
  showMusicToggle,
  showVoiceFields,
  showVoiceGender,
  voiceDelivery,
  voiceDeliveryOptions,
  voiceGender,
  voiceGenderOptions,
  voiceProfile,
  voiceProfileOptions,
}: {
  copy: AudioWorkspaceCopy;
  durationOptions: AudioOption[];
  exportAudioFile: boolean;
  intensity: AudioIntensity;
  intensityOptions: AudioOption[];
  language: AudioLanguage;
  languageOptions: AudioOption[];
  manualDurationSec: number;
  mood: AudioMood;
  moodOptions: AudioOption[];
  musicEnabled: boolean;
  onExportAudioFileChange: (next: boolean) => void;
  onIntensityChange: (next: AudioIntensity) => void;
  onLanguageChange: (next: AudioLanguage) => void;
  onManualDurationChange: (next: number) => void;
  onMoodChange: (next: AudioMood) => void;
  onMusicEnabledChange: (next: boolean) => void;
  onVoiceDeliveryChange: (next: AudioVoiceDelivery) => void;
  onVoiceGenderChange: (next: AudioVoiceGender) => void;
  onVoiceProfileChange: (next: AudioVoiceProfile) => void;
  pack: AudioPackId;
  showExportToggle: boolean;
  showIntensity: boolean;
  showManualDuration: boolean;
  showMood: boolean;
  showMusicToggle: boolean;
  showVoiceFields: boolean;
  showVoiceGender: boolean;
  voiceDelivery: AudioVoiceDelivery;
  voiceDeliveryOptions: AudioOption[];
  voiceGender: AudioVoiceGender;
  voiceGenderOptions: AudioOption[];
  voiceProfile: AudioVoiceProfile;
  voiceProfileOptions: AudioOption[];
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
        {showVoiceGender ? (
          <AudioSelectControl
            label={copy.controls.voiceType}
            value={voiceGender}
            options={voiceGenderOptions}
            icon={Mic2}
            onChange={(next) => onVoiceGenderChange(coerceAudioVoiceGender(String(next)) ?? DEFAULT_VOICE_GENDER)}
          />
        ) : null}
        {showVoiceFields ? (
          <AudioSelectControl
            label={copy.controls.voice}
            value={voiceProfile}
            options={voiceProfileOptions}
            icon={AudioLines}
            onChange={(next) => onVoiceProfileChange(coerceAudioVoiceProfile(String(next)) ?? DEFAULT_VOICE_PROFILE)}
          />
        ) : null}
        {showVoiceFields ? (
          <AudioSelectControl
            label={copy.controls.delivery}
            value={voiceDelivery}
            options={voiceDeliveryOptions}
            icon={Play}
            onChange={(next) => onVoiceDeliveryChange(coerceAudioVoiceDelivery(String(next)) ?? DEFAULT_VOICE_DELIVERY)}
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
            label={copy.controls.language}
            value={language}
            options={languageOptions}
            icon={Languages}
            onChange={(next) => onLanguageChange(coerceAudioLanguage(String(next)) ?? DEFAULT_LANGUAGE)}
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
