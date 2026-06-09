import type { WorkspaceTemplate, WorkspaceTemplateSummary } from '../workspace-types';
import { createVariantWorkspaceTemplate, type WorkspaceTemplateVariantConfig } from './variant-base';

const STORYBOARD_TO_VIDEO_TEMPLATE_CONFIG: WorkspaceTemplateVariantConfig = {
    productTitle: 'Storyboard Frames',
    productFilename: 'six_panel_board.png',
    productUrl: '/storyboard/templates/storyboard-template-6.png',
    productDimensions: '1920x1080',
    styleTitle: 'Motion Board',
    styleFilename: 'animatic_reference.mp4',
    styleThumbUrl: '/storyboard/examples/storyboarder-product-reference.jpg',
    promptTitle: 'Panel Continuity',
    promptSubtitle: 'panel_timing.txt',
    promptRole: 'camera',
    promptText: 'Follow the storyboard order exactly. Use each panel as a beat, preserve screen direction, and make transitions feel like a planned animatic.',
    voiceTitle: 'Scene Notes',
    voiceText: 'Use the storyboard as timing authority: establish, push in, action beat, detail, transition, end frame.',
    audioTitle: 'Temp Score',
    audioFilename: 'storyboard_temp_score.mp3',
    shotSubtitles: ['Panel 01 Establish', 'Panel 02 Action', 'Panel 03 Insert', 'Panel 04 End Frame'],
    outputThumbs: ['/storyboard/templates/storyboard-template-6.png', '/hero/showcase-seedance-2-0.webp'],
    timelineTitles: ['Storyboard Beat 01', 'Storyboard Beat 02'],
  };

export function createStoryboardToVideoWorkspaceTemplate(summary: WorkspaceTemplateSummary): WorkspaceTemplate {
  return createVariantWorkspaceTemplate('storyboard-to-video', summary, STORYBOARD_TO_VIDEO_TEMPLATE_CONFIG);
}
