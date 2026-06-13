'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { runAudioGenerate } from '@/lib/api';
import type {
  AudioIntensity,
  AudioLanguage,
  AudioMood,
  AudioPackId,
  AudioVoiceDelivery,
  AudioVoiceGender,
  AudioVoiceProfile,
} from '@/lib/audio-generation';
import { resolveUiErrorMessage } from '../_lib/audio-workspace-helpers';
import type {
  ActiveAudioJobState,
  AudioResultState,
  SourceVideoState,
} from '../_lib/audio-workspace-types';
import type { AudioWorkspaceCopy } from '../copy';

interface UseAudioGenerationRunnerParams {
  canGenerate: boolean;
  copy: AudioWorkspaceCopy;
  exportAudioFile: boolean;
  intensity: AudioIntensity;
  language: AudioLanguage;
  locale: string;
  manualDurationSec: number;
  mood: AudioMood;
  musicEnabled: boolean;
  onGeneratedJobId: (jobId: string) => void;
  pack: AudioPackId;
  prompt: string;
  requiresScript: boolean;
  script: string;
  setActiveJob: Dispatch<SetStateAction<ActiveAudioJobState | null>>;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setResult: Dispatch<SetStateAction<AudioResultState | null>>;
  showExportToggle: boolean;
  showIntensity: boolean;
  showMood: boolean;
  showMusicToggle: boolean;
  showVoiceFields: boolean;
  sourceVideo: SourceVideoState | null;
  voiceDelivery: AudioVoiceDelivery;
  voiceGender: AudioVoiceGender;
  voiceProfile: AudioVoiceProfile;
  voiceSample: { url: string; name: string } | null;
}

export function useAudioGenerationRunner({
  canGenerate,
  copy,
  exportAudioFile,
  intensity,
  language,
  locale,
  manualDurationSec,
  mood,
  musicEnabled,
  onGeneratedJobId,
  pack,
  prompt,
  requiresScript,
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
}: UseAudioGenerationRunnerParams) {
  return useCallback(async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setNotice(null);
    try {
      const response = await runAudioGenerate({
        sourceVideoUrl: sourceVideo?.url ?? undefined,
        sourceJobId: sourceVideo?.jobId ?? undefined,
        pack,
        prompt: !showVoiceFields ? prompt.trim() : undefined,
        mood: showMood ? mood : undefined,
        intensity: showIntensity ? intensity : undefined,
        script: requiresScript ? script.trim() : undefined,
        voiceSampleUrl: showVoiceFields ? voiceSample?.url : undefined,
        voiceGender: showVoiceFields ? voiceGender : undefined,
        voiceProfile: showVoiceFields ? voiceProfile : undefined,
        voiceDelivery: showVoiceFields ? voiceDelivery : undefined,
        language: showVoiceFields ? language : undefined,
        durationSec: (pack === 'music_only' || pack === 'sfx_only') && !sourceVideo?.url ? manualDurationSec : undefined,
        musicEnabled: showMusicToggle ? musicEnabled : undefined,
        exportAudioFile: showExportToggle ? exportAudioFile : undefined,
        locale,
      });
      const nextResult: AudioResultState = {
        jobId: response.jobId,
        videoUrl: response.videoUrl,
        audioUrl: response.audioUrl ?? null,
        thumbUrl: response.thumbUrl,
        outputKind: response.outputKind,
      };
      setResult(nextResult);
      setActiveJob({
        jobId: response.jobId,
        status: response.status,
        progress: response.progress,
        message: copy.messages.processing.complete,
        videoUrl: response.videoUrl,
        audioUrl: response.audioUrl ?? null,
        thumbUrl: response.thumbUrl,
        outputKind: response.outputKind,
      });
      onGeneratedJobId(response.jobId);
      setNotice(copy.messages.renderComplete);
    } catch (error) {
      setNotice(resolveUiErrorMessage(error, copy.messages.generationFailed));
    } finally {
      setIsGenerating(false);
    }
  }, [
    canGenerate,
    copy.messages.generationFailed,
    copy.messages.processing.complete,
    copy.messages.renderComplete,
    exportAudioFile,
    intensity,
    language,
    locale,
    manualDurationSec,
    mood,
    musicEnabled,
    onGeneratedJobId,
    pack,
    prompt,
    requiresScript,
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
    sourceVideo?.jobId,
    sourceVideo?.url,
    voiceDelivery,
    voiceGender,
    voiceProfile,
    voiceSample?.url,
  ]);
}
