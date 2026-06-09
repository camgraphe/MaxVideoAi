import type { WorkspaceTemplate, WorkspaceTemplateSummary } from '../workspace-types';
import { createVariantWorkspaceTemplate, type WorkspaceTemplateVariantConfig } from './variant-base';

const UGC_AD_TEMPLATE_CONFIG: WorkspaceTemplateVariantConfig = {
    productTitle: 'Creator Reference',
    productFilename: 'creator_anchor.png',
    productUrl: '/assets/tools/character-builder-workspace.png',
    productDimensions: '1400x900',
    styleTitle: 'B-roll Reference',
    styleFilename: 'ugc_broll_style.mp4',
    styleThumbUrl: '/hero/best-for-fast-drafts-city.webp',
    promptTitle: 'Hook Script',
    promptSubtitle: 'ugc_hook.txt',
    promptRole: 'prompt',
    promptText: 'Open with a direct hook, show the product in use, cut to one proof point, then close with a clean visual payoff.',
    voiceTitle: 'Creator VO',
    voiceText: 'Conversational voiceover: fast hook, believable benefit, no over-polished ad language.',
    audioTitle: 'Social Bed',
    audioFilename: 'ugc_social_bed.mp3',
    shotSubtitles: ['Hook Opener', 'Product Proof', 'B-roll Detail', 'CTA Moment'],
    outputThumbs: ['/hero/best-for-fast-drafts-city.webp', '/assets/tools/character-builder-workspace.png'],
    timelineTitles: ['UGC Hook', 'Proof B-roll'],
  };

export function createUgcAdWorkspaceTemplate(summary: WorkspaceTemplateSummary): WorkspaceTemplate {
  return createVariantWorkspaceTemplate('ugc-ad', summary, UGC_AD_TEMPLATE_CONFIG);
}
