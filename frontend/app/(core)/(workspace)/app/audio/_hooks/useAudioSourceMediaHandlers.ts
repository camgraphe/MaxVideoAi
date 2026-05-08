import { useCallback, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';

import type { AudioWorkspaceCopy } from '../copy';
import {
  probeVideoDuration,
  resolveUiErrorMessage,
  uploadAsset,
} from '../_lib/audio-workspace-helpers';
import type {
  AudioResultState,
  GeneratedSourceVideo,
  SourceVideoState,
} from '../_lib/audio-workspace-types';

type UseAudioSourceMediaHandlersArgs = {
  copy: AudioWorkspaceCopy;
  manualWorkspaceOverrideRef: MutableRefObject<boolean>;
  sourceInputRef: RefObject<HTMLInputElement | null>;
  voiceInputRef: RefObject<HTMLInputElement | null>;
  setGeneratedPickerOpen: Dispatch<SetStateAction<boolean>>;
  setIsUploadingSource: Dispatch<SetStateAction<boolean>>;
  setIsUploadingVoice: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setResult: Dispatch<SetStateAction<AudioResultState | null>>;
  setSourceVideo: Dispatch<SetStateAction<SourceVideoState | null>>;
  setVoiceSample: Dispatch<SetStateAction<{ url: string; name: string } | null>>;
};

export function useAudioSourceMediaHandlers({
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
}: UseAudioSourceMediaHandlersArgs) {
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
  }, [
    copy.messages.sourceUploadFailed,
    copy.source.uploadDurationWarning,
    manualWorkspaceOverrideRef,
    setIsUploadingSource,
    setNotice,
    setResult,
    setSourceVideo,
    sourceInputRef,
  ]);

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
  }, [
    copy.messages.voiceUploadFailed,
    manualWorkspaceOverrideRef,
    setIsUploadingVoice,
    setNotice,
    setVoiceSample,
    voiceInputRef,
  ]);

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
  }, [
    copy.source.selectedDurationWarning,
    manualWorkspaceOverrideRef,
    setGeneratedPickerOpen,
    setNotice,
    setResult,
    setSourceVideo,
  ]);

  const handleClearSourceVideo = useCallback(() => {
    manualWorkspaceOverrideRef.current = true;
    setSourceVideo(null);
    setResult(null);
    setNotice(null);
    if (sourceInputRef.current) {
      sourceInputRef.current.value = '';
    }
  }, [manualWorkspaceOverrideRef, setNotice, setResult, setSourceVideo, sourceInputRef]);

  return {
    handleClearSourceVideo,
    handleSelectGeneratedVideo,
    handleSourceFileSelect,
    handleVoiceFileSelect,
  };
}
