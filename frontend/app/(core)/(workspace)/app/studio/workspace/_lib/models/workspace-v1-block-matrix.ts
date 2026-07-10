import type {
  WorkspaceEdgeKind,
  WorkspaceGenerationPresetId,
  WorkspaceOutputMediaKind,
  WorkspacePolicyControlField,
  WorkspaceWorkflowType,
} from '../workspace-types';

export type WorkspaceV1BlockContract = {
  presetId: WorkspaceGenerationPresetId;
  family: 'audio' | 'chat' | 'image' | 'upscale' | 'video';
  outputKind: WorkspaceOutputMediaKind;
  workflows: WorkspaceWorkflowType[];
  requiredInputsByWorkflow: Partial<Record<WorkspaceWorkflowType, WorkspaceEdgeKind[]>>;
  optionalInputs: WorkspaceEdgeKind[];
  visibleControls: WorkspacePolicyControlField[];
  pricingRelevantFields: WorkspacePolicyControlField[];
  compatibleModelIds?: string[];
};

export const WORKSPACE_V1_BLOCK_MATRIX = {
  'generate-video': {
    presetId: 'generate-video',
    family: 'video',
    outputKind: 'video',
    workflows: ['text_to_video', 'image_to_video', 'storyboard_to_video', 'character_to_video'],
    requiredInputsByWorkflow: {
      text_to_video: ['prompt'],
      image_to_video: ['prompt', 'start_image'],
      storyboard_to_video: ['prompt', 'reference'],
      character_to_video: ['prompt', 'character'],
    },
    optionalInputs: ['reference', 'style', 'camera', 'end_image', 'audio', 'voiceover', 'music', 'sfx'],
    visibleControls: ['model', 'durationSec', 'aspectRatio', 'resolution', 'fps', 'referenceStrength', 'audioEnabled', 'lipSyncEnabled'],
    pricingRelevantFields: ['model', 'durationSec', 'resolution', 'audioEnabled', 'lipSyncEnabled'],
  },
  'modify-video': {
    presetId: 'modify-video',
    family: 'video',
    outputKind: 'video',
    workflows: ['video_to_video'],
    requiredInputsByWorkflow: { video_to_video: ['prompt', 'video_reference'] },
    optionalInputs: ['motion_reference', 'previous_shot', 'continuity', 'style', 'camera', 'audio'],
    visibleControls: ['model', 'durationSec', 'aspectRatio', 'resolution', 'fps', 'referenceStrength'],
    pricingRelevantFields: ['model', 'durationSec', 'resolution'],
    compatibleModelIds: ['luma-ray-3-2'],
  },
  'generate-image': {
    presetId: 'generate-image',
    family: 'image',
    outputKind: 'image',
    workflows: ['text_to_image'],
    requiredInputsByWorkflow: { text_to_image: ['prompt'] },
    optionalInputs: ['style', 'reference'],
    visibleControls: ['model', 'aspectRatio', 'resolution', 'seed', 'outputCount'],
    pricingRelevantFields: ['model', 'resolution', 'outputCount'],
  },
  'modify-image': {
    presetId: 'modify-image',
    family: 'image',
    outputKind: 'image',
    workflows: ['image_to_image'],
    requiredInputsByWorkflow: { image_to_image: ['prompt', 'reference'] },
    optionalInputs: ['style', 'logo', 'composition'],
    visibleControls: ['model', 'aspectRatio', 'resolution', 'seed', 'referenceStrength', 'outputCount'],
    pricingRelevantFields: ['model', 'resolution', 'outputCount'],
  },
  'audio-music': {
    presetId: 'audio-music',
    family: 'audio',
    outputKind: 'audio',
    workflows: ['music_generation'],
    requiredInputsByWorkflow: { music_generation: ['prompt'] },
    optionalInputs: ['style'],
    visibleControls: ['model', 'durationSec', 'audioMood', 'audioIntensity', 'audioMusicEnabled'],
    pricingRelevantFields: ['model', 'durationSec'],
  },
  'audio-voiceover': {
    presetId: 'audio-voiceover',
    family: 'audio',
    outputKind: 'audio',
    workflows: ['voiceover_generation'],
    requiredInputsByWorkflow: { voiceover_generation: ['prompt'] },
    optionalInputs: ['voiceover', 'dialogue', 'narration'],
    visibleControls: ['model', 'durationSec', 'voiceGender', 'voiceProfile', 'voiceDelivery', 'audioLanguage'],
    pricingRelevantFields: ['model', 'durationSec'],
  },
  'audio-sfx': {
    presetId: 'audio-sfx',
    family: 'audio',
    outputKind: 'audio',
    workflows: ['sfx_generation'],
    requiredInputsByWorkflow: { sfx_generation: ['prompt'] },
    optionalInputs: ['video_reference', 'motion_reference'],
    visibleControls: ['model', 'durationSec', 'audioMood', 'audioIntensity'],
    pricingRelevantFields: ['model', 'durationSec'],
  },
  'audio-sound-design': {
    presetId: 'audio-sound-design',
    family: 'audio',
    outputKind: 'audio',
    workflows: ['cinematic_audio'],
    requiredInputsByWorkflow: { cinematic_audio: ['video_reference'] },
    optionalInputs: ['prompt', 'music', 'sfx'],
    visibleControls: ['model', 'durationSec', 'audioMood', 'audioIntensity', 'audioMusicEnabled'],
    pricingRelevantFields: ['model', 'durationSec'],
  },
  'audio-sound-design-voice': {
    presetId: 'audio-sound-design-voice',
    family: 'audio',
    outputKind: 'audio',
    workflows: ['cinematic_voiceover'],
    requiredInputsByWorkflow: { cinematic_voiceover: ['video_reference', 'prompt'] },
    optionalInputs: ['music', 'sfx', 'voiceover', 'dialogue', 'narration'],
    visibleControls: ['model', 'durationSec', 'audioMood', 'audioIntensity', 'voiceGender', 'voiceProfile', 'voiceDelivery', 'audioLanguage'],
    pricingRelevantFields: ['model', 'durationSec'],
  },
  angle: {
    presetId: 'angle',
    family: 'image',
    outputKind: 'image',
    workflows: ['angle_generation'],
    requiredInputsByWorkflow: { angle_generation: ['reference'] },
    optionalInputs: ['prompt'],
    visibleControls: ['model', 'outputCount', 'angleRotation', 'angleTilt', 'angleZoom', 'angleSafeMode', 'angleBestAngles'],
    pricingRelevantFields: ['model', 'outputCount'],
  },
  'character-builder': {
    presetId: 'character-builder',
    family: 'image',
    outputKind: 'image',
    workflows: ['character_builder'],
    requiredInputsByWorkflow: { character_builder: [] },
    optionalInputs: ['prompt', 'reference', 'style'],
    visibleControls: ['model', 'outputCount', 'characterOutputMode', 'characterConsistencyMode', 'characterQualityMode', 'characterFormatMode', 'characterReferenceStrength', 'characterTraits'],
    pricingRelevantFields: ['model', 'outputCount', 'characterQualityMode', 'characterFormatMode'],
  },
  storyboard: {
    presetId: 'storyboard',
    family: 'image',
    outputKind: 'image',
    workflows: ['storyboard_generation'],
    requiredInputsByWorkflow: { storyboard_generation: ['prompt'] },
    optionalInputs: ['reference', 'character', 'style'],
    visibleControls: ['model', 'outputCount', 'tool.storyboard.targetModel', 'tool.storyboard.frameCount', 'tool.storyboard.durationSec', 'tool.storyboard.orientation', 'tool.storyboard.tier'],
    pricingRelevantFields: ['model', 'outputCount', 'tool.storyboard.frameCount', 'tool.storyboard.tier'],
  },
  'upscale-image': {
    presetId: 'upscale-image',
    family: 'upscale',
    outputKind: 'image',
    workflows: ['image_upscale'],
    requiredInputsByWorkflow: { image_upscale: ['reference'] },
    optionalInputs: ['prompt'],
    visibleControls: ['model', 'resolution', 'upscaleMode', 'upscaleFactor', 'outputFormat'],
    pricingRelevantFields: ['model', 'resolution', 'upscaleFactor'],
  },
  'upscale-video': {
    presetId: 'upscale-video',
    family: 'upscale',
    outputKind: 'video',
    workflows: ['video_upscale'],
    requiredInputsByWorkflow: { video_upscale: ['video_reference'] },
    optionalInputs: ['prompt'],
    visibleControls: ['model', 'durationSec', 'resolution', 'upscaleMode', 'upscaleFactor', 'outputFormat'],
    pricingRelevantFields: ['model', 'durationSec', 'resolution', 'upscaleFactor'],
  },
  'chat-box': {
    presetId: 'chat-box',
    family: 'chat',
    outputKind: 'text',
    workflows: ['chat_completion'],
    requiredInputsByWorkflow: { chat_completion: ['prompt'] },
    optionalInputs: ['style', 'camera', 'dialogue', 'narration'],
    visibleControls: ['chatProvider', 'chatModel', 'chatSystemPrompt', 'chatMessage'],
    pricingRelevantFields: [],
  },
} satisfies Record<WorkspaceGenerationPresetId, WorkspaceV1BlockContract>;

export function getWorkspaceV1BlockContract(presetId: WorkspaceGenerationPresetId): WorkspaceV1BlockContract {
  return WORKSPACE_V1_BLOCK_MATRIX[presetId];
}
