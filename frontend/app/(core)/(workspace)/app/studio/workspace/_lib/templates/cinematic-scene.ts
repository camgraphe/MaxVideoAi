import type { WorkspaceTemplate, WorkspaceTemplateSummary } from '../workspace-types';
import type { WorkspaceTemplateBuildCopy } from './registry';
import { createVariantWorkspaceTemplate, type WorkspaceTemplateVariantConfig } from './variant-base';

const CINEMATIC_SCENE_TEMPLATE_CONFIG: WorkspaceTemplateVariantConfig = {
    productTitle: 'Mood Plate',
    productTitleCopyKey: 'templateMoodPlate',
    productFilename: 'cinematic_mood.png',
    productUrl: '/hero/best-for-cinematic-realism.webp',
    productDimensions: '1920x1080',
    styleTitle: 'Camera Language',
    styleTitleCopyKey: 'templateCameraLanguage',
    styleFilename: 'trailer_motion_ref.mp4',
    styleThumbUrl: '/hero/kling-3-4k-demo.jpg',
    promptTitle: 'Scene Prompt',
    promptTitleCopyKey: 'templateScenePrompt',
    promptSubtitle: 'trailer_scene.txt',
    promptRole: 'scene_description',
    promptText: 'Build a cinematic trailer beat: wide establishing image, controlled camera push, character reveal, atmosphere, and dramatic final frame.',
    promptTextCopyKey: 'templateCinematicScenePromptText',
    voiceTitle: 'Trailer VO',
    voiceTitleCopyKey: 'templateTrailerVo',
    voiceText: 'Sparse narration with tension: one line before the reveal, one line on the final frame.',
    voiceTextCopyKey: 'templateCinematicVoicePromptText',
    audioTitle: 'Trailer Pulse',
    audioTitleCopyKey: 'templateTrailerPulse',
    audioFilename: 'trailer_pulse.wav',
    shotSubtitles: ['Wide Establishing', 'Character Reveal', 'Action Insert', 'Final Frame'],
    shotSubtitleCopyKeys: ['templateWideEstablishing', 'templateCharacterReveal', 'templateActionInsert', 'templateFinalFrame'],
    outputThumbs: ['/hero/best-for-cinematic-realism.webp', '/hero/showcase-kling-3-pro.webp'],
    timelineTitles: ['Trailer Establish', 'Trailer Reveal'],
    timelineTitleCopyKeys: ['templateTrailerEstablish', 'templateTrailerReveal'],
  };

export function createCinematicSceneWorkspaceTemplate(summary: WorkspaceTemplateSummary, copy?: WorkspaceTemplateBuildCopy): WorkspaceTemplate {
  return createVariantWorkspaceTemplate('cinematic-scene', summary, CINEMATIC_SCENE_TEMPLATE_CONFIG, copy);
}
