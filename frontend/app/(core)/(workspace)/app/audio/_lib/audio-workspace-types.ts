import type { AudioOutputKind } from '@/lib/audio-generation';

export type SourceVideoState = {
  url: string;
  jobId?: string | null;
  thumbUrl?: string | null;
  durationSec?: number | null;
  aspectRatio?: string | null;
  label: string;
};

export type GeneratedSourceVideo = {
  jobId: string;
  url: string;
  thumbUrl: string | null;
  durationSec: number | null;
  aspectRatio: string | null;
  label: string;
  createdAt: string;
  hasAudio: boolean;
};

export type AudioJobSettingsSnapshot = {
  pack?: string | null;
  prompt?: string | null;
  mood?: string | null;
  intensity?: string | null;
  musicModel?: string | null;
  musicBpm?: number | null;
  durationSec?: number | null;
  script?: string | null;
  musicEnabled?: boolean | null;
  exportAudioFile?: boolean | null;
  voiceGender?: string | null;
  voiceProfile?: string | null;
  voiceDelivery?: string | null;
  language?: string | null;
  seedAudioVoice?: string | null;
  seedAudioOutputFormat?: string | null;
  seedAudioSampleRate?: number | null;
  seedAudioSpeed?: number | null;
  seedAudioVolume?: number | null;
  seedAudioPitch?: number | null;
  outputKind?: AudioOutputKind | null;
  sourceJobId?: string | null;
  sourceVideoUrl?: string | null;
  refs?: {
    sourceVideoUrl?: string | null;
    voiceSampleUrl?: string | null;
  } | null;
};

export type AudioJobDetail = {
  ok?: boolean;
  error?: string;
  jobId: string;
  surface?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | null;
  progress?: number | null;
  message?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  thumbUrl?: string | null;
  aspectRatio?: string | null;
  engineLabel?: string | null;
  durationSec?: number | null;
  settingsSnapshot?: AudioJobSettingsSnapshot | null;
};

export type ActiveAudioJobState = {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  thumbUrl: string | null;
  outputKind: AudioOutputKind;
};

export type AudioResultState = {
  jobId: string;
  videoUrl: string | null;
  audioUrl: string | null;
  thumbUrl: string | null;
  outputKind: AudioOutputKind;
};

export type PendingAudioGeneration = {
  id: string;
  label: string;
  startedAt: number;
};
