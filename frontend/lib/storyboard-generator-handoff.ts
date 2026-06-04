export const STORYBOARD_GENERATOR_HANDOFF_STORAGE_KEY = 'maxvideoai.storyboard.generatorHandoff.v1';

export type StoryboardGeneratorTargetModel = 'seedance' | 'kling';
export type StoryboardGeneratorOrientation = 'landscape' | 'portrait';

export type StoryboardGeneratorHandoff = {
  version: 1;
  engineId: 'seedance-2-0' | 'kling-o3-pro';
  mode: 'ref2v';
  referenceFieldId: 'image_urls';
  imageUrl: string;
  thumbUrl?: string | null;
  jobId?: string | null;
  targetModel: StoryboardGeneratorTargetModel;
  prompt: string;
  audioEnabled: boolean;
  durationSec: number;
  frameCount: number;
  aspectRatio: '16:9' | '9:16';
  width?: number | null;
  height?: number | null;
  createdAt: number;
};

export type BuildStoryboardGeneratorHandoffOptions = {
  targetModel: StoryboardGeneratorTargetModel;
  imageUrl: string;
  thumbUrl?: string | null;
  jobId?: string | null;
  subject?: string | null;
  action?: string | null;
  dialogue?: string | null;
  durationSec: number;
  frameCount: number;
  orientation: StoryboardGeneratorOrientation;
  width?: number | null;
  height?: number | null;
};

export type StoryboardGeneratorHandoffDraft = {
  targetModel?: StoryboardGeneratorTargetModel | null;
  subject?: string | null;
  action?: string | null;
  dialogue?: string | null;
  durationSec?: number | null;
  frameCount?: number | null;
  orientation?: StoryboardGeneratorOrientation | null;
  audioEnabled?: boolean;
};

export type StoryboardGeneratorDraftContext = {
  durationSec?: number | null;
  aspectRatio?: string | null;
  width?: number | null;
  height?: number | null;
};

const STORYBOARD_GENERATOR_PROMPT_MAX_CHARS = 2400;
const STORYBOARD_GENERATOR_SUBJECT_MAX_CHARS = 420;
const STORYBOARD_GENERATOR_ACTION_MAX_CHARS = 720;
const STORYBOARD_GENERATOR_DIALOGUE_MAX_CHARS = 520;

function normalizeOptionalText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePromptLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripFinalSentencePunctuation(value: string): string {
  return value.trim().replace(/[.。]+$/u, '').trim();
}

function extractPromptLine(prompt: string, label: string): string | null {
  const prefix = `${label}:`.toLowerCase();
  const line = prompt
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.toLowerCase().startsWith(prefix));
  if (!line) return null;
  return line.slice(label.length + 1).trim() || null;
}

function normalizeDraftField(value: string | null): string | null {
  if (!value) return null;
  const normalized = stripFinalSentencePunctuation(normalizePromptLine(value));
  return normalized || null;
}

function normalizeDraftDialogue(value: string | null): string | null {
  if (!value) return null;
  const withoutPlanningSuffix = value
    .replace(/\.\s+Use this to plan dialogue timing[\s\S]*$/i, '')
    .replace(/\s+Use this to plan dialogue timing[\s\S]*$/i, '');
  return normalizeDraftField(withoutPlanningSuffix);
}

function truncatePromptPart(value: string, maxChars: number): string {
  const normalized = normalizePromptLine(value);
  if (normalized.length <= maxChars) return normalized;
  const trimmed = normalized.slice(0, maxChars).replace(/\s+\S*$/, '').trim();
  return `${trimmed}...`;
}

function enforcePromptLimit(prompt: string): string {
  if (prompt.length <= STORYBOARD_GENERATOR_PROMPT_MAX_CHARS) return prompt;
  const trimmed = prompt
    .slice(0, STORYBOARD_GENERATOR_PROMPT_MAX_CHARS - 34)
    .replace(/\s+\S*$/, '')
    .trim();
  return `${trimmed}\n[trimmed for generator limit]`;
}

function resolveStoryboardGeneratorEngineId(targetModel: StoryboardGeneratorTargetModel): StoryboardGeneratorHandoff['engineId'] {
  return targetModel === 'kling' ? 'kling-o3-pro' : 'seedance-2-0';
}

function resolveStoryboardAspectRatio(orientation: StoryboardGeneratorOrientation): StoryboardGeneratorHandoff['aspectRatio'] {
  return orientation === 'portrait' ? '9:16' : '16:9';
}

function resolveStoryboardOrientationFromContext(
  context: StoryboardGeneratorDraftContext
): StoryboardGeneratorOrientation | null {
  if (context.aspectRatio === '9:16') return 'portrait';
  if (context.aspectRatio === '16:9') return 'landscape';
  if (typeof context.width === 'number' && typeof context.height === 'number' && context.width > 0 && context.height > 0) {
    return context.height > context.width ? 'portrait' : 'landscape';
  }
  return null;
}

export function hasExplicitStoryboardDialogue(value: string | null | undefined): boolean {
  const normalized = normalizePromptLine(normalizeOptionalText(value)).toLowerCase();
  if (!normalized) return false;
  const hasDirectSpeech = /\b(spoken|speaks?|talks?|dialogue|direct-to-camera|line|lines|conversation)\b/.test(normalized);
  if (hasExplicitStoryboardSilence(normalized, hasDirectSpeech)) return false;
  return true;
}

function hasExplicitStoryboardSilence(value: string | null | undefined, hasDirectSpeechOverride?: boolean): boolean {
  const normalized = normalizePromptLine(normalizeOptionalText(value)).toLowerCase();
  if (!normalized) return false;
  const hasDirectSpeech =
    hasDirectSpeechOverride ??
    /\b(spoken|speaks?|talks?|dialogue|direct-to-camera|line|lines|conversation)\b/.test(normalized);
  if (/\bsilent\b/.test(normalized)) return true;
  if (/\bno\s+(dialogue|spoken|speech|audio)\b/.test(normalized)) return true;
  if (/\bwithout\s+(dialogue|spoken|speech|audio)\b/.test(normalized)) return true;
  if (/\bno\s+(voiceover|voice-over)\b/.test(normalized) && !hasDirectSpeech) return true;
  if (/\bwithout\s+(voiceover|voice-over)\b/.test(normalized) && !hasDirectSpeech) return true;
  return false;
}

function resolveStoryboardGeneratorAudioEnabled(
  targetModel: StoryboardGeneratorTargetModel,
  dialogueOrPrompt: string | null | undefined
): boolean {
  if (hasExplicitStoryboardSilence(dialogueOrPrompt)) return false;
  if (targetModel === 'kling') return true;
  return hasExplicitStoryboardDialogue(dialogueOrPrompt);
}

export function extractStoryboardGeneratorDraftFromPrompt(
  prompt: string | null | undefined,
  context: StoryboardGeneratorDraftContext = {}
): StoryboardGeneratorHandoffDraft {
  const source = normalizeOptionalText(prompt);
  const targetLine = extractPromptLine(source, 'Target');
  const targetModel = /^kling\b/i.test(targetLine ?? '')
    ? 'kling'
    : /^seedance\b/i.test(targetLine ?? '')
      ? 'seedance'
      : null;
  const promptOrientation =
    /Format:\s*Portrait\s+9:16/i.test(source)
      ? 'portrait'
      : /Format:\s*Landscape\s+16:9/i.test(source)
        ? 'landscape'
        : null;
  const durationMatch = source.match(/reference image for a\s+(\d+)s\s+AI video/i);
  const frameCountMatch = source.match(/Use\s+(\d+)\s+clearly separated panels/i);
  const dialogue = normalizeDraftDialogue(extractPromptLine(source, 'Dialogue/audio direction'));

  return {
    targetModel,
    subject: normalizeDraftField(extractPromptLine(source, 'Subject')),
    action: normalizeDraftField(extractPromptLine(source, 'Action')),
    dialogue,
    durationSec: durationMatch ? Math.max(1, Number(durationMatch[1])) : context.durationSec ?? null,
    frameCount: frameCountMatch ? Math.max(1, Number(frameCountMatch[1])) : null,
    orientation: promptOrientation ?? resolveStoryboardOrientationFromContext(context),
    audioEnabled: targetModel ? resolveStoryboardGeneratorAudioEnabled(targetModel, dialogue) : hasExplicitStoryboardDialogue(dialogue),
  };
}

function isFalMediaUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'fal.media' || hostname.endsWith('.fal.media');
  } catch {
    return false;
  }
}

function resolveStoryboardReferenceImageUrl(options: BuildStoryboardGeneratorHandoffOptions): string {
  const imageUrl = options.imageUrl.trim();
  const thumbUrl = normalizeOptionalText(options.thumbUrl);
  if (isFalMediaUrl(imageUrl) && /^https?:\/\//i.test(thumbUrl)) {
    return thumbUrl;
  }
  return imageUrl;
}

function buildStoryboardGeneratorPrompt(options: BuildStoryboardGeneratorHandoffOptions): string {
  const subject = truncatePromptPart(normalizeOptionalText(options.subject), STORYBOARD_GENERATOR_SUBJECT_MAX_CHARS);
  const action = truncatePromptPart(normalizeOptionalText(options.action), STORYBOARD_GENERATOR_ACTION_MAX_CHARS);
  const dialogue = truncatePromptPart(normalizeOptionalText(options.dialogue), STORYBOARD_GENERATOR_DIALOGUE_MAX_CHARS);
  const aspectRatio = resolveStoryboardAspectRatio(options.orientation);
  const targetLabel = options.targetModel === 'kling' ? 'Kling' : 'Seedance';
  const isKling = options.targetModel === 'kling';
  const referenceInstruction = isKling
    ? 'Use @Image1 only as a planning board for shot order, framing, camera intent, action beats, and pacing, not as the first frame.'
    : 'Follow the uploaded storyboard reference image as the structural guide for the video.';
  const cleanStartInstruction = isKling
    ? 'Start the video with a clean full-screen shot of the requested subject and action; do not show @Image1 as a board, contact sheet, panel grid, layout, or reference sheet.'
    : null;
  const artifactInstruction = isKling
    ? 'Do not reproduce storyboard labels, panel numbers, metadata rows, captions, handwritten text, borders, gutters, or grid lines from @Image1 inside the final video.'
    : 'Do not reproduce storyboard labels, panel numbers, metadata rows, captions, or handwritten text from the reference image inside the final video.';
  const lines = [
    referenceInstruction,
    `Target model: ${targetLabel}. Duration: ${options.durationSec}s. Format: ${aspectRatio}.`,
    `Use the ${options.frameCount} storyboard panels as the shot order: preserve each panel's framing, shot type, camera intent, action beat, dialogue timing, and visual continuity.`,
    cleanStartInstruction,
    'Animate the scene naturally between panels while keeping the same subject, product, environment, lighting direction, and composition logic.',
    artifactInstruction,
  ].filter((line): line is string => Boolean(line));

  if (subject) {
    lines.push(`Subject summary: ${subject}`);
  }
  if (action) {
    lines.push(`Action summary: ${action}`);
  }
  if (dialogue) {
    lines.push(`Dialogue/audio summary: ${dialogue}`);
  }

  return enforcePromptLimit(lines.join('\n'));
}

export function buildStoryboardGeneratorHandoff(
  options: BuildStoryboardGeneratorHandoffOptions
): StoryboardGeneratorHandoff {
  const imageUrl = resolveStoryboardReferenceImageUrl(options);
  if (!imageUrl) {
    throw new Error('A storyboard image URL is required.');
  }

  return {
    version: 1,
    engineId: resolveStoryboardGeneratorEngineId(options.targetModel),
    mode: 'ref2v',
    referenceFieldId: 'image_urls',
    imageUrl,
    thumbUrl: options.thumbUrl ?? null,
    jobId: options.jobId ?? null,
    targetModel: options.targetModel,
    prompt: buildStoryboardGeneratorPrompt(options),
    audioEnabled: resolveStoryboardGeneratorAudioEnabled(options.targetModel, options.dialogue),
    durationSec: Math.max(1, Math.round(options.durationSec)),
    frameCount: Math.max(1, Math.round(options.frameCount)),
    aspectRatio: resolveStoryboardAspectRatio(options.orientation),
    width: typeof options.width === 'number' && Number.isFinite(options.width) ? Math.round(options.width) : null,
    height: typeof options.height === 'number' && Number.isFinite(options.height) ? Math.round(options.height) : null,
    createdAt: Date.now(),
  };
}

export function buildStoryboardGeneratorHandoffUrl(handoff: StoryboardGeneratorHandoff): string {
  const params = new URLSearchParams({
    engine: handoff.engineId,
    mode: handoff.mode,
    storyboard: '1',
  });
  return `/app?${params.toString()}`;
}

export function parseStoryboardGeneratorHandoff(value: string | null | undefined): StoryboardGeneratorHandoff | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(value) as Partial<StoryboardGeneratorHandoff> | null;
    if (!raw || raw.version !== 1) return null;
    if (raw.engineId !== 'seedance-2-0' && raw.engineId !== 'kling-o3-pro') return null;
    if (raw.mode !== 'ref2v') return null;
    if (raw.referenceFieldId !== 'image_urls') return null;
    if (raw.targetModel !== 'seedance' && raw.targetModel !== 'kling') return null;
    if (typeof raw.imageUrl !== 'string' || !raw.imageUrl.trim()) return null;
    if (typeof raw.prompt !== 'string' || !raw.prompt.trim()) return null;
    const audioEnabled =
      typeof raw.audioEnabled === 'boolean'
        ? raw.audioEnabled
        : resolveStoryboardGeneratorAudioEnabled(raw.targetModel, raw.prompt);
    if (typeof raw.durationSec !== 'number' || !Number.isFinite(raw.durationSec)) return null;
    if (typeof raw.frameCount !== 'number' || !Number.isFinite(raw.frameCount)) return null;
    if (raw.aspectRatio !== '16:9' && raw.aspectRatio !== '9:16') return null;
    return {
      version: 1,
      engineId: raw.engineId,
      mode: 'ref2v',
      referenceFieldId: 'image_urls',
      imageUrl: raw.imageUrl.trim(),
      thumbUrl: typeof raw.thumbUrl === 'string' ? raw.thumbUrl : null,
      jobId: typeof raw.jobId === 'string' ? raw.jobId : null,
      targetModel: raw.targetModel,
      prompt: raw.prompt,
      audioEnabled,
      durationSec: Math.max(1, Math.round(raw.durationSec)),
      frameCount: Math.max(1, Math.round(raw.frameCount)),
      aspectRatio: raw.aspectRatio,
      width: typeof raw.width === 'number' && Number.isFinite(raw.width) ? Math.round(raw.width) : null,
      height: typeof raw.height === 'number' && Number.isFinite(raw.height) ? Math.round(raw.height) : null,
      createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    };
  } catch {
    return null;
  }
}
