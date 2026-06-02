export type StoryboardStyle = 'realistic' | 'anime' | 'ugc' | 'cinema';
export type StoryboardTargetModel = 'seedance' | 'kling';

export type StoryboardPromptInput = {
  subject: string;
  action: string;
  style: StoryboardStyle;
  targetModel: StoryboardTargetModel;
  durationSec: number;
  frameCount: number;
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
    `Style: ${STYLE_PROMPTS[input.style]}.`,
    targetGuidance,
    editInstruction ? `Edit request: ${editInstruction}.` : null,
    'Make the board immediately usable as an image reference: no UI chrome, no captions, no speech bubbles, no prompt text, no watermark.',
    'Prioritize readable staging, stable subject identity, coherent lighting, and clear start/middle/end motion beats.',
  ]
    .filter(Boolean)
    .join('\n');
}
