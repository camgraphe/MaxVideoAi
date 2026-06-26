'use client';

import deepmerge from 'deepmerge';
import { useCallback, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { ButtonLink } from '@/components/ui/Button';
import {
  AUDIO_PROMPT_MAX_LENGTH,
  AUDIO_SCRIPT_MAX_LENGTH,
  DEFAULT_SEED_AUDIO_OUTPUT_FORMAT,
  DEFAULT_SEED_AUDIO_PITCH,
  DEFAULT_SEED_AUDIO_SAMPLE_RATE,
  DEFAULT_SEED_AUDIO_SPEED,
  DEFAULT_SEED_AUDIO_VOICE,
  DEFAULT_SEED_AUDIO_VOLUME,
  buildAudioPricingSnapshot,
  estimateVoiceScriptDurationSec,
  formatAudioDurationLabel,
  getAudioPackConfig,
  type AudioIntensity,
  type AudioLanguage,
  type AudioMood,
  type AudioOutputKind,
  type AudioPackId,
  type AudioSeedAudioOutputFormat,
  type AudioSeedAudioSampleRate,
  type AudioSeedAudioVoice,
  type AudioVoiceDelivery,
  type AudioVoiceGender,
  type AudioVoiceProfile,
} from '@/lib/audio-generation';
import AudioLatestRendersRail from './AudioLatestRendersRail';
import { AudioGeneratedVideoPickerModal } from './_components/audio-generated-video-picker';
import { AudioWorkspaceComposerSurface } from './_components/audio-workspace-composer-surface';
import { useAudioActiveJobPolling } from './_hooks/useAudioActiveJobPolling';
import { useAudioGenerationRunner } from './_hooks/useAudioGenerationRunner';
import { useAudioGeneratedVideos } from './_hooks/useAudioGeneratedVideos';
import { useAudioLyriaMusicControls } from './_hooks/useAudioLyriaMusicControls';
import { useAudioOptionLists } from './_hooks/useAudioOptionLists';
import { useAudioSourceMediaHandlers } from './_hooks/useAudioSourceMediaHandlers';
import { useAudioWorkspaceRestoration } from './_hooks/useAudioWorkspaceRestoration';
import {
  DEFAULT_INTENSITY,
  DEFAULT_LANGUAGE,
  DEFAULT_MANUAL_DURATION_SEC,
  DEFAULT_MOOD,
  DEFAULT_PACK,
  DEFAULT_VOICE_DELIVERY,
  DEFAULT_VOICE_GENDER,
  DEFAULT_VOICE_PROFILE,
  formatCopy,
  formatCurrency,
} from './_lib/audio-workspace-helpers';
import type {
  ActiveAudioJobState,
  AudioResultState,
  PendingAudioGeneration,
  SourceVideoState,
} from './_lib/audio-workspace-types';
import {
  buildAudioModeOptions,
  DEFAULT_AUDIO_WORKSPACE_COPY,
  formatAudioOutputKind,
  type AudioWorkspaceCopy,
} from './copy';

export default function AudioWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const { user, loading: authLoading } = useRequireAuth({ redirectIfLoggedOut: false });
  const rawCopy = t('workspace.audio', DEFAULT_AUDIO_WORKSPACE_COPY);
  const copy = useMemo<AudioWorkspaceCopy>(() => {
    return deepmerge<AudioWorkspaceCopy>(DEFAULT_AUDIO_WORKSPACE_COPY, (rawCopy ?? {}) as Partial<AudioWorkspaceCopy>);
  }, [rawCopy]);

  const [pack, setPack] = useState<AudioPackId>(DEFAULT_PACK);
  const [mood, setMood] = useState<AudioMood>(DEFAULT_MOOD);
  const [intensity, setIntensity] = useState<AudioIntensity>(DEFAULT_INTENSITY);
  const [prompt, setPrompt] = useState('');
  const [script, setScript] = useState('');
  const [voiceGender, setVoiceGender] = useState<AudioVoiceGender>(DEFAULT_VOICE_GENDER);
  const [voiceProfile, setVoiceProfile] = useState<AudioVoiceProfile>(DEFAULT_VOICE_PROFILE);
  const [voiceDelivery, setVoiceDelivery] = useState<AudioVoiceDelivery>(DEFAULT_VOICE_DELIVERY);
  const [language, setLanguage] = useState<AudioLanguage>(DEFAULT_LANGUAGE);
  const [seedAudioVoice, setSeedAudioVoice] = useState<AudioSeedAudioVoice>(DEFAULT_SEED_AUDIO_VOICE);
  const [seedAudioOutputFormat, setSeedAudioOutputFormat] = useState<AudioSeedAudioOutputFormat>(DEFAULT_SEED_AUDIO_OUTPUT_FORMAT);
  const [seedAudioSampleRate, setSeedAudioSampleRate] = useState<AudioSeedAudioSampleRate>(DEFAULT_SEED_AUDIO_SAMPLE_RATE);
  const [seedAudioSpeed, setSeedAudioSpeed] = useState<number>(DEFAULT_SEED_AUDIO_SPEED);
  const [seedAudioVolume, setSeedAudioVolume] = useState<number>(DEFAULT_SEED_AUDIO_VOLUME);
  const [seedAudioPitch, setSeedAudioPitch] = useState<number>(DEFAULT_SEED_AUDIO_PITCH);
  const [manualDurationSec, setManualDurationSec] = useState<number>(DEFAULT_MANUAL_DURATION_SEC);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [exportAudioFile, setExportAudioFile] = useState(false);
  const [sourceVideo, setSourceVideo] = useState<SourceVideoState | null>(null);
  const [voiceSample, setVoiceSample] = useState<{ url: string; name: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isUploadingSource, setIsUploadingSource] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [pendingAudioGenerations, setPendingAudioGenerations] = useState<PendingAudioGeneration[]>([]);
  const [result, setResult] = useState<AudioResultState | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveAudioJobState | null>(null);
  const [generatedPickerOpen, setGeneratedPickerOpen] = useState(false);
  const {
    generatedVideos,
    generatedVideosError,
    isGeneratedVideosLoading,
  } = useAudioGeneratedVideos({
    loadErrorMessage: copy.messages.loadGeneratedVideos,
    open: generatedPickerOpen,
    user,
  });
  const sourceInputRef = useRef<HTMLInputElement | null>(null);
  const voiceInputRef = useRef<HTMLInputElement | null>(null);
  const {
    durationOptions,
    handleMusicModelChange,
    musicBpm,
    musicBpmOptions,
    musicModel,
    musicModelOptions,
    resetMusicControlsForPack,
    setMusicBpm,
    setMusicModel,
  } = useAudioLyriaMusicControls({
    copy,
    manualDurationSec,
    setManualDurationSec,
  });
  const queryJobId = searchParams?.get('job') ?? null;
  const { manualWorkspaceOverrideRef } = useAudioWorkspaceRestoration({
    copy,
    queryJobId,
    user,
    setActiveJob,
    setExportAudioFile,
    setIntensity,
    setLanguage,
    setManualDurationSec,
    setMusicBpm,
    setMood,
    setMusicModel,
    setMusicEnabled,
    setNotice,
    setPack,
    setPrompt,
    setResult,
    setScript,
    setSeedAudioOutputFormat,
    setSeedAudioPitch,
    setSeedAudioSampleRate,
    setSeedAudioSpeed,
    setSeedAudioVoice,
    setSeedAudioVolume,
    setSourceVideo,
    setVoiceDelivery,
    setVoiceGender,
    setVoiceProfile,
    setVoiceSample,
  });
  const packConfig = getAudioPackConfig(pack);
  const sourceVideoRequired = packConfig.requiresVideo;
  const showMood = packConfig.requiresMood;
  const showIntensity = pack !== 'voice_only';
  const showVoiceFields = packConfig.includesVoice;
  const showSeedAudioVoice = showVoiceFields && !voiceSample;
  const showMusicToggle = packConfig.supportsMusicToggle;
  const showExportToggle = packConfig.supportsAudioExport;
  const showManualDuration = pack === 'music_only' && !sourceVideo?.url;
  const showMusicModel = showManualDuration;
  const showMusicBpm = pack === 'music_only' || (showMusicToggle && musicEnabled);
  const currentOutputKind: AudioOutputKind = packConfig.audioOnly ? 'audio' : exportAudioFile ? 'both' : 'video';
  const modeOptions = useMemo(() => buildAudioModeOptions(copy), [copy]);
  const {
    intensityOptions,
    moodOptions,
    seedAudioOutputFormatOptions,
    seedAudioPitchOptions,
    seedAudioSampleRateOptions,
    seedAudioSpeedOptions,
    seedAudioVoiceOptions,
    seedAudioVolumeOptions,
  } = useAudioOptionLists(copy);
  const handlePackChange = useCallback((nextPack: AudioPackId) => {
    manualWorkspaceOverrideRef.current = true;
    const nextConfig = getAudioPackConfig(nextPack);
    setPack(nextPack);
    resetMusicControlsForPack(nextPack);
    setMusicEnabled(nextConfig.supportsMusicToggle ? nextConfig.defaultMusicEnabled : false);
    setExportAudioFile(false);
    if (!nextConfig.includesVoice) {
      setVoiceSample(null);
    }
  }, [manualWorkspaceOverrideRef, resetMusicControlsForPack]);

  useAudioActiveJobPolling({
    activeJob,
    setActiveJob,
    setResult,
  });

  const estimatedDurationSec = useMemo(() => {
    if (pack === 'voice_only') {
      return script.trim().length ? estimateVoiceScriptDurationSec(script) : null;
    }
    if (sourceVideo?.durationSec) {
      return sourceVideo.durationSec;
    }
    if (pack === 'music_only') {
      return manualDurationSec;
    }
    return null;
  }, [manualDurationSec, pack, script, sourceVideo?.durationSec]);

  const quote = useMemo(() => {
    if (!estimatedDurationSec) return null;
    return buildAudioPricingSnapshot({
      pack,
      mood: showMood ? mood : null,
      durationSec: estimatedDurationSec,
      voiceMode: showVoiceFields ? (voiceSample ? 'clone' : 'standard') : null,
      script: showVoiceFields ? script : null,
      musicEnabled: showMusicToggle ? musicEnabled : getAudioPackConfig(pack).defaultMusicEnabled,
      musicModel: showMusicModel ? musicModel : null,
      musicBpm: showMusicBpm ? musicBpm : null,
    });
  }, [estimatedDurationSec, mood, musicBpm, musicEnabled, musicModel, pack, script, showMood, showMusicBpm, showMusicModel, showMusicToggle, showVoiceFields, voiceSample]);

  const canGenerate =
    Boolean(user) &&
    (!sourceVideoRequired || Boolean(sourceVideo?.url)) &&
    (pack !== 'music_only' || Boolean(sourceVideo?.url) || manualDurationSec >= 3) &&
    (!packConfig.requiresScript || script.trim().length > 0) &&
    ((packConfig.includesVoice && pack !== 'cinematic') || prompt.trim().length > 0);

  const {
    handleClearSourceVideo,
    handleSelectGeneratedVideo,
    handleSourceFileSelect,
    handleVoiceFileSelect,
  } = useAudioSourceMediaHandlers({
    copy,
    manualWorkspaceOverrideRef,
    sourceInputRef,
    voiceInputRef,
    setGeneratedPickerOpen,
    setIsUploadingSource,
    setIsUploadingVoice,
    setNotice,
    setResult,
    setSourceVideo,
    setVoiceSample,
  });

  const handleGeneratedJobId = useCallback((jobId: string) => {
    router.replace(`${pathname}?job=${encodeURIComponent(jobId)}`, { scroll: false });
  }, [pathname, router]);

  const handleGenerate = useAudioGenerationRunner({
    canGenerate,
    copy,
    exportAudioFile,
    intensity,
    language,
    locale,
    manualDurationSec,
    mood,
    musicBpm,
    musicModel,
    musicEnabled,
    onGeneratedJobId: handleGeneratedJobId,
    pack,
    prompt,
    requiresScript: packConfig.requiresScript,
    script,
    seedAudioOutputFormat,
    seedAudioPitch,
    seedAudioSampleRate,
    seedAudioSpeed,
    seedAudioVoice,
    seedAudioVolume,
    setActiveJob,
    setNotice,
    setPendingAudioGenerations,
    setResult,
    showExportToggle,
    showIntensity,
    showMood,
    showMusicBpm,
    showMusicModel,
    showMusicToggle,
    showSeedAudioVoice,
    showVoiceFields,
    sourceVideo,
    voiceDelivery,
    voiceGender,
    voiceProfile,
    voiceSample,
  });

  const handleSelectLatestJob = useCallback(
    (jobId: string) => {
      manualWorkspaceOverrideRef.current = false;
      void router.replace(`${pathname}?job=${encodeURIComponent(jobId)}`, { scroll: false });
    },
    [manualWorkspaceOverrideRef, pathname, router]
  );

  const composerIsScript = showVoiceFields;
  const composerLabel = composerIsScript ? copy.controls.script : copy.controls.prompt;
  const composerValue = composerIsScript ? script : prompt;
  const composerMaxLength = composerIsScript ? AUDIO_SCRIPT_MAX_LENGTH : AUDIO_PROMPT_MAX_LENGTH;
  const composerPlaceholder = composerIsScript
    ? pack === 'voice_only'
      ? copy.controls.scriptVoiceOnlyPlaceholder
      : copy.controls.scriptCinematicPlaceholder
    : pack === 'music_only'
      ? copy.controls.promptMusicPlaceholder
      : copy.controls.promptCinematicPlaceholder;
  const generationHint = !showVoiceFields && !prompt.trim().length
    ? copy.pricing.missingPrompt
    : sourceVideoRequired && !sourceVideo?.url
      ? copy.pricing.missingSourceVideo
      : quote
        ? pack === 'voice_only'
          ? formatAudioOutputKind(copy, currentOutputKind)
          : formatCopy(copy.pricing.summary, {
              output: formatAudioOutputKind(copy, currentOutputKind),
              duration: estimatedDurationSec ? formatAudioDurationLabel(estimatedDurationSec) : '-',
            })
        : copy.pricing.missingOptions;
  const activeProgress =
    activeJob?.status === 'running' || activeJob?.status === 'pending'
      ? activeJob.progress
      : null;
  const displayDurationSec = pack === 'voice_only' ? null : estimatedDurationSec;
  const dockDurationLabel = displayDurationSec ? formatAudioDurationLabel(displayDurationSec) : null;
  const dockPriceLabel = quote ? formatCurrency(quote.totalCents, quote.currency, locale) : '-';
  const inProgressMessage =
    pendingAudioGenerations.length > 0
      ? formatCopy(copy.messages.generatingInProgress, { count: pendingAudioGenerations.length })
      : null;

  if (authLoading) {
    return <div className="flex-1" />;
  }

  if (!user) {
    return (
      <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
        <section className="mx-auto max-w-3xl rounded-card border border-border bg-surface p-8 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.auth.eyebrow}</p>
          <h1 className="mt-3 text-2xl font-semibold text-text-primary">{copy.auth.title}</h1>
          <p className="mt-3 text-sm text-text-secondary">{copy.auth.body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/login" size="sm">
              {copy.auth.createAccount}
            </ButtonLink>
            <ButtonLink href="/login?mode=signin" variant="outline" size="sm">
              {copy.auth.signIn}
            </ButtonLink>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="flex flex-1 min-w-0 flex-col bg-bg xl:flex-row">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AudioWorkspaceComposerSurface
          activeJobId={activeJob?.jobId ?? null}
          activeProgress={activeProgress}
          canGenerate={canGenerate}
          composerIsScript={composerIsScript}
          composerLabel={composerLabel}
          composerMaxLength={composerMaxLength}
          composerPlaceholder={composerPlaceholder}
          composerValue={composerValue}
          copy={copy}
          dockDurationLabel={dockDurationLabel}
          dockPriceLabel={dockPriceLabel}
          durationOptions={durationOptions}
          exportAudioFile={exportAudioFile}
          generationHint={generationHint}
          handleGenerate={handleGenerate}
          handlePackChange={handlePackChange}
          handleSelectLatestJob={handleSelectLatestJob}
          intensity={intensity}
          intensityOptions={intensityOptions}
          inProgressMessage={inProgressMessage}
          isUploadingSource={isUploadingSource}
          isUploadingVoice={isUploadingVoice}
          manualDurationSec={manualDurationSec}
          modeOptions={modeOptions}
          mood={mood}
          moodOptions={moodOptions}
          musicBpm={musicBpm}
          musicBpmOptions={musicBpmOptions}
          musicEnabled={musicEnabled}
          musicModel={musicModel}
          musicModelOptions={musicModelOptions}
          notice={notice}
          onClearSourceVideo={handleClearSourceVideo}
          onOpenGeneratedPicker={() => setGeneratedPickerOpen(true)}
          onSourceFileSelect={handleSourceFileSelect}
          onVoiceFileSelect={handleVoiceFileSelect}
          pack={pack}
          resultJobId={result?.jobId ?? null}
          setExportAudioFile={setExportAudioFile}
          setIntensity={setIntensity}
          setManualDurationSec={setManualDurationSec}
          setMusicBpm={setMusicBpm}
          setMusicModel={handleMusicModelChange}
          setMood={setMood}
          setMusicEnabled={setMusicEnabled}
          setPrompt={setPrompt}
          setScript={setScript}
          setSeedAudioOutputFormat={setSeedAudioOutputFormat}
          setSeedAudioPitch={setSeedAudioPitch}
          setSeedAudioSampleRate={setSeedAudioSampleRate}
          setSeedAudioSpeed={setSeedAudioSpeed}
          setSeedAudioVoice={setSeedAudioVoice}
          setSeedAudioVolume={setSeedAudioVolume}
          setVoiceSample={setVoiceSample}
          showExportToggle={showExportToggle}
          showIntensity={showIntensity}
          showManualDuration={showManualDuration}
          showMood={showMood}
          showMusicBpm={showMusicBpm}
          showMusicModel={showMusicModel}
          showMusicToggle={showMusicToggle}
          showSeedAudioVoice={showSeedAudioVoice}
          showVoiceFields={showVoiceFields}
          sourceInputRef={sourceInputRef}
          sourceVideo={sourceVideo}
          sourceVideoRequired={sourceVideoRequired}
          voiceInputRef={voiceInputRef}
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
          voiceSample={voiceSample}
        />
      </div>

      <aside className="hidden h-[calc(100vh-var(--header-height))] w-full max-w-[332px] shrink-0 flex-col border-l border-hairline bg-surface-2 px-4 pb-6 pt-6 xl:flex">
        <AudioLatestRendersRail activeJobId={activeJob?.jobId ?? result?.jobId ?? null} onSelectJob={handleSelectLatestJob} />
      </aside>

      <AudioGeneratedVideoPickerModal
        open={generatedPickerOpen}
        videos={generatedVideos}
        isLoading={isGeneratedVideosLoading}
        error={generatedVideosError}
        locale={locale}
        copy={copy}
        onClose={() => setGeneratedPickerOpen(false)}
        onSelect={handleSelectGeneratedVideo}
      />
    </div>
  );
}
