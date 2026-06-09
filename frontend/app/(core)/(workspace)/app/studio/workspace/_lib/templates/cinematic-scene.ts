import type { WorkspaceTemplate, WorkspaceTemplateSummary } from '../workspace-types';
import { createVariantWorkspaceTemplate, type WorkspaceTemplateVariantConfig } from './variant-base';

const CINEMATIC_SCENE_TEMPLATE_CONFIG: WorkspaceTemplateVariantConfig = {
    productTitle: 'Mood Plate',
    productFilename: 'cinematic_mood.png',
    productUrl: '/hero/best-for-cinematic-realism.webp',
    productDimensions: '1920x1080',
    styleTitle: 'Camera Language',
    styleFilename: 'trailer_motion_ref.mp4',
    styleThumbUrl: '/hero/kling-3-4k-demo.jpg',
    promptTitle: 'Scene Prompt',
    promptSubtitle: 'trailer_scene.txt',
    promptRole: 'scene_description',
    promptText: 'Build a cinematic trailer beat: wide establishing image, controlled camera push, character reveal, atmosphere, and dramatic final frame.',
    voiceTitle: 'Trailer VO',
    voiceText: 'Sparse narration with tension: one line before the reveal, one line on the final frame.',
    audioTitle: 'Trailer Pulse',
    audioFilename: 'trailer_pulse.wav',
    shotSubtitles: ['Wide Establishing', 'Character Reveal', 'Action Insert', 'Final Frame'],
    outputThumbs: ['/hero/best-for-cinematic-realism.webp', '/hero/showcase-kling-3-pro.webp'],
    timelineTitles: ['Trailer Establish', 'Trailer Reveal'],
  };

export function createCinematicSceneWorkspaceTemplate(summary: WorkspaceTemplateSummary): WorkspaceTemplate {
  return createVariantWorkspaceTemplate('cinematic-scene', summary, CINEMATIC_SCENE_TEMPLATE_CONFIG);
}
