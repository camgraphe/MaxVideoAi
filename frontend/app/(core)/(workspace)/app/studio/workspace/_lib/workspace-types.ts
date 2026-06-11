import type { Edge, Node } from '@xyflow/react';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { AspectRatio, Mode, Resolution } from '@/types/engines';

export type WorkspaceNodeKind =
  | 'asset-image'
  | 'asset-video'
  | 'asset-audio'
  | 'text-prompt'
  | 'shot'
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
  | 'storyboard_to_video';

export type WorkspaceAssetKind = 'image' | 'video' | 'audio' | 'logo' | 'text';
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
  url?: string;
  thumbUrl?: string;
  durationSec?: number;
  dimensions?: string;
};

export type WorkspaceProjectMediaFolder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceShotSettings = {
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
  kind: 'video' | 'image' | 'audio';
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
};

export type WorkspaceInputConnector = {
  kind: WorkspaceEdgeKind;
  label: string;
  required: boolean;
  fieldId?: string;
  description?: string;
  maxCount?: number;
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
  modes: Mode[];
  workflows: WorkspaceWorkflowType[];
  text_to_video: boolean;
  image_to_video: boolean;
  video_to_video: boolean;
  storyboard_to_video: boolean;
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
  status: 'loading' | 'ready' | 'error';
  label: string;
  totalCents?: number;
  currency?: string;
  pricing?: PricingSnapshot | null;
  error?: string;
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
  output?: WorkspaceOutputMetadata;
  sourceHandles?: WorkspaceEdgeKind[];
  targetHandles?: WorkspaceEdgeKind[];
  inputConnectors?: WorkspaceInputConnector[];
  validation?: WorkspaceShotValidation;
  pricingEstimate?: WorkspacePricingEstimate;
  onGenerateShot?: (nodeId: string) => void;
  onSendOutputToTimeline?: (nodeId: string) => void;
  onPromptChange?: (nodeId: string, value: string) => void;
  onOpenAssetLibrary?: (nodeId: string) => void;
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
  modelId?: string;
  status?: WorkspaceShotStatus;
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
