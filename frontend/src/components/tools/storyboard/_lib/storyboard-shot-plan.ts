import type { StoryboardStyle, StoryboardTargetModel } from './storyboard-prompt';

export type StoryboardShotPlanInput = {
  subject: string;
  action: string;
  dialogue?: string;
  style: StoryboardStyle;
  targetModel: StoryboardTargetModel;
  durationSec: number;
  frameCount: number;
  referenceImageCount?: number;
};

export type StoryboardShot = {
  id: string;
  panel: number;
  title: string;
  framing: string;
  actionBeat: string;
  visualPriority: string;
  dialogueBeat?: string;
};

export type StoryboardShotPlan = {
  summary: string;
  targetGuidance: string;
  styleGuidance: string;
  referenceGuidance?: string;
  shots: StoryboardShot[];
};

type ShotTemplate = {
  title: string;
  framing: string;
  actionBeat: string;
  visualPriority: string;
};

const SHOT_TEMPLATES: Record<4 | 6 | 8, ShotTemplate[]> = {
  4: [
    {
      title: 'Establishing context',
      framing: 'Wide frame that sets the space and visual world.',
      actionBeat: 'Introduce the subject before the main action starts.',
      visualPriority: 'Readable environment, consistent lighting, and clear subject placement.',
    },
    {
      title: 'Hero subject action',
      framing: 'Medium hero frame centered on the subject or product.',
      actionBeat: 'Show the key action in its cleanest readable moment.',
      visualPriority: 'Strong silhouette, stable identity, and clean product shape.',
    },
    {
      title: 'Detail reaction texture',
      framing: 'Close-up or detail insert.',
      actionBeat: 'Emphasize the tactile detail, emotional reaction, or material change.',
      visualPriority: 'Texture, material detail, facial/body reaction when appropriate, and reference continuity.',
    },
    {
      title: 'End frame',
      framing: 'Resolved final composition.',
      actionBeat: 'Land the payoff as a clear final frame for video generation.',
      visualPriority: 'Final product/person position, clean composition, and no text overlays.',
    },
  ],
  6: [
    {
      title: 'Establishing context',
      framing: 'Wide frame that sets the space and visual world.',
      actionBeat: 'Introduce the scene and continuity direction.',
      visualPriority: 'Readable location, stable subject placement, and clear lighting.',
    },
    {
      title: 'Subject setup',
      framing: 'Medium frame that isolates the product, character, or object.',
      actionBeat: 'Prepare the viewer for the action with a clean setup pose.',
      visualPriority: 'Subject identity, product shape, and reference continuity.',
    },
    {
      title: 'Main action',
      framing: 'Medium-to-close frame focused on the action path.',
      actionBeat: 'Show the central movement or interaction at peak clarity.',
      visualPriority: 'Motion readability, hands/props when present, and consistent subject design.',
    },
    {
      title: 'Detail texture reaction',
      framing: 'Close-up, macro, or reaction insert.',
      actionBeat: 'Show the important material detail, transformation, or emotional beat.',
      visualPriority: 'Texture, packaging, color, expression, and reference-linked details.',
    },
    {
      title: 'Transition payoff',
      framing: 'Secondary angle that connects action to final result.',
      actionBeat: 'Bridge the main action into the final reveal.',
      visualPriority: 'Continuity of motion and stable scene geometry.',
    },
    {
      title: 'End frame',
      framing: 'Final hero frame with a clean resolved composition.',
      actionBeat: 'Finish on the clearest usable end state.',
      visualPriority: 'Final identity, product readability, and no captions or UI chrome.',
    },
  ],
  8: [
    {
      title: 'Establishing context',
      framing: 'Wide frame that sets the space and visual world.',
      actionBeat: 'Open the sequence with clear context.',
      visualPriority: 'Readable location, lighting, and subject position.',
    },
    {
      title: 'Subject setup',
      framing: 'Medium frame with the subject or product ready for action.',
      actionBeat: 'Prepare the subject and establish continuity.',
      visualPriority: 'Identity, product shape, wardrobe/packaging, and reference continuity.',
    },
    {
      title: 'Main action',
      framing: 'Medium action frame.',
      actionBeat: 'Start the main movement or interaction.',
      visualPriority: 'Clear motion path and stable subject design.',
    },
    {
      title: 'Detail texture',
      framing: 'Close-up or macro insert.',
      actionBeat: 'Focus on tactile, material, packaging, or facial/body detail.',
      visualPriority: 'Texture, color, material cues, and reference-linked details.',
    },
    {
      title: 'Secondary angle',
      framing: 'Alternate camera angle that keeps continuity.',
      actionBeat: 'Show the action from a fresh but coherent perspective.',
      visualPriority: 'Camera continuity, stable geometry, and clean subject silhouette.',
    },
    {
      title: 'Reaction transformation',
      framing: 'Close or medium reaction frame.',
      actionBeat: 'Show the response, transformation, or emotional beat.',
      visualPriority: 'Expression, body performance, product state, and reference consistency.',
    },
    {
      title: 'Payoff',
      framing: 'Hero frame that presents the result.',
      actionBeat: 'Reveal the payoff before the final frame.',
      visualPriority: 'Clean result, strong composition, and stable lighting.',
    },
    {
      title: 'End frame',
      framing: 'Final resolved composition.',
      actionBeat: 'End on a frame that can anchor the video generation.',
      visualPriority: 'Final identity, product readability, and no captions or UI chrome.',
    },
  ],
};

const STYLE_GUIDANCE: Record<StoryboardStyle, string> = {
  realistic: 'Realistic style: natural continuity, practical lens language, stable physical detail.',
  anime: 'Anime style: expressive poses, clean production-board clarity, stylized motion beats.',
  ugc: 'UGC style: handheld social-video energy, creator framing, natural reaction beats.',
  cinema: 'Cinema style: controlled lighting, stronger lens language, clear start/middle/end staging.',
};

const TARGET_GUIDANCE: Record<StoryboardTargetModel, string> = {
  seedance: 'Seedance target: no real people, no celebrity likenesses, favor product, cooking, props, animation-safe, stylized or non-human subjects.',
  kling: 'Kling target: realistic people and human scenes are allowed when requested, avoiding unlicensed celebrity likenesses.',
};

function normalizeFrameCount(frameCount: number): 4 | 6 | 8 {
  if (frameCount === 4 || frameCount === 6 || frameCount === 8) return frameCount;
  if (frameCount < 6) return 4;
  if (frameCount > 6) return 8;
  return 6;
}

function parseDialogue(dialogue?: string): string[] {
  if (!dialogue?.trim()) return [];
  return dialogue
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function assignDialogue(shots: StoryboardShot[], dialogueLines: string[]): StoryboardShot[] {
  if (!dialogueLines.length || shots.length < 3) return shots;
  const start = 1;
  const end = shots.length - 2;
  const availableSlots = Math.max(1, end - start + 1);

  return shots.map((shot, index) => {
    if (index < start || index > end) return shot;
    const dialogueIndex = index - start;
    if (dialogueIndex >= dialogueLines.length) return shot;
    if (dialogueIndex >= availableSlots) return shot;
    return {
      ...shot,
      dialogueBeat: dialogueLines[dialogueIndex],
    };
  });
}

export function buildStoryboardShotPlan(input: StoryboardShotPlanInput): StoryboardShotPlan {
  const frameCount = normalizeFrameCount(input.frameCount);
  const subject = input.subject.trim() || 'the subject';
  const action = input.action.trim() || 'the requested action';
  const styleGuidance = STYLE_GUIDANCE[input.style];
  const targetGuidance = TARGET_GUIDANCE[input.targetModel];
  const referenceGuidance = input.referenceImageCount
    ? `Use ${input.referenceImageCount} reference images to preserve identity, product shape, packaging, material, color, location, and style cues.`
    : undefined;
  const dialogueLines = parseDialogue(input.dialogue);
  const referenceSuffix = referenceGuidance ? ' Preserve reference-linked details.' : '';

  const shots = SHOT_TEMPLATES[frameCount].map<StoryboardShot>((template, index) => ({
    id: `panel-${index + 1}`,
    panel: index + 1,
    title: template.title,
    framing: template.framing,
    actionBeat: `${template.actionBeat} Subject: ${subject}. Action: ${action}.`,
    visualPriority: `${template.visualPriority}${referenceSuffix}`,
  }));

  return {
    summary: `${frameCount} panel ${input.durationSec}s storyboard plan for ${input.targetModel === 'seedance' ? 'Seedance' : 'Kling'}.`,
    targetGuidance,
    styleGuidance,
    referenceGuidance,
    shots: assignDialogue(shots, dialogueLines),
  };
}
