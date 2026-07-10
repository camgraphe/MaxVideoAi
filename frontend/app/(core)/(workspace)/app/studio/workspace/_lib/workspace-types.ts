import type { Edge, Node } from '@xyflow/react';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { AspectRatio, Mode, Resolution } from '@/types/engines';
import type {
  AudioIntensity,
  AudioLanguage,
  AudioMood,
  AudioVoiceDelivery,
  AudioVoiceGender,
  AudioVoiceProfile,
} from '@/lib/audio-generation';
import type {
  CharacterBuilderConsistencyMode,
  CharacterBuilderFormatMode,
  CharacterBuilderOutputMode,
  CharacterBuilderReferenceStrength,
  CharacterBuilderRequest,
  CharacterBuilderTraits,
} from '@/types/character-builder';
import type { StudioCopy } from '../../_lib/studio-copy';

export type WorkspaceNodeKind =
  | 'asset-image'
  | 'asset-video'
  | 'asset-audio'
  | 'text-prompt'
  | 'note'
  | 'shot'
  | 'chat'
  | 'output';

export type WorkspaceEdgeKind =
  | 'reference'
  | 'start_image'
  | 'end_image'
  | 'product'
  | 'character'
  | 'style'
  | 'composition'
  | 'logo'
  | 'prompt'
  | 'negative_prompt'
  | 'camera'
  | 'dialogue'
  | 'narration'
  | 'audio'
  | 'voiceover'
  | 'music'
  | 'sfx'
  | 'motion_reference'
  | 'previous_shot'
  | 'continuity'
  | 'generated_output'
  | 'output_to_timeline'
  | 'video_reference';

export type WorkspaceWorkflowType =
  | 'text_to_video'
  | 'image_to_video'
  | 'video_to_video'
  | 'storyboard_to_video'
  | 'character_to_video'
  | 'character_builder'
  | 'storyboard_generation'
  | 'angle_generation'
  | 'text_to_image'
  | 'image_to_image'
  | 'image_upscale'
  | 'video_upscale'
  | 'music_generation'
  | 'voiceover_generation'
  | 'sfx_generation'
  | 'cinematic_audio'
  | 'cinematic_voiceover'
  | 'chat_completion';

export type WorkspaceGenerationFamily = 'video' | 'image' | 'audio' | 'upscale' | 'chat';
export type WorkspaceToolKind = 'angle' | 'character-builder' | 'storyboard';
export type WorkspaceBlockMode =
  | 'chat'
  | 'first-last-video'
  | 'image-edit'
  | 'image-to-video'
  | 'reference-to-video'
  | 'text-to-image'
  | 'text-to-video'
  | 'tool'
  | 'video-edit'
  | 'video-reframe';
export type WorkspaceOutputMediaKind = 'audio' | 'image' | 'text' | 'video';
export type WorkspaceOutputCount = number | { min: number; max: number };
export type WorkspacePolicyControlField =
  | 'model'
  | 'durationSec'
  | 'aspectRatio'
  | 'resolution'
  | 'fps'
  | 'seed'
  | 'audioEnabled'
  | 'lipSyncEnabled'
  | 'referenceStrength'
  | 'outputFormat'
  | 'outputCount'
  | 'characterOutputMode'
  | 'characterConsistencyMode'
  | 'characterQualityMode'
  | 'characterFormatMode'
  | 'characterReferenceStrength'
  | 'characterTraits'
  | 'angleRotation'
  | 'angleTilt'
  | 'angleZoom'
  | 'angleSafeMode'
  | 'angleBestAngles'
  | 'upscaleMode'
  | 'upscaleFactor'
  | 'audioMood'
  | 'audioIntensity'
  | 'audioMusicEnabled'
  | 'voiceGender'
  | 'voiceProfile'
  | 'voiceDelivery'
  | 'audioLanguage'
  | 'chatProvider'
  | 'chatModel'
  | 'chatSystemPrompt'
  | 'chatMessage'
  | `tool.${string}`
  | `setting.${string}`;

export type WorkspaceToolSettings = {
  angle?: {
    rotation: number;
    tilt: number;
    zoom: number;
    safeMode: boolean;
    generateBestAngles: boolean;
  };
  characterBuilder?: {
    outputMode: CharacterBuilderOutputMode;
    consistencyMode: CharacterBuilderConsistencyMode;
    referenceStrength: CharacterBuilderReferenceStrength;
    qualityMode: 'draft' | 'final';
    formatMode: CharacterBuilderFormatMode;
    traits: CharacterBuilderTraits;
    outputOptions: CharacterBuilderRequest['outputOptions'];
    advancedNotes: string;
    mustRemainVisible: string[];
    generateCount: 1 | 4;
  };
  storyboard?: {
    targetModel: 'seedance' | 'kling';
    lengthPreset: 'short' | 'medium' | 'long';
    frameCount: 4 | 6 | 8;
    durationSec: 6 | 10 | 15;
    orientation: 'landscape' | 'portrait';
    tier: 'hd' | '4k' | 'ultra';
  };
  upscale?: {
    mode: 'factor' | 'target';
    upscaleFactor: 2 | 4;
    outputFormat?: string;
  };
  audio?: {
    mood: AudioMood;
    intensity: AudioIntensity;
    musicEnabled: boolean;
    voiceGender: AudioVoiceGender;
    voiceProfile: AudioVoiceProfile;
    voiceDelivery: AudioVoiceDelivery;
    language: AudioLanguage;
  };
};

export type WorkspaceGenerationPresetId =
  | 'generate-video'
  | 'modify-video'
  | 'storyboard'
  | 'character-builder'
  | 'angle'
  | 'generate-image'
  | 'modify-image'
  | 'upscale-image'
  | 'upscale-video'
  | 'audio-music'
  | 'audio-voiceover'
  | 'audio-sfx'
  | 'audio-sound-design'
  | 'audio-sound-design-voice'
  | 'chat-box';

export type WorkspaceChatProvider = 'openai' | 'gemini';
export type WorkspaceChatMode = 'assistant' | 'chatbot';

export type WorkspaceChatMessage = {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type WorkspaceChatSettings = {
  mode: WorkspaceChatMode;
  botName: string;
  provider: WorkspaceChatProvider;
  modelId: string;
  systemPrompt: string;
  draftMessage: string;
  messages: WorkspaceChatMessage[];
  status: 'idle' | 'running' | 'failed';
};

export type WorkspaceAssetKind = 'image' | 'video' | 'audio' | 'logo' | 'text';
export type WorkspaceAcceptedMediaKind = WorkspaceAssetKind;
export type WorkspaceShotStatus = 'draft' | 'ready' | 'incompatible' | 'generating' | 'failed' | 'completed';
export type WorkspaceOutputStatus = 'placeholder' | 'processing' | 'ready' | 'failed';
export type WorkspacePromptRole = 'prompt' | 'negative_prompt' | 'style' | 'camera' | 'dialogue' | 'narration' | 'scene_description';
export type WorkspaceTimelineVideoTrack = 'video' | `video-${number}`;
export type WorkspaceTimelineAudioTrack = 'audio' | `audio-${number}`;
export type WorkspaceTimelineTrack = WorkspaceTimelineVideoTrack | WorkspaceTimelineAudioTrack;
export type WorkspaceTimelineLinkedGroupKind = 'video-audio' | 'manual';

export type WorkspaceProjectSettings = {
  aspectRatio: Extract<AspectRatio, '16:9' | '9:16' | '1:1' | '4:5' | '21:9'>;
  resolution: Extract<Resolution, '720p' | '1080p' | '1440p' | '4k'>;
  fps: 24 | 25 | 30 | 60;
};

export type WorkspaceAssetRecord = {
  id: string;
  kind: WorkspaceAssetKind;
  filename: string;
  subtitle: string;
  folderId?: string | null;
  url?: string;
  audioUrl?: string;
  thumbUrl?: string;
  hasAudio?: boolean;
  durationSec?: number;
  dimensions?: string;
};

export type WorkspaceReferencePreview = {
  id?: string | null;
  url: string;
  previewUrl?: string | null;
  width?: number | null;
  height?: number | null;
  name?: string | null;
};

export type WorkspaceProjectMediaFolder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceShotSettings = {
  presetId?: WorkspaceGenerationPresetId;
  family?: WorkspaceGenerationFamily;
  outputKind?: WorkspaceOutputMediaKind;
  toolKind?: WorkspaceToolKind;
  toolSettings?: WorkspaceToolSettings;
  modelId: string;
  workflowType: WorkspaceWorkflowType;
  durationSec: number;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  fps: number;
  seed?: number | null;
  audioEnabled: boolean;
  lipSyncEnabled: boolean;
  referenceStrength: number;
  outputName: string;
  status: WorkspaceShotStatus;
};

export type WorkspaceOutputMetadata = {
  kind: 'video' | 'image' | 'audio' | 'text';
  modelId: string;
  modelLabel: string;
  workflowType: WorkspaceWorkflowType;
  durationSec?: number;
  aspectRatio?: AspectRatio;
  resolution?: Resolution;
  pricing?: PricingSnapshot | null;
  status?: WorkspaceOutputStatus;
  createdAt: string;
  sourceShotId: string;
  url?: string | null;
  audioUrl?: string | null;
  thumbUrl?: string | null;
  hasAudio?: boolean;
  jobId?: string | null;
  projectMediaFolderId?: string | null;
};

export type WorkspaceInputConnector = {
  kind: WorkspaceEdgeKind;
  label: string;
  required: boolean;
  requiredInModes?: WorkspaceBlockMode[];
  fieldId?: string;
  description?: string;
  minCount?: number;
  maxCount?: number;
  mutuallyExclusiveWith?: WorkspaceEdgeKind[];
  acceptedMediaKinds?: WorkspaceAcceptedMediaKind[];
  acceptedFormats?: string[];
  maxDurationSec?: number;
  maxFileSizeMb?: number;
  disabledReason?: string;
  connectedCount?: number;
  remainingCount?: number;
  capacityLabel?: string | null;
  sourceType: 'text' | 'image' | 'video' | 'audio' | 'control';
};

export type WorkspaceRenderOption = {
  id: 'audio' | 'lip_sync';
  label: string;
  control: 'toggle' | 'included';
  defaultEnabled: boolean;
  fieldId?: string;
  engineParam?: string;
  description?: string;
};

export type WorkspaceModelCapability = {
  id: string;
  label: string;
  provider: string;
  providerEngineSlug: string;
  family: WorkspaceGenerationFamily;
  outputKind: WorkspaceOutputMediaKind;
  modes: Mode[];
  workflows: WorkspaceWorkflowType[];
  text_to_video: boolean;
  image_to_video: boolean;
  video_to_video: boolean;
  storyboard_to_video: boolean;
  character_to_video: boolean;
  text_to_image: boolean;
  image_to_image: boolean;
  image_upscale: boolean;
  video_upscale: boolean;
  music_generation: boolean;
  voiceover_generation: boolean;
  sfx_generation: boolean;
  chat_completion: boolean;
  reference_image: boolean;
  reference_video: boolean;
  product_reference: boolean;
  character_reference: boolean;
  motion_reference: boolean;
  audio_input: boolean;
  music_input: boolean;
  voiceover_input: boolean;
  dialogue: boolean;
  lip_sync: boolean;
  audio_generation: boolean;
  supports_people_reference: boolean;
  supports_product_reference: boolean;
  supported_aspect_ratios: AspectRatio[];
  supported_durations: number[];
  supported_resolutions: Resolution[];
  supported_fps: number[];
  input_connectors: WorkspaceInputConnector[];
  render_options: WorkspaceRenderOption[];
  required_inputs: WorkspaceEdgeKind[];
  optional_inputs: WorkspaceEdgeKind[];
  unsupported_inputs: WorkspaceEdgeKind[];
  output_count?: WorkspaceOutputCount;
  control_fields?: WorkspacePolicyControlField[];
  pricing_relevant_fields?: WorkspacePolicyControlField[];
};

export type WorkspaceShotValidation = {
  capability: WorkspaceModelCapability | null;
  missingInputs: WorkspaceEdgeKind[];
  incompatibleInputs: WorkspaceEdgeKind[];
  compatibleInputs: WorkspaceEdgeKind[];
  recommendedModels: WorkspaceModelCapability[];
  resolvedWorkflowType: WorkspaceWorkflowType;
  canGenerate: boolean;
};

export type WorkspacePricingEstimate = {
  status: 'blocked' | 'loading' | 'ready' | 'error';
  label: string;
  totalCents?: number;
  currency?: string;
  pricing?: PricingSnapshot | null;
  error?: string;
};

export type WorkspaceGeneratedCopyReference =
  | {
      key: keyof StudioCopy['canvas']['nodes'] & string;
      replacements?: Record<string, string | number>;
      edgeKindReplacements?: Record<string, WorkspaceEdgeKind>;
      lowercaseEdgeKindReplacements?: Record<string, WorkspaceEdgeKind>;
      value?: never;
    }
  | {
      key?: never;
      replacements?: never;
      edgeKindReplacements?: never;
      lowercaseEdgeKindReplacements?: never;
      value: string;
    };

export type WorkspaceGeneratedCopyField = WorkspaceGeneratedCopyReference | null;

export type WorkspaceNodeGeneratedCopy = {
  title?: WorkspaceGeneratedCopyField;
  subtitle?: WorkspaceGeneratedCopyField;
  promptText?: WorkspaceGeneratedCopyField;
  shotOutputName?: WorkspaceGeneratedCopyField;
};

export type WorkspaceTimelineItemGeneratedCopy = {
  title?: WorkspaceGeneratedCopyField;
};

export type WorkspaceGraphEdgeData = Record<string, unknown> & {
  kind: WorkspaceEdgeKind;
  label: string;
  color: string;
};

export type WorkspaceNodeData = Record<string, unknown> & {
  kind: WorkspaceNodeKind;
  title: string;
  subtitle?: string;
  accent?: string;
  asset?: WorkspaceAssetRecord;
  promptText?: string;
  promptRole?: WorkspacePromptRole;
  shot?: WorkspaceShotSettings;
  chat?: WorkspaceChatSettings;
  output?: WorkspaceOutputMetadata;
  generatedCopy?: WorkspaceNodeGeneratedCopy;
  sourceHandles?: WorkspaceEdgeKind[];
  targetHandles?: WorkspaceEdgeKind[];
  inputConnectors?: WorkspaceInputConnector[];
  modelCapabilities?: WorkspaceModelCapability[];
  referencePreview?: WorkspaceReferencePreview | null;
  validation?: WorkspaceShotValidation;
  pricingEstimate?: WorkspacePricingEstimate;
  onGenerateShot?: (nodeId: string) => void;
  onPatchShot?: (nodeId: string, patch: Partial<WorkspaceShotSettings>) => void;
  onSendOutputToTimeline?: (nodeId: string) => void;
  onPromptChange?: (nodeId: string, value: string) => void;
  onChatDraftChange?: (nodeId: string, value: string) => void;
  onPatchChat?: (nodeId: string, patch: Partial<WorkspaceChatSettings>) => void;
  onRunChat?: (nodeId: string) => void;
  onOpenAssetLibrary?: (nodeId: string) => void;
  studioCanvasCopy?: StudioCopy['canvas'];
};

export type WorkspaceGraphNode = Node<WorkspaceNodeData>;
export type WorkspaceGraphEdge = Edge<WorkspaceGraphEdgeData>;

export type WorkspaceTimelineClipTransform = {
  scale: number;
  positionX: number;
  positionY: number;
  rotation: number;
  opacity: number;
};

export type WorkspaceTimelineAudioMix = {
  volume: number;
  muted: boolean;
};

export type WorkspaceTimelineItem = {
  id: string;
  outputNodeId: string;
  track: WorkspaceTimelineTrack;
  title: string;
  durationSec: number;
  startSec: number;
  sourceStartSec?: number;
  sourceDurationSec?: number;
  linkedGroupId?: string | null;
  linkedGroupKind?: WorkspaceTimelineLinkedGroupKind | null;
  mediaKind?: 'video' | 'audio' | 'image';
  hasEmbeddedAudio?: boolean;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  modelId?: string;
  status?: WorkspaceShotStatus;
  generatedCopy?: WorkspaceTimelineItemGeneratedCopy;
  transform?: WorkspaceTimelineClipTransform;
  audioMix?: WorkspaceTimelineAudioMix;
  transitionOut?: {
    type: 'crossfade';
    durationSec: number;
  } | null;
};

export type WorkspaceTemplateId =
  | 'product-ad'
  | 'dev-blocks'
  | 'character-dialogue'
  | 'storyboard-to-video'
  | 'ugc-ad'
  | 'cinematic-scene';

export type WorkspaceTemplateSummary = {
  id: WorkspaceTemplateId;
  name: string;
  description: string;
  thumbnailUrl?: string;
  badge?: string;
  flow?: string;
  accent?: string;
};

export type WorkspaceTemplate = {
  id: WorkspaceTemplateId;
  name: string;
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  timelineItems: WorkspaceTimelineItem[];
};
