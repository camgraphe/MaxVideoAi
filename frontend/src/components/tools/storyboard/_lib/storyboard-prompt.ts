import type { StoryboardShotPlan } from './storyboard-shot-plan';
import {
  STORYBOARD_PANEL_METADATA_FIELDS,
  STORYBOARD_THUMBNAIL_ASPECT_LABELS,
  type StoryboardOrientation,
} from './storyboard-templates';

export type StoryboardStyle = 'realistic' | 'anime' | 'ugc' | 'cinema';
export type StoryboardTargetModel = 'seedance' | 'kling';

export type StoryboardPromptInput = {
  subject: string;
  action: string;
  dialogue?: string;
  visualNotes?: string;
  style: StoryboardStyle;
  targetModel: StoryboardTargetModel;
  orientation: StoryboardOrientation;
  durationSec: number;
  frameCount: number;
  templateReference?: boolean;
  referenceImageCount?: number;
  shotPlan?: StoryboardShotPlan;
  editInstruction?: string | null;
};

const STYLE_PROMPTS: Record<StoryboardStyle, string> = {
  realistic: 'realistic product-film lighting, clean physical detail, production-ready reference frames',
  anime: 'anime production board, expressive composition, clean linework, color-script clarity',
  ugc: 'UGC ad storyboard, handheld social-video energy, natural framing, practical lighting',
  cinema: 'cinematic storyboard, film lighting, controlled lens language, strong shot progression',
};

const MAX_SUBJECT_CHARS = 2200;
const MAX_ACTION_CHARS = 2600;
const MAX_DIALOGUE_CHARS = 3000;
const MAX_VISUAL_NOTES_CHARS = 2000;
const MAX_EDIT_INSTRUCTION_CHARS = 1200;
const MAX_SHOT_DIALOGUE_CHARS = 450;

function neutralizeProviderSensitiveTerms(value: string): string {
  return value
    .replace(/\bbody language\b/gi, 'gesture language')
    .replace(/\bcelebrity likeness(?:es)?\b/gi, 'famous-person resemblance')
    .replace(/\bcelebrity\b/gi, 'famous person')
    .replace(/\blikeness(?:es)?\b/gi, 'resemblance')
    .replace(/\bvulgarity\b/gi, 'clean humor')
    .replace(/\bvulgar\b/gi, 'crude')
    .replace(/\bdrunk behavior\b/gi, 'messy behavior')
    .replace(/\bdrunk\b/gi, 'messy')
    .replace(/\binappropriate\b/gi, 'off-brand');
}

function truncatePromptField(value: string, maxChars: number): string {
  const trimmed = neutralizeProviderSensitiveTerms(value).trim();
  if (trimmed.length <= maxChars) return trimmed;
  const slice = trimmed.slice(0, maxChars).replace(/\s+\S*$/, '').trim();
  return `${slice} [trimmed for provider limit]`;
}

export function buildStoryboardPrompt(input: StoryboardPromptInput): string {
  const subject = truncatePromptField(input.subject, MAX_SUBJECT_CHARS);
  const action = truncatePromptField(input.action, MAX_ACTION_CHARS);
  const dialogue = input.dialogue?.trim() ? truncatePromptField(input.dialogue, MAX_DIALOGUE_CHARS) : undefined;
  const visualNotes = input.visualNotes?.trim()
    ? truncatePromptField(input.visualNotes, MAX_VISUAL_NOTES_CHARS)
    : undefined;
  const editInstruction = input.editInstruction?.trim()
    ? truncatePromptField(input.editInstruction, MAX_EDIT_INSTRUCTION_CHARS)
    : undefined;
  const orientation = input.orientation ?? 'landscape';
  const orientationGuidance =
    orientation === 'portrait'
      ? 'Format: Portrait 9:16 video storyboard. Compose each panel thumbnail as a vertical 9:16 frame for mobile/social video, with continuity readable from top to bottom and row by row.'
      : 'Format: Landscape 16:9 video storyboard. Compose each panel thumbnail as a horizontal 16:9 video frame, with continuity readable from left to right.';
  const targetGuidance =
    input.targetModel === 'seedance'
      ? 'Target: Seedance. Prioritize products, cooking objects, film props, places, animation-safe characters, stylized silhouettes, or non-human subjects. Keep any human presence generic and non-identifiable.'
      : 'Target: Kling experimental. Plan generic non-famous people for realistic human scenes when requested, avoiding famous-person resemblance. The generated board will be used to create a clean full-frame opening image, then as a storyboard reference for Kling.';

  return [
    `Create one storyboard reference image for a ${input.durationSec}s AI video.`,
    orientationGuidance,
    `Use ${input.frameCount} clearly separated panels with consistent continuity across the board.`,
    input.templateReference
      ? `Use the first reference image as a blank ${orientation} storyboard structure template. Fill the ${STORYBOARD_THUMBNAIL_ASPECT_LABELS[orientation]} thumbnail area in every panel with artwork, preserve the panel count, grid, gutters, orientation, aspect ratio, board boundaries, and the metadata rows below each thumbnail.`
      : null,
    `Under every thumbnail, fill exactly these metadata rows: ${STORYBOARD_PANEL_METADATA_FIELDS.join(', ')}. Keep each row short, practical, and readable.`,
    `Subject: ${subject}.`,
    action ? `Action: ${action}.` : null,
    visualNotes ? `Scene notes and constraints: ${visualNotes}.` : null,
    dialogue
      ? `Dialogue/audio direction: ${dialogue}. Use this to plan dialogue timing, emotion, expression, gesture performance, reaction beats, and audio pacing. Put dialogue text only in the Dialogue metadata row under the relevant thumbnail; do not draw captions, subtitles, or speech bubbles inside the thumbnail artwork.`
      : null,
    input.referenceImageCount
      ? `Use the ${input.referenceImageCount} uploaded reference images as visual anchors for characters, products, material details, colors, silhouettes, and settings. Preserve recognizable design cues while building the storyboard panels.`
      : null,
    `Style: ${STYLE_PROMPTS[input.style]}.`,
    targetGuidance,
    input.shotPlan ? 'Shot map:' : null,
    ...(input.shotPlan?.shots.map((shot) => {
      const dialogueBeat = shot.dialogueBeat
        ? truncatePromptField(shot.dialogueBeat, MAX_SHOT_DIALOGUE_CHARS)
        : null;
      return `Panel ${shot.panel}: ${shot.title}. Framing: ${shot.framing}. Beat: ${
        shot.actionBeat
      }. Visual priority: ${shot.visualPriority}${
        dialogueBeat ? `. Dialogue beat: ${dialogueBeat}` : ''
      }. Metadata rows: Shot type: ${shot.title}; Camera: ${shot.framing}; Action: ${
        shot.actionBeat
      }; Dialogue: ${dialogueBeat ?? 'Silent / no dialogue'}.`;
    }) ?? []),
    editInstruction ? `Edit request: ${editInstruction}.` : null,
    'Make the board immediately usable as an image reference: no UI chrome, no captions inside thumbnails, no speech bubbles, no extra prompt text, no watermark.',
    'Prioritize readable staging, stable subject identity, coherent lighting, and clear start/middle/end motion beats.',
  ]
    .filter(Boolean)
    .join('\n');
}
