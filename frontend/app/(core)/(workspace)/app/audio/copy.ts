import type {
  AudioLanguage,
  AudioLyria3Bpm,
  AudioLyria3Model,
  AudioMood,
  AudioOutputKind,
  AudioPackId,
  AudioSeedAudioOutputFormat,
  AudioSeedAudioVoice,
  AudioVoiceDelivery,
  AudioVoiceGender,
  AudioVoiceProfile,
} from '@/lib/audio-generation';

export const DEFAULT_AUDIO_WORKSPACE_COPY = {
  auth: {
    eyebrow: 'Generate Audio',
    title: 'Create an account to generate audio',
    body: 'Build music tracks, cinematic sound design, and Seed Audio voice overs inside the MaxVideoAI workspace.',
    createAccount: 'Create account',
    signIn: 'Sign in',
  },
  hero: {
    eyebrow: 'Generate Audio',
    title: 'Create Audio',
    body: 'Generate music with Google Lyria 3, cinematic sound design, or realistic voice over with Seed Audio 1.0.',
    history: 'History',
  },
  modes: {
    music_only: {
      label: 'Music Only',
      description: 'Background music or ambience.',
    },
    voice_only: {
      label: 'Voice Over',
      description: 'Seed Audio narration as an audio file.',
    },
    sfx_only: {
      label: 'SFX Only',
      description: 'Sound effects or ambience.',
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
    configureStep: 'Configure',
    customizeStep: 'Customize',
    generateStep: 'Generate',
    chooseType: 'Choose the type of audio you want to create',
    mood: 'Style preset',
    intensity: 'Intensity',
    musicModel: 'Lyria model',
    musicBpm: 'Tempo',
    duration: 'Duration',
    prompt: 'Audio Prompt',
    promptMusicPlaceholder: 'Describe the music: genre, pace, emotion, instruments, where it should sit in the edit.',
    promptCinematicPlaceholder: 'Describe the sound design you want: environment, impacts, transitions, texture, and what must stay subtle.',
    script: 'Narration Script',
    scriptVoiceOnlyPlaceholder: 'Write the voice over you want Seed Audio to render.',
    scriptCinematicPlaceholder: 'Write the narration or dialogue that should sit on top of the cinematic audio mix.',
    estimatedDuration: '~{seconds}s estimated',
    voiceSample: 'Voice sample',
    uploadVoiceSample: 'Upload voice sample',
    uploadVoiceSampleHint: '.wav, .mp3, .pcm, or .ogg up to 10MB',
    uploadSample: 'Upload sample',
    cloneEnabled: 'Voice clone enabled',
    defaultVoice: 'Default voice',
    voiceType: 'Voice type',
    voice: 'Voice',
    delivery: 'Delivery',
    language: 'Language',
    seedAudioVoice: 'Seed Audio voice',
    seedAudioOutputFormat: 'Format',
    seedAudioSampleRate: 'Sample rate',
    seedAudioSpeed: 'Speed',
    seedAudioVolume: 'Volume',
    seedAudioPitch: 'Pitch',
    seedAudioSampleTitle: 'Voice sample',
    seedAudioSamplePending: 'Sample audio pending',
    seedAudioVoices: {
      default: 'Default',
      vivi_mixed_en_zh_ja_es_id: 'Vivi',
      mindy_en_es_id_pt_zh: 'Mindy',
      kian_en_zh: 'Kian',
      cedric_en_zh: 'Cedric',
      sophie_en_zh: 'Sophie',
      jean_en_zh: 'Jean',
      magnus_en_zh: 'Magnus',
      mabel_en_zh: 'Mabel',
      nadia_en_zh: 'Nadia',
      opal_en_zh: 'Opal',
      pearl_en_zh: 'Pearl',
      quentin_en_zh: 'Quentin',
      corinne_mixed_en_zh: 'Corinne',
      esther_mixed_en_zh: 'Esther',
      lyla_mixed_en_zh: 'Lyla',
      tracy_es_zh: 'Tracy',
      sandy_es_mixed_en_zh: 'Sandy',
      felix_zh: 'Felix',
      celeste_zh: 'Celeste',
      monkey_king_zh: 'Monkey King',
    } satisfies Record<AudioSeedAudioVoice, string>,
    seedAudioOutputFormats: {
      mp3: 'MP3',
      wav: 'WAV',
      pcm: 'PCM',
      ogg_opus: 'OGG Opus',
    } satisfies Record<AudioSeedAudioOutputFormat, string>,
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
    musicModels: {
      clip: 'Lyria 3 Clip · fixed 30s',
      pro: 'Lyria 3 Pro · duration control',
    } satisfies Record<AudioLyria3Model, string>,
    musicBpmValues: {
      70: '70 BPM · slow',
      90: '90 BPM · relaxed',
      110: '110 BPM · medium',
      130: '130 BPM · driving',
      150: '150 BPM · fast',
    } satisfies Record<AudioLyria3Bpm, string>,
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
    advanced: {
      title: 'Advanced Options',
      description: 'Fine-tune your audio generation settings',
    },
    selectedVoice: 'Seed Audio preset voice',
    chooseVoice: 'Preset voice',
    providerStack: 'Model stack',
    providerStackDescription: '{provider} prepares the base track, then MaxVideoAI masters the final render for your selected output.',
    providers: {
      voice: 'Seed Audio 1.0',
      music: 'Google Lyria 3',
      sfx: 'Mirelo SFX + MMAudio',
      mix: 'FFmpeg mastering',
    },
  },
  pricing: {
    eyebrow: 'Est. Price',
    durationEyebrow: 'Est. Duration',
    missingInputs: 'Add required inputs',
    missingPrompt: 'Add an audio prompt.',
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
    eyebrow: 'History',
    title: 'History',
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
    generatingInProgress: 'Generating in progress ({count})…',
    processing: {
      soundDesign: 'Generating cinematic sound design…',
      musicTrack: 'Generating music track…',
      musicBed: 'Generating music bed…',
      clonedVoice: 'Generating reference voice over…',
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
    case 'Generating sound effects…':
      return copy.messages.processing.soundDesign;
    case 'Generating music track…':
      return copy.messages.processing.musicTrack;
    case 'Generating music bed…':
      return copy.messages.processing.musicBed;
    case 'Generating cloned voice over…':
    case 'Generating reference voice over…':
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
  return (['music_only', 'voice_only', 'sfx_only', 'cinematic', 'cinematic_voice'] as const).map((id) => ({
    id,
    label: copy.modes[id].label,
    description: copy.modes[id].description,
  }));
}

export function formatAudioPackLabel(copy: AudioWorkspaceCopy, pack: string | null | undefined): string | null {
  switch (pack) {
    case 'music_only':
    case 'voice_only':
    case 'sfx_only':
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
    case 'Voice Over':
      return copy.modes.voice_only.label;
    case 'SFX Only':
      return copy.modes.sfx_only.label;
    default:
      return null;
  }
}
