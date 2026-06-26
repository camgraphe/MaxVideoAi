'use client';

import type { RefObject } from 'react';
import { AudioLines } from 'lucide-react';
import { Textarea } from '@/components/ui/Input';
import { UIIcon } from '@/components/ui/UIIcon';
import {
  type AudioIntensity,
  type AudioMood,
  type AudioPackId,
  type AudioSeedAudioOutputFormat,
  type AudioSeedAudioSampleRate,
  type AudioSeedAudioVoice,
} from '@/lib/audio-generation';
import AudioLatestRendersRail from '../AudioLatestRendersRail';
import type { AudioWorkspaceCopy } from '../copy';
import type { SourceVideoState } from '../_lib/audio-workspace-types';
import { AudioGenerationDock } from './audio-generation-dock';
import { AudioOptionsSection } from './audio-options-section';
import { AudioSourceVideoSection } from './audio-source-video-section';
import { AudioVoiceSection } from './audio-voice-section';
import { AudioModePicker } from './audio-workspace-controls';

type AudioOption = {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
};

interface AudioWorkspaceComposerSurfaceProps {
  activeJobId: string | null;
  activeProgress: number | null;
  canGenerate: boolean;
  composerIsScript: boolean;
  composerLabel: string;
  composerMaxLength: number;
  composerPlaceholder: string;
  composerValue: string;
  copy: AudioWorkspaceCopy;
  dockDurationLabel: string | null;
  dockPriceLabel: string;
  durationOptions: AudioOption[];
  exportAudioFile: boolean;
  generationHint: string;
  handleGenerate: () => void;
  handlePackChange: (nextPack: AudioPackId) => void;
  handleSelectLatestJob: (jobId: string) => void;
  intensity: AudioIntensity;
  intensityOptions: AudioOption[];
  inProgressMessage: string | null;
  isUploadingSource: boolean;
  isUploadingVoice: boolean;
  manualDurationSec: number;
  modeOptions: Array<{ id: AudioPackId; label: string; description: string }>;
  mood: AudioMood;
  moodOptions: AudioOption[];
  musicEnabled: boolean;
  notice: string | null;
  onClearSourceVideo: () => void;
  onOpenGeneratedPicker: () => void;
  onSourceFileSelect: (fileList: FileList | null) => void | Promise<void>;
  onVoiceFileSelect: (fileList: FileList | null) => void | Promise<void>;
  pack: AudioPackId;
  resultJobId: string | null;
  setExportAudioFile: (value: boolean) => void;
  setIntensity: (value: AudioIntensity) => void;
  setManualDurationSec: (value: number) => void;
  setMood: (value: AudioMood) => void;
  setMusicEnabled: (value: boolean) => void;
  setPrompt: (value: string) => void;
  setScript: (value: string) => void;
  setSeedAudioOutputFormat: (value: AudioSeedAudioOutputFormat) => void;
  setSeedAudioPitch: (value: number) => void;
  setSeedAudioSampleRate: (value: AudioSeedAudioSampleRate) => void;
  setSeedAudioSpeed: (value: number) => void;
  setSeedAudioVoice: (value: AudioSeedAudioVoice) => void;
  setSeedAudioVolume: (value: number) => void;
  setVoiceSample: (value: { url: string; name: string } | null) => void;
  showExportToggle: boolean;
  showIntensity: boolean;
  showManualDuration: boolean;
  showMood: boolean;
  showMusicToggle: boolean;
  showSeedAudioVoice: boolean;
  showVoiceFields: boolean;
  sourceInputRef: RefObject<HTMLInputElement | null>;
  sourceVideo: SourceVideoState | null;
  sourceVideoRequired: boolean;
  voiceInputRef: RefObject<HTMLInputElement | null>;
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
  voiceSample: { url: string; name: string } | null;
}

export function AudioWorkspaceComposerSurface({
  activeJobId,
  activeProgress,
  canGenerate,
  composerIsScript,
  composerLabel,
  composerMaxLength,
  composerPlaceholder,
  composerValue,
  copy,
  dockDurationLabel,
  dockPriceLabel,
  durationOptions,
  exportAudioFile,
  generationHint,
  handleGenerate,
  handlePackChange,
  handleSelectLatestJob,
  intensity,
  intensityOptions,
  inProgressMessage,
  isUploadingSource,
  isUploadingVoice,
  manualDurationSec,
  modeOptions,
  mood,
  moodOptions,
  musicEnabled,
  notice,
  onClearSourceVideo,
  onOpenGeneratedPicker,
  onSourceFileSelect,
  onVoiceFileSelect,
  pack,
  resultJobId,
  setExportAudioFile,
  setIntensity,
  setManualDurationSec,
  setMood,
  setMusicEnabled,
  setPrompt,
  setScript,
  setSeedAudioOutputFormat,
  setSeedAudioPitch,
  setSeedAudioSampleRate,
  setSeedAudioSpeed,
  setSeedAudioVoice,
  setSeedAudioVolume,
  setVoiceSample,
  showExportToggle,
  showIntensity,
  showManualDuration,
  showMood,
  showMusicToggle,
  showSeedAudioVoice,
  showVoiceFields,
  sourceInputRef,
  sourceVideo,
  sourceVideoRequired,
  voiceInputRef,
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
  voiceSample,
}: AudioWorkspaceComposerSurfaceProps) {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-7 lg:py-6">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4 pb-28">
        {inProgressMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-[10px] border border-success-border bg-success-bg px-4 py-2 text-sm font-semibold text-success shadow-card"
          >
            {inProgressMessage}
          </div>
        ) : null}

        {notice ? (
          <div role="status" aria-live="polite" className="rounded-[10px] border border-warning-border bg-warning-bg px-4 py-2 text-sm text-warning shadow-card">
            {notice}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-[9px] border border-hairline bg-surface text-brand shadow-sm">
              <UIIcon icon={AudioLines} size={20} strokeWidth={1.9} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.hero.eyebrow}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-text-primary md:text-3xl">{copy.hero.title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-text-secondary">{copy.hero.body}</p>
            </div>
          </div>
        </div>

        <section className="rounded-[12px] border border-hairline bg-surface p-4 shadow-card">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-text-primary">{copy.controls.chooseType}</h2>
          </div>
          <div className="mt-3">
            <AudioModePicker value={pack} options={modeOptions} onChange={handlePackChange} />
          </div>
        </section>

        {(sourceVideoRequired || sourceVideo) ? (
          <AudioSourceVideoSection
            copy={copy}
            inputRef={sourceInputRef}
            isUploading={isUploadingSource}
            onClear={onClearSourceVideo}
            onFileSelect={onSourceFileSelect}
            onOpenGeneratedPicker={onOpenGeneratedPicker}
            required={sourceVideoRequired}
            sourceVideo={sourceVideo}
          />
        ) : null}

        <section className="rounded-[12px] border border-hairline bg-surface shadow-card">
          <label className="block p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-base font-semibold text-text-primary">{composerLabel}</span>
              <span className="shrink-0 text-xs text-text-muted">{composerValue.length} / {composerMaxLength}</span>
            </div>
            <Textarea
              rows={9}
              value={composerValue}
              onChange={(event) => {
                if (composerIsScript) {
                  setScript(event.target.value);
                } else {
                  setPrompt(event.target.value);
                }
              }}
              placeholder={composerPlaceholder}
              className="min-h-[260px] resize-y bg-bg pr-4 text-base leading-7"
              maxLength={composerMaxLength}
            />
          </label>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <AudioOptionsSection
            copy={copy}
            durationOptions={durationOptions}
            exportAudioFile={exportAudioFile}
            intensity={intensity}
            intensityOptions={intensityOptions}
            manualDurationSec={manualDurationSec}
            mood={mood}
            moodOptions={moodOptions}
            musicEnabled={musicEnabled}
            onExportAudioFileChange={setExportAudioFile}
            onIntensityChange={setIntensity}
            onManualDurationChange={setManualDurationSec}
            onMoodChange={setMood}
            onMusicEnabledChange={setMusicEnabled}
            onSeedAudioOutputFormatChange={setSeedAudioOutputFormat}
            onSeedAudioPitchChange={setSeedAudioPitch}
            onSeedAudioSampleRateChange={setSeedAudioSampleRate}
            onSeedAudioSpeedChange={setSeedAudioSpeed}
            onSeedAudioVoiceChange={setSeedAudioVoice}
            onSeedAudioVolumeChange={setSeedAudioVolume}
            pack={pack}
            seedAudioOutputFormat={seedAudioOutputFormat}
            seedAudioOutputFormatOptions={seedAudioOutputFormatOptions}
            seedAudioPitch={seedAudioPitch}
            seedAudioPitchOptions={seedAudioPitchOptions}
            seedAudioSampleRate={seedAudioSampleRate}
            seedAudioSampleRateOptions={seedAudioSampleRateOptions}
            seedAudioSpeed={seedAudioSpeed}
            seedAudioSpeedOptions={seedAudioSpeedOptions}
            seedAudioVoice={seedAudioVoice}
            seedAudioVoiceOptions={seedAudioVoiceOptions}
            seedAudioVolume={seedAudioVolume}
            seedAudioVolumeOptions={seedAudioVolumeOptions}
            showExportToggle={showExportToggle}
            showIntensity={showIntensity}
            showManualDuration={showManualDuration}
            showMood={showMood}
            showMusicToggle={showMusicToggle}
            showSeedAudioVoice={showSeedAudioVoice}
            showVoiceFields={showVoiceFields}
          />

          {showVoiceFields ? (
            <AudioVoiceSection
              copy={copy}
              inputRef={voiceInputRef}
              isUploading={isUploadingVoice}
              onClear={() => setVoiceSample(null)}
              onFileSelect={onVoiceFileSelect}
              voiceSample={voiceSample}
            />
          ) : null}
        </section>

        <div className="xl:hidden">
          <AudioLatestRendersRail activeJobId={activeJobId ?? resultJobId} onSelectJob={handleSelectLatestJob} variant="mobile" />
        </div>
      </div>

      <AudioGenerationDock
        activeProgress={activeProgress}
        canGenerate={canGenerate}
        copy={copy}
        durationLabel={dockDurationLabel}
        generationHint={generationHint}
        onGenerate={handleGenerate}
        priceLabel={dockPriceLabel}
      />
    </main>
  );
}
