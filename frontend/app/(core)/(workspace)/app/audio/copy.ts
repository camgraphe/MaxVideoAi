import type {
  AudioLanguage,
  AudioMood,
  AudioOutputKind,
  AudioPackId,
  AudioVoiceDelivery,
  AudioVoiceGender,
  AudioVoiceProfile,
} from '@/lib/audio-generation';

export const DEFAULT_AUDIO_WORKSPACE_COPY = {
  auth: {
    eyebrow: 'Generate Audio',
    title: 'Create an account to generate audio',
    body: 'Build cinematic soundtracks, background music tracks, or premium voice overs inside the MaxVideoAI workspace.',
    createAccount: 'Create account',
    signIn: 'Sign in',
  },
  hero: {
    eyebrow: 'Generate Audio',
    title: 'Audio workspace',
  },
  modes: {
    music_only: {
      label: 'Music Only',
      description: 'Background music or ambience.',
    },
    voice_only: {
      label: 'Voice Over Only',
      description: 'Narration only.',
    },
    cinematic: {
      label: 'Cinematic',
      description: 'SFX + optional background music.',
    },
    cinematic_voice: {
      label: 'Cinematic + Voice',
      description: 'SFX + background music + VO.',
    },
  },
  preview: {
    eyebrow: 'Preview',
    title: 'Latest output',
    audioReady: 'Audio render ready',
    emptyTitle: 'Ready for audio',
    emptyBody: 'Pick a mode and render.',
    processingLabel: 'Processing',
    loadingMessage: 'Loading audio render…',
    processingMessage: 'Processing audio render…',
    openVideoFile: 'Open video file',
    openAudioFile: 'Open audio file',
    outputKinds: {
      audio: 'Audio output',
      both: 'Video + audio',
      video: 'Video output',
    },
  },
  source: {
    title: 'Source video',
    required: 'Needed for cinematic modes.',
    optional: 'Optional for music or voice-only.',
    upload: 'Upload video',
    uploading: 'Uploading…',
    useGenerated: 'Use generated',
    clear: 'Clear',
    durationPending: 'Duration pending',
    restoredLabel: 'Restored source video',
    jobLabel: 'Job {id}',
    sourceLabel: '{label} source',
    uploadDurationWarning: 'The source video uploaded, but its duration could not be read in the browser.',
    selectedDurationWarning: 'The selected video loaded, but its duration could not be confirmed in the browser.',
  },
  controls: {
    eyebrow: 'Controls',
    title: 'Audio setup',
    mood: 'Mood',
    intensity: 'Intensity',
    duration: 'Duration',
    script: 'Script',
    scriptVoiceOnlyPlaceholder: 'Write the voice over you want to render.',
    scriptCinematicPlaceholder: 'Write the narration or dialogue that should sit on top of the cinematic audio mix.',
    estimatedDuration: '~{seconds}s estimated',
    voiceSample: 'Voice sample',
    uploadSample: 'Upload sample',
    cloneEnabled: 'Voice clone enabled',
    defaultVoice: 'Default voice',
    voiceType: 'Voice type',
    voice: 'Voice',
    delivery: 'Delivery',
    language: 'Language',
    moods: {
      epic: 'Epic',
      tense: 'Tense',
      intimate: 'Intimate',
      dark: 'Dark',
      dreamy: 'Dreamy',
      'sci-fi': 'Sci-Fi',
      documentary: 'Documentary',
    } satisfies Record<AudioMood, string>,
    intensities: {
      subtle: 'Subtle',
      standard: 'Standard',
      intense: 'Intense',
    },
    voiceGenders: {
      female: 'Female',
      male: 'Male',
      neutral: 'Neutral',
    } satisfies Record<AudioVoiceGender, string>,
    voiceProfiles: {
      balanced: 'Balanced',
      warm: 'Warm',
      bright: 'Bright',
      deep: 'Deep',
    } satisfies Record<AudioVoiceProfile, string>,
    voiceDeliveries: {
      natural: 'Natural',
      cinematic: 'Cinematic',
      trailer: 'Trailer',
      intimate: 'Intimate',
    } satisfies Record<AudioVoiceDelivery, string>,
    languages: {
      auto: 'Auto',
      english: 'EN',
      french: 'FR',
      spanish: 'ES',
      german: 'DE',
    } satisfies Record<AudioLanguage, string>,
    musicToggle: {
      label: 'Music',
      description: 'Background music on. Turn it off for SFX-only or SFX + voice.',
    },
    exportToggle: {
      label: 'Export audio file',
      description: 'Save a separate audio file too.',
    },
  },
  pricing: {
    eyebrow: 'Pricing',
    missingInputs: 'Add required inputs',
    missingSourceVideo: 'Add a source video.',
    missingOptions: 'Set the required options.',
    summary: '{output} • {duration}',
    generate: 'Generate audio',
    generating: 'Generating…',
    thisRender: 'This render: {amount}',
  },
  picker: {
    title: 'Choose generated video',
    description: 'Use one of your existing video renders as the source.',
    close: 'Close',
    empty: 'No generated videos found yet.',
    audioBadge: 'Audio',
  },
  rail: {
    eyebrow: 'Latest renders',
    title: 'Audio history',
    viewAll: 'View all',
    loadFailed: 'Failed to load latest renders.',
    retry: 'Retry',
    empty: 'No audio renders yet.',
    loadMore: 'Load more',
    loading: 'Loading…',
    open: 'Open',
    file: 'File',
    outputs: {
      videoAndAudio: 'Video + audio',
      video: 'Video render',
      audio: 'Audio file',
      pending: 'Pending render',
    },
    statuses: {
      pending: 'Pending',
      running: 'Processing',
      completed: 'Completed',
      failed: 'Failed',
    },
  },
  messages: {
    loadGeneratedVideos: 'Unable to load generated videos.',
    loadSourceJob: 'Unable to load source job.',
    loadLatestJob: 'Unable to load latest audio job.',
    sourceUploadFailed: 'Source upload failed.',
    voiceUploadFailed: 'Voice sample upload failed.',
    renderComplete: 'Audio render complete.',
    generationFailed: 'Audio generation failed.',
    processing: {
      soundDesign: 'Generating cinematic sound design…',
      musicTrack: 'Generating music track…',
      musicBed: 'Generating music bed…',
      clonedVoice: 'Generating cloned voice over…',
      voice: 'Generating voice over…',
      masterAudio: 'Mastering audio file…',
      finalMix: 'Mixing final soundtrack…',
      uploadAudioRender: 'Uploading audio render…',
      uploadAudioExport: 'Uploading audio export…',
      uploadFinalRender: 'Uploading final render…',
      complete: 'Audio render complete.',
    },
  },
} as const;

export type AudioWorkspaceCopy = typeof DEFAULT_AUDIO_WORKSPACE_COPY;

export function formatAudioOutputKind(copy: AudioWorkspaceCopy, outputKind: AudioOutputKind): string {
  return copy.preview.outputKinds[outputKind] ?? copy.preview.outputKinds.video;
}

export function translateAudioProcessingMessage(copy: AudioWorkspaceCopy, message: string | null): string | null {
  if (!message) return null;
  switch (message) {
    case 'Generating cinematic sound design…':
      return copy.messages.processing.soundDesign;
    case 'Generating music track…':
      return copy.messages.processing.musicTrack;
    case 'Generating music bed…':
      return copy.messages.processing.musicBed;
    case 'Generating cloned voice over…':
      return copy.messages.processing.clonedVoice;
    case 'Generating voice over…':
      return copy.messages.processing.voice;
    case 'Mastering audio file…':
      return copy.messages.processing.masterAudio;
    case 'Mixing final soundtrack…':
      return copy.messages.processing.finalMix;
    case 'Uploading audio render…':
      return copy.messages.processing.uploadAudioRender;
    case 'Uploading audio export…':
      return copy.messages.processing.uploadAudioExport;
    case 'Uploading final render…':
      return copy.messages.processing.uploadFinalRender;
    case 'Audio render complete.':
      return copy.messages.processing.complete;
    default:
      return message;
  }
}

export function buildAudioModeOptions(copy: AudioWorkspaceCopy): Array<{
  id: AudioPackId;
  label: string;
  description: string;
}> {
  return (['music_only', 'voice_only', 'cinematic', 'cinematic_voice'] as const).map((id) => ({
    id,
    label: copy.modes[id].label,
    description: copy.modes[id].description,
  }));
}

export function formatAudioPackLabel(copy: AudioWorkspaceCopy, pack: string | null | undefined): string | null {
  switch (pack) {
    case 'music_only':
    case 'voice_only':
    case 'cinematic':
    case 'cinematic_voice':
      return copy.modes[pack].label;
    case 'Cinematic Audio':
      return copy.modes.cinematic.label;
    case 'Cinematic + Voice':
      return copy.modes.cinematic_voice.label;
    case 'Music Only':
      return copy.modes.music_only.label;
    case 'Voice Over Only':
      return copy.modes.voice_only.label;
    default:
      return null;
  }
}
