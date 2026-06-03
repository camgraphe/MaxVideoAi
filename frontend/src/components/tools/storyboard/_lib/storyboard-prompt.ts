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

export function buildStoryboardPrompt(input: StoryboardPromptInput): string {
  const subject = input.subject.trim();
  const action = input.action.trim();
  const dialogue = input.dialogue?.trim();
  const visualNotes = input.visualNotes?.trim();
  const editInstruction = input.editInstruction?.trim();
  const orientation = input.orientation ?? 'landscape';
  const orientationGuidance =
    orientation === 'portrait'
      ? 'Format: Portrait 9:16 video storyboard. Compose each panel thumbnail as a vertical 9:16 frame for mobile/social video, with continuity readable from top to bottom and row by row.'
      : 'Format: Landscape 16:9 video storyboard. Compose each panel thumbnail as a horizontal 16:9 video frame, with continuity readable from left to right.';
  const targetGuidance =
    input.targetModel === 'seedance'
      ? 'Target: Seedance. Do not include real people, celebrity likenesses, or photoreal human faces. Use products, cooking objects, film props, animation-safe characters, stylized silhouettes, or non-human subjects.'
      : 'Target: Kling. Real people are allowed when requested, but avoid celebrity likenesses unless explicitly licensed.';

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
      ? `Dialogue/audio direction: ${dialogue}. Use this to plan dialogue timing, emotion, mouth and body performance, reaction beats, and audio pacing. Put dialogue text only in the Dialogue metadata row under the relevant thumbnail; do not draw captions, subtitles, or speech bubbles inside the thumbnail artwork.`
      : null,
    input.referenceImageCount
      ? `Use the ${input.referenceImageCount} uploaded reference images as visual anchors for characters, products, material details, colors, silhouettes, and settings. Preserve recognizable design cues while building the storyboard panels.`
      : null,
    `Style: ${STYLE_PROMPTS[input.style]}.`,
    targetGuidance,
    input.shotPlan ? 'Shot map:' : null,
    ...(input.shotPlan?.shots.map((shot) =>
      `Panel ${shot.panel}: ${shot.title}. Framing: ${shot.framing}. Beat: ${shot.actionBeat}. Visual priority: ${shot.visualPriority}${
        shot.dialogueBeat ? `. Dialogue beat: ${shot.dialogueBeat}` : ''
      }. Metadata rows: Shot type: ${shot.title}; Camera: ${shot.framing}; Action: ${shot.actionBeat}; Dialogue: ${
        shot.dialogueBeat ?? 'Silent / no dialogue'
      }.`
    ) ?? []),
    editInstruction ? `Edit request: ${editInstruction}.` : null,
    'Make the board immediately usable as an image reference: no UI chrome, no captions inside thumbnails, no speech bubbles, no extra prompt text, no watermark.',
    'Prioritize readable staging, stable subject identity, coherent lighting, and clear start/middle/end motion beats.',
  ]
    .filter(Boolean)
    .join('\n');
}
