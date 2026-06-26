export { AudioProviderError } from './providers/error';
export { runAudioRoleWithFallback } from './providers/fal-runner';
export {
  generateGoogleVertexLyria3Track,
  GOOGLE_VERTEX_LYRIA3_PROVIDER_KEY,
  isGoogleVertexLyria3Configured,
  isGoogleVertexLyria3DurationSupported,
  selectGoogleVertexLyria3Model,
} from './providers/google-vertex-lyria';
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
