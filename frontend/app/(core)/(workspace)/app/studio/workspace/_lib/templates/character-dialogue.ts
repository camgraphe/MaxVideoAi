import type { WorkspaceTemplate, WorkspaceTemplateSummary } from '../workspace-types';
import type { WorkspaceTemplateBuildCopy } from './registry';
import { createVariantWorkspaceTemplate, type WorkspaceTemplateVariantConfig } from './variant-base';

const CHARACTER_DIALOGUE_TEMPLATE_CONFIG: WorkspaceTemplateVariantConfig = {
    productTitle: 'Character Anchor',
    productTitleCopyKey: 'templateCharacterAnchor',
    productFilename: 'character_anchor.png',
    productUrl: '/assets/blog/character-builder/consistent-character-portrait-anchor.webp',
    productDimensions: '1024x1536',
    styleTitle: 'Performance Reference',
    styleTitleCopyKey: 'templatePerformanceReference',
    styleFilename: 'dialogue_tone.mp4',
    styleThumbUrl: '/assets/blog/character-builder/ai-character-sheet-portrait-anchor.webp',
    promptTitle: 'Dialogue Direction',
    promptTitleCopyKey: 'templateDialogueDirection',
    promptSubtitle: 'dialogue_prompt.txt',
    promptRole: 'dialogue',
    promptText: 'A close, emotional two-line exchange. Keep the same character identity, soft eye movement, natural pauses, and grounded delivery.',
    promptTextCopyKey: 'templateCharacterDialoguePromptText',
    voiceTitle: 'Voice Cue',
    voiceTitleCopyKey: 'templateVoiceCue',
    voiceText: 'A quiet but decisive voiceover that bridges both shots without breaking character continuity.',
    voiceTextCopyKey: 'templateCharacterVoicePromptText',
    audioTitle: 'Room Tone',
    audioTitleCopyKey: 'templateRoomTone',
    audioFilename: 'dialogue_room_tone.wav',
    shotSubtitles: ['Character Close-up', 'Reverse Angle', 'Reaction Beat', 'Final Line'],
    shotSubtitleCopyKeys: ['templateCharacterCloseUp', 'templateReverseAngle', 'templateReactionBeat', 'templateFinalLine'],
    outputThumbs: ['/assets/blog/character-builder/consistent-character-portrait-anchor.webp', '/hero/showcase-veo-3-1.webp'],
    timelineTitles: ['Dialogue Close-up', 'Reaction Beat'],
    timelineTitleCopyKeys: ['templateDialogueCloseUp', 'templateReactionBeat'],
  };

export function createCharacterDialogueWorkspaceTemplate(summary: WorkspaceTemplateSummary, copy?: WorkspaceTemplateBuildCopy): WorkspaceTemplate {
  return createVariantWorkspaceTemplate('character-dialogue', summary, CHARACTER_DIALOGUE_TEMPLATE_CONFIG, copy);
}
