'use client';

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useAudioCreationQuote } from './useAudioCreationQuote';
import { runAudioGenerate } from '@/lib/api';
import type {
  AudioIntensity,
  AudioLanguage,
  AudioLyria3Bpm,
  AudioLyria3Model,
  AudioMood,
  AudioPackId,
  AudioSeedAudioOutputFormat,
  AudioSeedAudioSampleRate,
  AudioSeedAudioVoice,
  AudioVoiceDelivery,
  AudioVoiceGender,
  AudioVoiceProfile,
} from '@/lib/audio-generation';
import { resolveUiErrorMessage } from '../_lib/audio-workspace-helpers';
import type {
  ActiveAudioJobState,
  AudioResultState,
  PendingAudioGeneration,
  SourceVideoState,
} from '../_lib/audio-workspace-types';
import type { AudioWorkspaceCopy } from '../copy';

interface UseAudioGenerationRunnerParams {
  canGenerate: boolean;
  userId: string | null;
  copy: AudioWorkspaceCopy;
  exportAudioFile: boolean;
  intensity: AudioIntensity;
  language: AudioLanguage;
  locale: string;
  manualDurationSec: number;
  mood: AudioMood;
  musicBpm: AudioLyria3Bpm;
  musicEnabled: boolean;
  musicModel: AudioLyria3Model;
  onGeneratedJobId: (jobId: string) => void;
  pack: AudioPackId;
  prompt: string;
  requiresScript: boolean;
  script: string;
  seedAudioOutputFormat: AudioSeedAudioOutputFormat;
  seedAudioPitch: number;
  seedAudioSampleRate: AudioSeedAudioSampleRate;
  seedAudioSpeed: number;
  seedAudioVoice: AudioSeedAudioVoice;
  seedAudioVolume: number;
  setActiveJob: Dispatch<SetStateAction<ActiveAudioJobState | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setPendingAudioGenerations: Dispatch<SetStateAction<PendingAudioGeneration[]>>;
  setResult: Dispatch<SetStateAction<AudioResultState | null>>;
  showExportToggle: boolean;
  showIntensity: boolean;
  showMood: boolean;
  showMusicBpm: boolean;
  showMusicModel: boolean;
  showMusicToggle: boolean;
  showSeedAudioVoice: boolean;
  showVoiceFields: boolean;
  sourceVideo: SourceVideoState | null;
  voiceDelivery: AudioVoiceDelivery;
  voiceGender: AudioVoiceGender;
  voiceProfile: AudioVoiceProfile;
  voiceSample: { url: string; name: string } | null;
}

export function useAudioGenerationRunner({
  canGenerate,
  userId,
  copy,
  exportAudioFile,
  intensity,
  language,
  locale,
  manualDurationSec,
  mood,
  musicBpm,
  musicEnabled,
  musicModel,
  onGeneratedJobId,
  pack,
  prompt,
  requiresScript,
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
}: UseAudioGenerationRunnerParams) {
  const request = {
        sourceVideoUrl: sourceVideo?.url ?? undefined,
        sourceJobId: sourceVideo?.jobId ?? undefined,
        pack,
        prompt: !showVoiceFields ? prompt.trim() : undefined,
        mood: showMood ? mood : undefined,
        intensity: showIntensity ? intensity : undefined,
        musicModel: showMusicModel ? musicModel : undefined,
        musicBpm: showMusicBpm ? musicBpm : undefined,
        script: requiresScript ? script.trim() : undefined,
        voiceSampleUrl: showVoiceFields ? voiceSample?.url : undefined,
        voiceGender: showVoiceFields ? voiceGender : undefined,
        voiceProfile: showVoiceFields ? voiceProfile : undefined,
        voiceDelivery: showVoiceFields ? voiceDelivery : undefined,
        language: showVoiceFields ? language : undefined,
        seedAudioVoice: showSeedAudioVoice ? seedAudioVoice : undefined,
        seedAudioOutputFormat: showVoiceFields ? seedAudioOutputFormat : undefined,
        seedAudioSampleRate: showVoiceFields ? seedAudioSampleRate : undefined,
        seedAudioSpeed: showVoiceFields ? seedAudioSpeed : undefined,
        seedAudioVolume: showVoiceFields ? seedAudioVolume : undefined,
        seedAudioPitch: showVoiceFields ? seedAudioPitch : undefined,
        durationSec: pack === 'music_only' && !sourceVideo?.url ? manualDurationSec : undefined,
        musicEnabled: showMusicToggle ? musicEnabled : undefined,
        exportAudioFile: showExportToggle ? exportAudioFile : undefined,
        locale,
  };
  const owner = useRef(userId); owner.current = userId;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const { quote } = useAudioCreationQuote(request, userId, canGenerate);
  const inFlight = useRef(new Set<string>());
  const generate = async () => {
    if (!canGenerate || !quote || quote.expiresAt <= Date.now() || inFlight.current.has(quote.inputKey)) return;
    inFlight.current.add(quote.inputKey);
    const startedAt = Date.now();
    const pendingId = `aud_pending_${crypto.randomUUID()}`;
    setPendingAudioGenerations((previous) => [
      {
        id: pendingId,
        label: (copy.modes as Partial<Record<AudioPackId, { label: string }>>)[pack]?.label ?? pack,
        startedAt: Date.now(),
      },
      ...previous,
    ]);
    setNotice(null);
    try {
      const response = await runAudioGenerate({ ...request, expectedQuote: {
        inputKey: quote.inputKey, totalCents: quote.pricing.totalCents,
        currency: quote.pricing.currency, expiresAt: quote.expiresAt,
      } });
      if (!alive.current || owner.current !== userId) return;
      const nextResult: AudioResultState = {
        jobId: response.jobId,
        videoUrl: response.videoUrl,
        audioUrl: response.audioUrl ?? null,
        thumbUrl: response.thumbUrl,
        outputKind: response.outputKind,
      };
      setResult(nextResult);
      setActiveJob({
        startedAt,
        observation: { stage: response.status === 'pending' ? 'pending' : response.status },
        jobId: response.jobId,
        status: response.status,
        progress: response.progress,
        message: copy.messages.processing.complete,
        videoUrl: response.videoUrl,
        audioUrl: response.audioUrl ?? null,
        thumbUrl: response.thumbUrl,
        outputKind: response.outputKind,
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('jobs:status', {
            detail: {
              ok: true,
              jobId: response.jobId,
              status: response.status,
              progress: response.progress,
              videoUrl: response.videoUrl,
              audioUrl: response.audioUrl ?? null,
              thumbUrl: response.thumbUrl,
              pricing: response.pricing,
              finalPriceCents: response.pricing.totalCents,
              currency: response.pricing.currency,
              paymentStatus: response.paymentStatus,
              message: copy.messages.processing.complete,
            },
          })
        );
      }
      onGeneratedJobId(response.jobId);
      setNotice(copy.messages.renderComplete);
    } catch (error) {
      if (alive.current && owner.current === userId) setNotice(resolveUiErrorMessage(error, copy.messages.generationFailed));
    } finally {
      inFlight.current.delete(quote.inputKey);
      if (alive.current && owner.current === userId) setPendingAudioGenerations((previous) => previous.filter((entry) => entry.id !== pendingId));
    }
  };
  return { generate, quote, canSubmit: canGenerate && Boolean(quote) };
}
