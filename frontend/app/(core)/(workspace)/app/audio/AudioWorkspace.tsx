'use client';

import deepmerge from 'deepmerge';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import { authFetch } from '@/lib/authFetch';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { Job } from '@/types/jobs';
import { ButtonLink } from '@/components/ui/Button';
import {
  AUDIO_INTENSITY_VALUES,
  AUDIO_LANGUAGE_VALUES,
  AUDIO_MUSIC_DURATION_OPTIONS_SEC,
  AUDIO_MOOD_VALUES,
  AUDIO_PROMPT_MAX_LENGTH,
  AUDIO_SCRIPT_MAX_LENGTH,
  AUDIO_VOICE_DELIVERY_VALUES,
  AUDIO_VOICE_PROFILE_VALUES,
  buildAudioPricingSnapshot,
  coerceAudioIntensity,
  coerceAudioLanguage,
  coerceAudioMood,
  coerceAudioPackId,
  coerceAudioVoiceDelivery,
  coerceAudioVoiceGender,
  coerceAudioVoiceProfile,
  estimateVoiceScriptDurationSec,
  formatAudioDurationLabel,
  getAudioPackConfig,
  type AudioIntensity,
  type AudioLanguage,
  type AudioMood,
  type AudioOutputKind,
  type AudioPackId,
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
import {
  AUDIO_VOICE_GENDER_VALUES,
  DEFAULT_INTENSITY,
  DEFAULT_LANGUAGE,
  DEFAULT_MANUAL_DURATION_SEC,
  DEFAULT_MOOD,
  DEFAULT_PACK,
  DEFAULT_VOICE_DELIVERY,
  DEFAULT_VOICE_GENDER,
  DEFAULT_VOICE_PROFILE,
  fetchJobDetail,
  formatCopy,
  formatCurrency,
  inferOutputKind,
  probeVideoDuration,
  resolveUiErrorMessage,
  uploadAsset,
} from './_lib/audio-workspace-helpers';
import type {
  ActiveAudioJobState,
  AudioResultState,
  GeneratedSourceVideo,
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
  const [manualDurationSec, setManualDurationSec] = useState<number>(DEFAULT_MANUAL_DURATION_SEC);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [exportAudioFile, setExportAudioFile] = useState(false);
  const [sourceVideo, setSourceVideo] = useState<SourceVideoState | null>(null);
  const [voiceSample, setVoiceSample] = useState<{ url: string; name: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isUploadingSource, setIsUploadingSource] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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
  const restoredQueryJobRef = useRef<string | null>(null);
  const latestRestoreAttemptedRef = useRef(false);
  const manualWorkspaceOverrideRef = useRef(false);

  const queryJobId = searchParams?.get('job') ?? null;
  const packConfig = getAudioPackConfig(pack);
  const sourceVideoRequired = packConfig.requiresVideo;
  const showMood = packConfig.requiresMood;
  const showIntensity = pack !== 'voice_only';
  const showVoiceFields = packConfig.includesVoice;
  const showVoiceGender = showVoiceFields && !voiceSample;
  const showMusicToggle = packConfig.supportsMusicToggle;
  const showExportToggle = packConfig.supportsAudioExport;
  const showManualDuration = pack === 'music_only' && !sourceVideo?.url;
  const currentOutputKind: AudioOutputKind = packConfig.audioOnly ? 'audio' : exportAudioFile ? 'both' : 'video';
  const modeOptions = useMemo(() => buildAudioModeOptions(copy), [copy]);
  const intensityOptions = useMemo(
    () =>
      AUDIO_INTENSITY_VALUES.map((value) => ({
        value,
        label: copy.controls.intensities[value],
      })),
    [copy]
  );
  const moodOptions = useMemo(
    () =>
      AUDIO_MOOD_VALUES.map((value) => ({
        value,
        label: copy.controls.moods[value],
      })),
    [copy]
  );
  const voiceGenderOptions = useMemo(
    () =>
      AUDIO_VOICE_GENDER_VALUES.map((value) => ({
        value,
        label: copy.controls.voiceGenders[value],
      })),
    [copy]
  );
  const voiceProfileOptions = useMemo(
    () =>
      AUDIO_VOICE_PROFILE_VALUES.map((value) => ({
        value,
        label: copy.controls.voiceProfiles[value],
      })),
    [copy]
  );
  const voiceDeliveryOptions = useMemo(
    () =>
      AUDIO_VOICE_DELIVERY_VALUES.map((value) => ({
        value,
        label: copy.controls.voiceDeliveries[value],
      })),
    [copy]
  );
  const languageOptions = useMemo(
    () =>
      AUDIO_LANGUAGE_VALUES.map((value) => ({
        value,
        label: copy.controls.languages[value],
      })),
    [copy]
  );
  const durationOptions = useMemo(() => {
    const values = [...AUDIO_MUSIC_DURATION_OPTIONS_SEC] as number[];
    if (!values.includes(manualDurationSec)) {
      values.push(manualDurationSec);
      values.sort((a, b) => a - b);
    }
    return values.map((value) => ({
      value,
      label: formatAudioDurationLabel(value),
    }));
  }, [manualDurationSec]);

  const handlePackChange = useCallback((nextPack: AudioPackId) => {
    manualWorkspaceOverrideRef.current = true;
    const nextConfig = getAudioPackConfig(nextPack);
    setPack(nextPack);
    setMusicEnabled(nextConfig.supportsMusicToggle ? nextConfig.defaultMusicEnabled : false);
    setExportAudioFile(false);
    if (!nextConfig.includesVoice) {
      setVoiceSample(null);
    }
  }, []);

  const hydrateSourceVideo = useCallback(async (input: {
    sourceJobId?: string | null;
    sourceVideoUrl?: string | null;
    fallbackAspectRatio?: string | null;
  }) => {
    const sourceJobId = input.sourceJobId?.trim() || null;
    if (sourceJobId) {
      try {
        const sourceJob = await fetchJobDetail(sourceJobId);
        if (sourceJob.videoUrl) {
          setSourceVideo({
            url: sourceJob.videoUrl,
            jobId: sourceJob.jobId,
            thumbUrl: sourceJob.thumbUrl ?? null,
            durationSec: typeof sourceJob.durationSec === 'number' ? sourceJob.durationSec : null,
            aspectRatio: sourceJob.aspectRatio ?? input.fallbackAspectRatio ?? null,
            label: sourceJob.engineLabel
              ? formatCopy(copy.source.sourceLabel, { label: sourceJob.engineLabel })
              : formatCopy(copy.source.jobLabel, { id: sourceJob.jobId }),
          });
          return;
        }
      } catch {
        // Fall back to the raw URL below.
      }
    }

    const sourceVideoUrl = input.sourceVideoUrl?.trim() || null;
    if (!sourceVideoUrl) {
      setSourceVideo(null);
      return;
    }
    const durationSec = await probeVideoDuration(sourceVideoUrl);
    setSourceVideo({
      url: sourceVideoUrl,
      jobId: sourceJobId,
      thumbUrl: null,
      durationSec,
      aspectRatio: input.fallbackAspectRatio ?? null,
      label: sourceJobId
        ? formatCopy(copy.source.jobLabel, { id: sourceJobId })
        : copy.source.restoredLabel,
    });
  }, [copy]);

  const restoreAudioJob = useCallback(
    async (jobId: string) => {
      const detail = await fetchJobDetail(jobId);
      if (manualWorkspaceOverrideRef.current) {
        return;
      }
      const nextPack = coerceAudioPackId(detail.settingsSnapshot?.pack) ?? DEFAULT_PACK;
      const nextMood = coerceAudioMood(detail.settingsSnapshot?.mood) ?? DEFAULT_MOOD;
      const nextIntensity = coerceAudioIntensity(detail.settingsSnapshot?.intensity) ?? DEFAULT_INTENSITY;
      const nextMusicEnabled =
        typeof detail.settingsSnapshot?.musicEnabled === 'boolean'
          ? detail.settingsSnapshot.musicEnabled
          : getAudioPackConfig(nextPack).supportsMusicToggle
            ? getAudioPackConfig(nextPack).defaultMusicEnabled
            : false;
      const nextExportAudioFile =
        typeof detail.settingsSnapshot?.exportAudioFile === 'boolean'
          ? detail.settingsSnapshot.exportAudioFile
          : false;
      const nextOutputKind = inferOutputKind({
        outputKind: detail.settingsSnapshot?.outputKind ?? null,
        videoUrl: detail.videoUrl ?? null,
        audioUrl: detail.audioUrl ?? null,
      });

      setPack(nextPack);
      setPrompt(detail.settingsSnapshot?.prompt ?? '');
      setMood(nextMood);
      setIntensity(nextIntensity);
      setScript(detail.settingsSnapshot?.script ?? '');
      setVoiceGender(coerceAudioVoiceGender(detail.settingsSnapshot?.voiceGender) ?? DEFAULT_VOICE_GENDER);
      setVoiceProfile(coerceAudioVoiceProfile(detail.settingsSnapshot?.voiceProfile) ?? DEFAULT_VOICE_PROFILE);
      setVoiceDelivery(coerceAudioVoiceDelivery(detail.settingsSnapshot?.voiceDelivery) ?? DEFAULT_VOICE_DELIVERY);
      setLanguage(coerceAudioLanguage(detail.settingsSnapshot?.language) ?? DEFAULT_LANGUAGE);
      setManualDurationSec(typeof detail.settingsSnapshot?.durationSec === 'number' ? detail.settingsSnapshot.durationSec : DEFAULT_MANUAL_DURATION_SEC);
      setMusicEnabled(nextMusicEnabled);
      setExportAudioFile(nextExportAudioFile);
      setVoiceSample(null);

      await hydrateSourceVideo({
        sourceJobId: detail.settingsSnapshot?.sourceJobId ?? null,
        sourceVideoUrl:
          detail.settingsSnapshot?.refs?.sourceVideoUrl ??
          detail.settingsSnapshot?.sourceVideoUrl ??
          null,
        fallbackAspectRatio: detail.aspectRatio ?? null,
      });

      const status =
        (detail.videoUrl || detail.audioUrl)
          ? 'completed'
          : detail.status ?? 'pending';
      const progress = typeof detail.progress === 'number' ? detail.progress : status === 'completed' ? 100 : 0;

      const normalizedJob: ActiveAudioJobState = {
        jobId: detail.jobId,
        status,
        progress,
        message: detail.message ?? null,
        videoUrl: detail.videoUrl ?? null,
        audioUrl: detail.audioUrl ?? null,
        thumbUrl: detail.thumbUrl ?? null,
        outputKind: nextOutputKind,
      };
      setActiveJob(normalizedJob);

      if (detail.videoUrl || detail.audioUrl) {
        setResult({
          jobId: detail.jobId,
          videoUrl: detail.videoUrl ?? null,
          audioUrl: detail.audioUrl ?? null,
          thumbUrl: detail.thumbUrl ?? null,
          outputKind: nextOutputKind,
        });
      } else {
        setResult(null);
      }
    },
    [hydrateSourceVideo]
  );

  useEffect(() => {
    if (!queryJobId || !user) return;
    if (restoredQueryJobRef.current === queryJobId) return;
    restoredQueryJobRef.current = queryJobId;
    let cancelled = false;
    setNotice(null);
    fetchJobDetail(queryJobId)
      .then(async (payload) => {
        if (cancelled) return;
        if (payload.surface === 'audio') {
          await restoreAudioJob(payload.jobId);
          return;
        }
        if (manualWorkspaceOverrideRef.current) {
          return;
        }
        if (!payload.videoUrl) {
          throw new Error(payload.error ?? copy.messages.loadSourceJob);
        }
        setActiveJob(null);
        setResult(null);
        setSourceVideo({
          url: payload.videoUrl,
          jobId: payload.jobId,
          thumbUrl: payload.thumbUrl ?? null,
          durationSec: typeof payload.durationSec === 'number' ? payload.durationSec : null,
          aspectRatio: payload.aspectRatio ?? null,
          label: payload.engineLabel
            ? formatCopy(copy.source.sourceLabel, { label: payload.engineLabel })
            : formatCopy(copy.source.jobLabel, { id: payload.jobId }),
        });
      })
      .catch((error) => {
        if (!cancelled) {
          restoredQueryJobRef.current = null;
          setNotice(resolveUiErrorMessage(error, copy.messages.loadSourceJob, ['Unable to load job.']));
        }
      })
    return () => {
      cancelled = true;
    };
  }, [copy, queryJobId, restoreAudioJob, user]);

  useEffect(() => {
    if (queryJobId || !user) return;
    if (latestRestoreAttemptedRef.current) return;
    latestRestoreAttemptedRef.current = true;
    let cancelled = false;
    authFetch('/api/jobs?surface=audio&limit=12')
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: string; jobs?: Job[] }
          | null;
        if (!response.ok || !payload?.ok || !Array.isArray(payload.jobs)) {
          throw new Error(payload?.error ?? copy.messages.loadLatestJob);
        }
        const latestJob =
          payload.jobs.find((job) => job.surface === 'audio' && Boolean(job.videoUrl || job.audioUrl)) ??
          null;
        if (!latestJob || cancelled) return;
        if (manualWorkspaceOverrideRef.current) return;
        await restoreAudioJob(latestJob.jobId);
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[audio] latest job restore failed', error);
        }
      })
    return () => {
      cancelled = true;
    };
  }, [copy, queryJobId, restoreAudioJob, user]);

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
    });
  }, [estimatedDurationSec, mood, musicEnabled, pack, script, showMood, showMusicToggle, showVoiceFields, voiceSample]);

  const canGenerate =
    Boolean(user) &&
    !isGenerating &&
    (!sourceVideoRequired || Boolean(sourceVideo?.url)) &&
    (pack !== 'music_only' || Boolean(sourceVideo?.url) || manualDurationSec >= 3) &&
    (!packConfig.requiresScript || script.trim().length > 0) &&
    ((packConfig.includesVoice && pack !== 'cinematic') || prompt.trim().length > 0);

  const handleSourceFileSelect = useCallback(async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    manualWorkspaceOverrideRef.current = true;
    setIsUploadingSource(true);
    setNotice(null);
    setResult(null);
    try {
      const uploaded = await uploadAsset(file, 'video');
      const durationSec = await probeVideoDuration(uploaded.url);
      setSourceVideo({
        url: uploaded.url,
        jobId: null,
        thumbUrl: null,
        durationSec,
        aspectRatio: null,
        label: uploaded.name,
      });
      if (!durationSec) {
        setNotice(copy.source.uploadDurationWarning);
      }
    } catch (error) {
      setNotice(resolveUiErrorMessage(error, copy.messages.sourceUploadFailed, ['Upload failed']));
    } finally {
      setIsUploadingSource(false);
      if (sourceInputRef.current) {
        sourceInputRef.current.value = '';
      }
    }
  }, [copy.messages.sourceUploadFailed, copy.source.uploadDurationWarning]);

  const handleVoiceFileSelect = useCallback(async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    manualWorkspaceOverrideRef.current = true;
    setIsUploadingVoice(true);
    setNotice(null);
    try {
      const uploaded = await uploadAsset(file, 'audio');
      setVoiceSample(uploaded);
    } catch (error) {
      setNotice(resolveUiErrorMessage(error, copy.messages.voiceUploadFailed, ['Upload failed']));
    } finally {
      setIsUploadingVoice(false);
      if (voiceInputRef.current) {
        voiceInputRef.current.value = '';
      }
    }
  }, [copy.messages.voiceUploadFailed]);

  const handleSelectGeneratedVideo = useCallback(async (video: GeneratedSourceVideo) => {
    manualWorkspaceOverrideRef.current = true;
    setNotice(null);
    const durationSec = video.durationSec ?? (await probeVideoDuration(video.url));
    setSourceVideo({
      url: video.url,
      jobId: video.jobId,
      thumbUrl: video.thumbUrl,
      durationSec,
      aspectRatio: video.aspectRatio,
      label: video.label,
    });
    setResult(null);
    if (!durationSec) {
      setNotice(copy.source.selectedDurationWarning);
    }
    setGeneratedPickerOpen(false);
  }, [copy.source.selectedDurationWarning]);

  const handleClearSourceVideo = useCallback(() => {
    manualWorkspaceOverrideRef.current = true;
    setSourceVideo(null);
    setResult(null);
    setNotice(null);
    if (sourceInputRef.current) {
      sourceInputRef.current.value = '';
    }
  }, []);

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
    musicEnabled,
    onGeneratedJobId: handleGeneratedJobId,
    pack,
    prompt,
    requiresScript: packConfig.requiresScript,
    script,
    setActiveJob,
    setIsGenerating,
    setNotice,
    setResult,
    showExportToggle,
    showIntensity,
    showMood,
    showMusicToggle,
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
    [pathname, router]
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
        ? formatCopy(copy.pricing.summary, {
            output: formatAudioOutputKind(copy, currentOutputKind),
            duration: estimatedDurationSec ? formatAudioDurationLabel(estimatedDurationSec) : '-',
          })
        : copy.pricing.missingOptions;
  const activeProgress =
    activeJob?.status === 'running' || activeJob?.status === 'pending'
      ? activeJob.progress
      : null;
  const dockDurationLabel = estimatedDurationSec ? formatAudioDurationLabel(estimatedDurationSec) : '-';
  const dockPriceLabel = quote ? formatCurrency(quote.totalCents, quote.currency, locale) : '-';

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
          estimatedDurationSec={estimatedDurationSec}
          exportAudioFile={exportAudioFile}
          generationHint={generationHint}
          handleGenerate={handleGenerate}
          handlePackChange={handlePackChange}
          handleSelectLatestJob={handleSelectLatestJob}
          intensity={intensity}
          intensityOptions={intensityOptions}
          isGenerating={isGenerating}
          isUploadingSource={isUploadingSource}
          isUploadingVoice={isUploadingVoice}
          language={language}
          languageOptions={languageOptions}
          manualDurationSec={manualDurationSec}
          modeOptions={modeOptions}
          mood={mood}
          moodOptions={moodOptions}
          musicEnabled={musicEnabled}
          notice={notice}
          onClearSourceVideo={handleClearSourceVideo}
          onOpenGeneratedPicker={() => setGeneratedPickerOpen(true)}
          onSourceFileSelect={handleSourceFileSelect}
          onVoiceFileSelect={handleVoiceFileSelect}
          pack={pack}
          resultJobId={result?.jobId ?? null}
          setExportAudioFile={setExportAudioFile}
          setIntensity={setIntensity}
          setLanguage={setLanguage}
          setManualDurationSec={setManualDurationSec}
          setMood={setMood}
          setMusicEnabled={setMusicEnabled}
          setPrompt={setPrompt}
          setScript={setScript}
          setVoiceDelivery={setVoiceDelivery}
          setVoiceGender={setVoiceGender}
          setVoiceProfile={setVoiceProfile}
          setVoiceSample={setVoiceSample}
          showExportToggle={showExportToggle}
          showIntensity={showIntensity}
          showManualDuration={showManualDuration}
          showMood={showMood}
          showMusicToggle={showMusicToggle}
          showVoiceFields={showVoiceFields}
          showVoiceGender={showVoiceGender}
          sourceInputRef={sourceInputRef}
          sourceVideo={sourceVideo}
          sourceVideoRequired={sourceVideoRequired}
          voiceDelivery={voiceDelivery}
          voiceDeliveryOptions={voiceDeliveryOptions}
          voiceGender={voiceGender}
          voiceGenderOptions={voiceGenderOptions}
          voiceInputRef={voiceInputRef}
          voiceProfile={voiceProfile}
          voiceProfileOptions={voiceProfileOptions}
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
