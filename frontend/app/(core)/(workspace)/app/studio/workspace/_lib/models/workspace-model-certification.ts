import type {
  WorkspaceGenerationPresetId,
  WorkspaceShotSettings,
  WorkspaceWorkflowType,
} from '../workspace-types';

export type WorkspaceModelCertification = {
  modelId: string;
  blocks: Partial<Record<WorkspaceGenerationPresetId, readonly WorkspaceWorkflowType[]>>;
};

const VIDEO_TEXT_IMAGE_MODELS = [
  'pika-text-to-video',
  'veo-3-1',
  'veo-3-1-fast',
  'veo-3-1-lite',
  'gemini-omni-flash',
  'lumaRay2',
  'lumaRay2_flash',
  'luma-ray-3-2',
  'sora-2',
  'sora-2-pro',
  'kling-2-5-turbo',
  'kling-2-6-pro',
  'kling-3-pro',
  'kling-3-standard',
  'kling-3-4k',
  'kling-o3-standard',
  'kling-o3-pro',
  'kling-o3-4k',
  'happy-horse-1-1',
  'happy-horse-1-0',
  'seedance-1-5-pro',
  'seedance-2-0',
  'seedance-2-0-fast',
  'seedance-2-0-mini',
  'seedance-2-0-fast-byteplus',
  'seedance-2-5',
  'wan-2-5',
  'wan-2-6',
  'ltx-2-fast',
  'ltx-2',
  'ltx-2-3-fast',
  'ltx-2-3',
  'minimax-h3',
  'minimax-hailuo-02-text',
] as const;

const REFERENCE_VIDEO_MODELS = new Set<string>([
  'veo-3-1',
  'veo-3-1-fast',
  'gemini-omni-flash',
  'sora-2-pro',
  'kling-o3-standard',
  'kling-o3-pro',
  'kling-o3-4k',
  'happy-horse-1-1',
  'happy-horse-1-0',
  'seedance-2-0',
  'seedance-2-0-fast',
  'seedance-2-0-mini',
  'seedance-2-5',
  'wan-2-6',
  'minimax-h3',
]);

const CHARACTER_VIDEO_MODELS = new Set<string>([
  'kling-2-5-turbo',
  'kling-2-6-pro',
  'kling-3-pro',
  'kling-3-standard',
  'kling-3-4k',
  'kling-o3-standard',
  'kling-o3-pro',
  'kling-o3-4k',
  'happy-horse-1-1',
  'happy-horse-1-0',
  'ltx-2-fast',
  'ltx-2',
  'ltx-2-3-fast',
  'ltx-2-3',
]);

const IMAGE_MODELS = [
  'luma-uni-1',
  'luma-uni-1-max',
  'nano-banana',
  'nano-banana-lite',
  'nano-banana-pro',
  'nano-banana-2',
  'gpt-image-2',
  'seedream',
  'seedream-5-0-pro',
] as const;

const VIRTUAL_CERTIFICATIONS: WorkspaceModelCertification[] = [
  { modelId: 'audio-music-only', blocks: { 'audio-music': ['music_generation'] } },
  { modelId: 'audio-voice-only', blocks: { 'audio-voiceover': ['voiceover_generation'] } },
  { modelId: 'audio-sfx-only', blocks: { 'audio-sfx': ['sfx_generation'] } },
  { modelId: 'audio-cinematic', blocks: { 'audio-sound-design': ['cinematic_audio'] } },
  { modelId: 'audio-cinematic-voice', blocks: { 'audio-sound-design-voice': ['cinematic_voiceover'] } },
  { modelId: 'character-builder-tool', blocks: { 'character-builder': ['character_builder'] } },
  { modelId: 'storyboard-gpt-image-2', blocks: { storyboard: ['storyboard_generation'] } },
  { modelId: 'angle-flux-multiple-angles', blocks: { angle: ['angle_generation'] } },
  { modelId: 'angle-qwen-multiple-angles', blocks: { angle: ['angle_generation'] } },
  { modelId: 'upscale-image-seedvr', blocks: { 'upscale-image': ['image_upscale'] } },
  { modelId: 'upscale-image-topaz', blocks: { 'upscale-image': ['image_upscale'] } },
  { modelId: 'upscale-image-recraft-crisp', blocks: { 'upscale-image': ['image_upscale'] } },
  { modelId: 'upscale-video-seedvr', blocks: { 'upscale-video': ['video_upscale'] } },
  { modelId: 'upscale-video-flashvsr', blocks: { 'upscale-video': ['video_upscale'] } },
  { modelId: 'upscale-video-topaz', blocks: { 'upscale-video': ['video_upscale'] } },
  { modelId: 'studio-chat-openai', blocks: { 'chat-box': ['chat_completion'] } },
  { modelId: 'studio-chat-gemini', blocks: { 'chat-box': ['chat_completion'] } },
];

export const WORKSPACE_MODEL_CERTIFICATIONS: readonly WorkspaceModelCertification[] = [
  ...VIDEO_TEXT_IMAGE_MODELS.map((modelId): WorkspaceModelCertification => {
    const workflows: WorkspaceWorkflowType[] = ['text_to_video', 'image_to_video'];
    if (REFERENCE_VIDEO_MODELS.has(modelId)) workflows.push('storyboard_to_video');
    if (CHARACTER_VIDEO_MODELS.has(modelId)) workflows.push('character_to_video');
    return {
      modelId,
      blocks: {
        'generate-video': workflows,
        ...(modelId === 'luma-ray-3-2' || modelId === 'seedance-2-5'
          ? { 'modify-video': ['video_to_video'] as const }
          : {}),
        ...(modelId === 'seedance-2-5'
          ? { 'extend-video': ['video_to_video'] as const }
          : {}),
      },
    };
  }),
  ...IMAGE_MODELS.map((modelId): WorkspaceModelCertification => ({
    modelId,
    blocks: {
      'generate-image': ['text_to_image'],
      'modify-image': ['image_to_image'],
    },
  })),
  ...VIRTUAL_CERTIFICATIONS,
];

const CERTIFICATION_BY_MODEL = new Map(
  WORKSPACE_MODEL_CERTIFICATIONS.map((certification) => [certification.modelId, certification])
);

export function workspacePresetIdForSettings(
  settings: Pick<WorkspaceShotSettings, 'presetId' | 'workflowType'>
): WorkspaceGenerationPresetId | null {
  if (settings.presetId) return settings.presetId;

  const legacyPresetByWorkflow: Partial<Record<WorkspaceWorkflowType, WorkspaceGenerationPresetId>> = {
    text_to_video: 'generate-video',
    image_to_video: 'generate-video',
    storyboard_to_video: 'generate-video',
    character_to_video: 'generate-video',
    video_to_video: 'modify-video',
    text_to_image: 'generate-image',
    image_to_image: 'modify-image',
    image_upscale: 'upscale-image',
    video_upscale: 'upscale-video',
    music_generation: 'audio-music',
    voiceover_generation: 'audio-voiceover',
    sfx_generation: 'audio-sfx',
    cinematic_audio: 'audio-sound-design',
    cinematic_voiceover: 'audio-sound-design-voice',
    character_builder: 'character-builder',
    storyboard_generation: 'storyboard',
    angle_generation: 'angle',
    chat_completion: 'chat-box',
  };

  return legacyPresetByWorkflow[settings.workflowType] ?? null;
}

export function getWorkspaceCertifiedWorkflows({
  modelId,
  presetId,
}: {
  modelId: string;
  presetId: WorkspaceGenerationPresetId;
}): readonly WorkspaceWorkflowType[] {
  return CERTIFICATION_BY_MODEL.get(modelId)?.blocks[presetId] ?? [];
}

export function isWorkspaceModelCertifiedForBlock({
  modelId,
  presetId,
  workflowType,
}: {
  modelId: string;
  presetId: WorkspaceGenerationPresetId;
  workflowType?: WorkspaceWorkflowType;
}): boolean {
  const workflows = getWorkspaceCertifiedWorkflows({ modelId, presetId });
  return workflowType ? workflows.includes(workflowType) : workflows.length > 0;
}

export function isWorkspaceModelCertifiedForSettings({
  modelId,
  settings,
  workflows,
}: {
  modelId: string;
  settings: Pick<WorkspaceShotSettings, 'presetId' | 'workflowType'>;
  workflows?: readonly WorkspaceWorkflowType[];
}): boolean {
  const presetId = workspacePresetIdForSettings(settings);
  if (!presetId) return false;
  const certifiedWorkflows = getWorkspaceCertifiedWorkflows({ modelId, presetId });
  const candidateWorkflows = workflows?.length ? workflows : [settings.workflowType];
  return candidateWorkflows.some((workflow) => certifiedWorkflows.includes(workflow));
}
