import type { WorkspaceTemplate, WorkspaceTemplateSummary } from '../workspace-types';
import type { WorkspaceTemplateBuildCopy } from './registry';
import { createVariantWorkspaceTemplate, type WorkspaceTemplateVariantConfig } from './variant-base';

const STORYBOARD_TO_VIDEO_TEMPLATE_CONFIG: WorkspaceTemplateVariantConfig = {
    productTitle: 'Storyboard Frames',
    productTitleCopyKey: 'templateStoryboardFrames',
    productFilename: 'six_panel_board.png',
    productUrl: '/storyboard/templates/storyboard-template-6.png',
    productDimensions: '1920x1080',
    styleTitle: 'Motion Board',
    styleTitleCopyKey: 'templateMotionBoard',
    styleFilename: 'animatic_reference.mp4',
    styleThumbUrl: '/storyboard/examples/storyboarder-product-reference.jpg',
    promptTitle: 'Panel Continuity',
    promptTitleCopyKey: 'templatePanelContinuity',
    promptSubtitle: 'panel_timing.txt',
    promptRole: 'camera',
    promptText: 'Follow the storyboard order exactly. Use each panel as a beat, preserve screen direction, and make transitions feel like a planned animatic.',
    promptTextCopyKey: 'templateStoryboardPromptText',
    voiceTitle: 'Scene Notes',
    voiceTitleCopyKey: 'templateSceneNotes',
    voiceText: 'Use the storyboard as timing authority: establish, push in, action beat, detail, transition, end frame.',
    voiceTextCopyKey: 'templateStoryboardVoicePromptText',
    audioTitle: 'Temp Score',
    audioTitleCopyKey: 'templateTempScore',
    audioFilename: 'storyboard_temp_score.mp3',
    shotSubtitles: ['Panel 01 Establish', 'Panel 02 Action', 'Panel 03 Insert', 'Panel 04 End Frame'],
    shotSubtitleCopyKeys: ['templatePanel01Establish', 'templatePanel02Action', 'templatePanel03Insert', 'templatePanel04EndFrame'],
    outputThumbs: ['/storyboard/templates/storyboard-template-6.png', '/hero/showcase-seedance-2-0.webp'],
    timelineTitles: ['Storyboard Beat 01', 'Storyboard Beat 02'],
    timelineTitleCopyKeys: ['templateStoryboardBeat01', 'templateStoryboardBeat02'],
  };

export function createStoryboardToVideoWorkspaceTemplate(summary: WorkspaceTemplateSummary, copy?: WorkspaceTemplateBuildCopy): WorkspaceTemplate {
  return createVariantWorkspaceTemplate('storyboard-to-video', summary, STORYBOARD_TO_VIDEO_TEMPLATE_CONFIG, copy);
}
