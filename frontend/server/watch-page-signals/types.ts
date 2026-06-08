export type RawRecord = Record<string, unknown>;

export type ParsedSnapshot = {
  surface: string | null;
  engineId: string | null;
  engineLabel: string | null;
  inputMode: string | null;
  prompt: string;
  negativePrompt: string | null;
  core: {
    durationSec: number | null;
    aspectRatio: string | null;
    resolution: string | null;
    fps: number | null;
    iterationCount: number | null;
    audio: boolean | null;
  };
  advanced: {
    shotType: string | null;
    seed: number | null;
    cameraFixed: boolean | null;
    multiPromptCount: number;
    voiceIdsCount: number;
    voiceControl: boolean;
  };
  refs: {
    imageUrl: string | null;
    audioUrl: string | null;
    referenceImages: string[];
    referenceImagesCount: number;
    referenceVideosCount: number;
    firstFrameUrl: string | null;
    lastFrameUrl: string | null;
    endImageUrl: string | null;
  };
};

export type WatchPageIntent =
  | 'image-to-video'
  | 'first-last-frame'
  | 'multi-shot'
  | 'camera-motion'
  | 'product-ad'
  | 'audio-enabled'
  | 'prompt-example';

export type WatchPageSeoStatus = 'candidate' | 'draft' | 'needs_edits' | 'approved' | 'disabled';

export type WatchPageRelatedLink = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  engineLabel: string;
  thumbUrl?: string;
  score: number;
  reason: string;
};

export type WatchPageSourceImage = {
  key: string;
  label: string;
  url: string;
  thumbUrl?: string;
  alt: string;
};

export type WatchPageCompareLink = {
  href: string;
  label: string;
  reason: string;
};

export type WatchPageDerivedSignals = {
  title: string;
  metaTitle: string;
  metaDescription: string;
  videoObjectName: string;
  canonicalSlug: string | null;
  canonicalUrl: string;
  expectedCanonicalUrl: string;
  canonicalBlockers: string[];
  targetKeyword: string | null;
  seoStatus: WatchPageSeoStatus | null;
  editorialQaErrors: string[];
  videoDescription: string;
  intro: string;
  promptText: string;
  promptPreview: string;
  seoPromptContext: string | null;
  negativePrompt: string | null;
  engineLabel: string;
  engineSlug: string | null;
  engineFamily: string | null;
  exampleFamily: string | null;
  exampleFamilyLabel: string | null;
  mode: string | null;
  modeLabel: string;
  durationSec: number | null;
  aspectRatio: string | null;
  resolution: string | null;
  fps: number | null;
  hasAudio: boolean;
  primaryIntent: WatchPageIntent;
  capabilityTags: string[];
  styleTags: string[];
  badges: string[];
  whatThisShows: string[];
  detailRows: Array<{ key: string; label: string; value: string }>;
  promptRows: Array<{ key: string; label: string; value: string }>;
  inputRows: Array<{ key: string; label: string; value: string }>;
  sourceImages: WatchPageSourceImage[];
  promptImprovementNotes: string[];
  compareLinks: WatchPageCompareLink[];
  parentPath: string | null;
  parentLabel: string | null;
  modelPath: string | null;
  modelLabel: string | null;
  recreatePath: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
  engineDescription: string;
  engineBadges: string[];
  completenessScore: number;
  differentiationScore: number;
  indexable: boolean;
  auditNotes: string[];
  stabilityWarnings: string[];
};

export type CandidateRow = {
  id: string;
  title: string;
  subtitle: string;
  engineLabel: string;
  thumbUrl?: string;
  engineSlug: string | null;
  exampleFamily: string | null;
  mode: string | null;
  primaryIntent: WatchPageIntent;
  capabilityTags: string[];
  styleTags: string[];
};
