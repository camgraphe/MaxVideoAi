export { AudioProviderError } from './providers/error';
export { runAudioRoleWithFallback } from './providers/fal-runner';
export { generateMusicTrack } from './providers/music';
export { getAudioProviderRoster } from './providers/roster';
export { generateSoundDesignTrack } from './providers/sound-design';
export { generateClonedVoiceTrack, generateStandardVoiceTrack } from './providers/voice-tracks';
export type {
  AudioPipelineRole,
  AudioProviderAttemptFailure,
  AudioProviderCandidate,
  AudioProviderResult,
  AudioProviderSubscribe,
} from './providers/types';
