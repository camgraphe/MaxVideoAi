import type { StoryboardShotPlan } from './storyboard-shot-plan';

export type StoryboardStyle = 'realistic' | 'anime' | 'ugc' | 'cinema';
export type StoryboardTargetModel = 'seedance' | 'kling';

export type StoryboardPromptInput = {
  subject: string;
  action: string;
  dialogue?: string;
  style: StoryboardStyle;
  targetModel: StoryboardTargetModel;
  durationSec: number;
  frameCount: number;
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
  const editInstruction = input.editInstruction?.trim();
  const targetGuidance =
    input.targetModel === 'seedance'
      ? 'Target: Seedance. Do not include real people, celebrity likenesses, or photoreal human faces. Use products, cooking objects, film props, animation-safe characters, stylized silhouettes, or non-human subjects.'
      : 'Target: Kling. Real people are allowed when requested, but avoid celebrity likenesses unless explicitly licensed.';

  return [
    `Create one storyboard reference image for a ${input.durationSec}s AI video.`,
    `Use ${input.frameCount} clearly separated panels with consistent continuity from left to right.`,
    `Subject: ${subject}.`,
    action ? `Action: ${action}.` : null,
    dialogue
      ? `Dialogue/audio direction: ${dialogue}. Use this only to plan dialogue timing, emotion, mouth and body performance, reaction beats, and audio pacing. Do not draw dialogue text, captions, subtitles, or speech bubbles inside the storyboard image.`
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
      }.`
    ) ?? []),
    editInstruction ? `Edit request: ${editInstruction}.` : null,
    'Make the board immediately usable as an image reference: no UI chrome, no captions, no speech bubbles, no prompt text, no watermark.',
    'Prioritize readable staging, stable subject identity, coherent lighting, and clear start/middle/end motion beats.',
  ]
    .filter(Boolean)
    .join('\n');
}
