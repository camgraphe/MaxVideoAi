import { STORYBOARD_KLING_FIRST_FRAME_JOB_PREFIX } from '@/lib/storyboard-pricing';
import type { StoryboardStyle } from './storyboard-prompt';
import type { StoryboardShotPlan } from './storyboard-shot-plan';
import type { StoryboardOrientation } from './storyboard-templates';

export const KLING_STORYBOARD_FIRST_FRAME_JOB_PREFIX = STORYBOARD_KLING_FIRST_FRAME_JOB_PREFIX;

type KlingStoryboardFirstFramePromptInput = {
  subject: string;
  action: string;
  dialogue?: string;
  visualNotes?: string;
  style: StoryboardStyle;
  orientation: StoryboardOrientation;
  durationSec: number;
  frameCount: number;
  shotPlan?: StoryboardShotPlan;
  referenceImageCount?: number;
};

const STYLE_LABELS: Record<StoryboardStyle, string> = {
  realistic: 'realistic, natural lens language, production-ready detail',
  anime: 'anime production still, expressive pose, clean readable shape language',
  ugc: 'UGC opening frame, handheld social-video energy, natural creator framing',
  cinema: 'cinematic opening frame, controlled lighting, clear film composition',
};

const MAX_FIELD_CHARS = 900;
const MAX_DIALOGUE_CHARS = 380;

function normalizePromptLine(value: string | null | undefined): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function truncatePromptPart(value: string | null | undefined, maxChars = MAX_FIELD_CHARS): string {
  const normalized = normalizePromptLine(value);
  if (normalized.length <= maxChars) return normalized;
  const trimmed = normalized.slice(0, maxChars).replace(/\s+\S*$/, '').trim();
  return `${trimmed}...`;
}

export function buildKlingStoryboardFirstFramePrompt(input: KlingStoryboardFirstFramePromptInput): string {
  const aspectRatio = input.orientation === 'portrait' ? '9:16' : '16:9';
  const subject = truncatePromptPart(input.subject);
  const action = truncatePromptPart(input.action);
  const visualNotes = truncatePromptPart(input.visualNotes);
  const dialogue = truncatePromptPart(input.dialogue, MAX_DIALOGUE_CHARS);
  const firstShot = input.shotPlan?.shots[0] ?? null;
  const lines = [
    `Create one clean full-frame opening image for a ${input.durationSec}s Kling video in ${aspectRatio}.`,
    `Use the storyboard board reference to extract Panel 1 only, then expand that panel into a polished full-screen ${aspectRatio} first frame.`,
    'Do not include the storyboard board, panel grid, borders, gutters, labels, metadata rows, captions, speech bubbles, UI chrome, watermark, or prompt text.',
    'The image must look like the actual first frame of the final video, not like a storyboard sheet or contact sheet.',
    `Subject: ${subject || 'the main subject from Panel 1'}.`,
    action ? `Opening action intent: ${action}.` : null,
    visualNotes ? `Scene notes: ${visualNotes}.` : null,
    dialogue ? `Dialogue context for expression and timing only: ${dialogue}. Do not render subtitles or dialogue text.` : null,
    firstShot
      ? `Panel 1 plan: ${firstShot.title}. Framing: ${firstShot.framing}. Beat: ${firstShot.actionBeat}. Visual priority: ${firstShot.visualPriority}.`
      : null,
    input.referenceImageCount
      ? `Additional reference images after the storyboard preserve subject, product, wardrobe, packaging, material, style, or location details.`
      : null,
    `Style: ${STYLE_LABELS[input.style]}.`,
    'Prioritize a clear opening composition, stable identity, coherent lighting, and enough visual room for natural motion to continue.',
  ];

  return lines.filter((line): line is string => Boolean(line)).join('\n');
}
