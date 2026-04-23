import { getFalEngineById, getFalEngineBySlug, type FalEngineEntry } from '@/config/falEngines';
import { DEFAULT_ENGINE_GUIDE } from '@/lib/engine-guides';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { normalizeEngineId } from '@/lib/engine-alias';
import type { SeoWatchVideoConfig } from '@/config/video-seo-watchlist';
import type { GalleryVideo } from '@/server/videos';

type RawRecord = Record<string, unknown>;

type ParsedSnapshot = {
  surface: string | null;
  engineId: string | null;
  engineLabel: string | null;
  inputMode: string | null;
  prompt: string;
  negativePrompt: string | null;
  core: {
    durationSec: number | null;
    aspectRatio: string | null;
    resolution: string | null;
    fps: number | null;
    iterationCount: number | null;
    audio: boolean | null;
  };
  advanced: {
    shotType: string | null;
    seed: number | null;
    cameraFixed: boolean | null;
    multiPromptCount: number;
    voiceIdsCount: number;
    voiceControl: boolean;
  };
  refs: {
    imageUrl: string | null;
    audioUrl: string | null;
    referenceImagesCount: number;
    referenceVideosCount: number;
    firstFrameUrl: string | null;
    lastFrameUrl: string | null;
    endImageUrl: string | null;
  };
};

export type WatchPageIntent =
  | 'image-to-video'
  | 'first-last-frame'
  | 'multi-shot'
  | 'camera-motion'
  | 'product-ad'
  | 'audio-enabled'
  | 'prompt-example';

export type WatchPageRelatedLink = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  engineLabel: string;
  thumbUrl?: string;
  score: number;
  reason: string;
};

export type WatchPageDerivedSignals = {
  title: string;
  metaTitle: string;
  metaDescription: string;
  videoDescription: string;
  intro: string;
  promptText: string;
  promptPreview: string;
  negativePrompt: string | null;
  engineLabel: string;
  engineSlug: string | null;
  engineFamily: string | null;
  exampleFamily: string | null;
  exampleFamilyLabel: string | null;
  mode: string | null;
  modeLabel: string;
  durationSec: number | null;
  aspectRatio: string | null;
  resolution: string | null;
  fps: number | null;
  hasAudio: boolean;
  primaryIntent: WatchPageIntent;
  capabilityTags: string[];
  styleTags: string[];
  badges: string[];
  whatThisShows: string[];
  detailRows: Array<{ key: string; label: string; value: string }>;
  promptRows: Array<{ key: string; label: string; value: string }>;
  inputRows: Array<{ key: string; label: string; value: string }>;
  parentPath: string | null;
  parentLabel: string | null;
  modelPath: string | null;
  modelLabel: string | null;
  recreatePath: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
  engineDescription: string;
  engineBadges: string[];
  completenessScore: number;
  differentiationScore: number;
  indexable: boolean;
  auditNotes: string[];
  stabilityWarnings: string[];
};

type CandidateRow = {
  entry: SeoWatchVideoConfig;
  video: GalleryVideo;
  signals: WatchPageDerivedSignals;
};

const MODE_LABELS: Record<string, string> = {
  t2v: 'Text to video',
  i2v: 'Image to video',
  r2v: 'Reference to video',
  a2v: 'Audio to video',
  extend: 'Video extend',
  retake: 'Video retake',
};

const STYLE_PATTERNS: Array<{ tag: string; label: string; patterns: RegExp[] }> = [
  { tag: 'cinematic', label: 'cinematic', patterns: [/\bcinematic\b/i, /\bfilm(ic)?\b/i, /\bdramatic\b/i] },
  { tag: 'realistic', label: 'realistic', patterns: [/\brealistic\b/i, /\bphotoreal/i, /\bdocumentary\b/i] },
  { tag: 'anime', label: 'anime', patterns: [/\banime\b/i, /\bmanga\b/i] },
  { tag: 'portrait', label: 'portrait', patterns: [/\bportrait\b/i, /\bhead\s?shot\b/i, /\bclose[- ]up\b/i] },
  { tag: 'commercial', label: 'commercial', patterns: [/\bcommercial\b/i, /\bproduct ad\b/i, /\bad spot\b/i] },
];

const DESCRIPTOR_PATTERNS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: 'luxury perfume commercial', patterns: [/\bperfume\b/i, /\bluxury\b/i] },
  { label: 'smartwatch runner ad', patterns: [/\bsmartwatch\b/i, /\brunner\b/i] },
  { label: 'office transition', patterns: [/\boffice\b/i, /\btransition\b/i] },
  { label: 'city-to-studio flythrough', patterns: [/\bcity\b/i, /\bstudio\b/i, /\bflythrough\b/i] },
  { label: 'living room commercial', patterns: [/\bliving room\b/i, /\bcommercial\b/i] },
  { label: 'studio interview push-in', patterns: [/\binterview\b/i, /\bpush[- ]?in\b/i] },
  { label: 'futuristic city flythrough', patterns: [/\bfuturistic city\b/i, /\bdrone\b/i] },
  { label: 'cinematic walk toward camera', patterns: [/\bwalk toward camera\b/i] },
  { label: 'night city flythrough', patterns: [/\bnight\b/i, /\bcity\b/i, /\bflythrough\b/i] },
  { label: 'moody portrait turn', patterns: [/\bportrait\b/i, /\bturn\b/i] },
  { label: 'hallway escape', patterns: [/\bhallway\b/i, /\bescape\b/i] },
  { label: 'window transition', patterns: [/\bwindow\b/i, /\btransition\b/i] },
];

const CAMERA_PATTERNS: Array<{ tag: string; label: string; patterns: RegExp[] }> = [
  { tag: 'camera-move', label: 'camera move', patterns: [/\bcamera move/i, /\bcamera motion/i] },
  { tag: 'push-in', label: 'push-in', patterns: [/\bpush[- ]?in\b/i] },
  { tag: 'tracking', label: 'tracking', patterns: [/\btracking\b/i] },
  { tag: 'drone', label: 'drone', patterns: [/\bdrone\b/i, /\baerial\b/i, /\bfpv\b/i, /\bflythrough\b/i] },
  { tag: 'close-up', label: 'close-up', patterns: [/\bclose[- ]?up\b/i] },
  { tag: 'transition', label: 'transition', patterns: [/\btransition\b/i] },
];

const CLUSTER_LABEL_OVERRIDES: Record<string, string> = {
  sora: 'Sora',
  veo: 'Veo',
  kling: 'Kling',
  wan: 'Wan',
  seedance: 'Seedance',
  ltx: 'LTX',
  pika: 'Pika',
  hailuo: 'Hailuo',
};

function asRecord(value: unknown): RawRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RawRecord) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function formatClusterLabel(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return CLUSTER_LABEL_OVERRIDES[normalized] ?? normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatModeLabel(mode?: string | null): string {
  if (!mode) return 'Video generation';
  return MODE_LABELS[mode] ?? 'Video generation';
}

function formatPromptPreview(prompt: string, maxLength = 220): string {
  const clean = prompt.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Prompt unavailable.';
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(1, maxLength - 1)).trim()}…`;
}

function truncateText(value: string, maxLength: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const slice = clean.slice(0, Math.max(1, maxLength - 1));
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 60 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

function parseSnapshot(video: GalleryVideo): ParsedSnapshot {
  const raw = asRecord(video.settingsSnapshot);
  const core = asRecord(raw?.core);
  const advanced = asRecord(raw?.advanced);
  const refs = asRecord(raw?.refs);
  const prompt = asString(raw?.prompt) ?? video.prompt ?? '';

  return {
    surface: asString(raw?.surface) ?? 'video',
    engineId: asString(raw?.engineId) ?? video.engineId ?? null,
    engineLabel: asString(raw?.engineLabel) ?? video.engineLabel ?? null,
    inputMode: asString(raw?.inputMode) ?? 't2v',
    prompt,
    negativePrompt: asString(raw?.negativePrompt),
    core: {
      durationSec: asNumber(core?.durationSec) ?? video.durationSec ?? null,
      aspectRatio: asString(core?.aspectRatio) ?? video.aspectRatio ?? null,
      resolution: asString(core?.resolution),
      fps: asNumber(core?.fps),
      iterationCount: asNumber(core?.iterationCount),
      audio: asBoolean(core?.audio),
    },
    advanced: {
      shotType: asString(advanced?.shotType),
      seed: asNumber(advanced?.seed),
      cameraFixed: asBoolean(advanced?.cameraFixed),
      multiPromptCount: asArray(advanced?.multiPrompt).filter((entry) => asRecord(entry)?.prompt).length,
      voiceIdsCount: asArray(advanced?.voiceIds).map(asString).filter(Boolean).length,
      voiceControl: Boolean(advanced?.voiceControl),
    },
    refs: {
      imageUrl: asString(refs?.imageUrl),
      audioUrl: asString(refs?.audioUrl),
      referenceImagesCount: asArray(refs?.referenceImages).map(asString).filter(Boolean).length,
      referenceVideosCount: asArray(refs?.videoUrls).map(asString).filter(Boolean).length,
      firstFrameUrl: asString(refs?.firstFrameUrl),
      lastFrameUrl: asString(refs?.lastFrameUrl),
      endImageUrl: asString(refs?.endImageUrl),
    },
  };
}

function resolveEngineEntry(engineId?: string | null): FalEngineEntry | null {
  if (!engineId) return null;
  const normalized = normalizeEngineId(engineId) ?? engineId;
  return getFalEngineById(normalized) ?? getFalEngineBySlug(normalized) ?? null;
}

function extractStyleTags(prompt: string, explicitTags: readonly string[] = []): string[] {
  const tags = new Set(explicitTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  STYLE_PATTERNS.forEach((entry) => {
    if (entry.patterns.every((pattern) => pattern.test(prompt))) {
      tags.add(entry.tag);
      return;
    }
    if (entry.patterns.some((pattern) => pattern.test(prompt))) {
      tags.add(entry.tag);
    }
  });
  return Array.from(tags);
}

function extractDescriptor(prompt: string): string | null {
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  for (const entry of DESCRIPTOR_PATTERNS) {
    if (entry.patterns.every((pattern) => pattern.test(normalized))) {
      return entry.label;
    }
  }
  const camera = CAMERA_PATTERNS.find((entry) => entry.patterns.some((pattern) => pattern.test(normalized)))?.label;
  const scene =
    [
      { pattern: /\boffice\b/i, label: 'office' },
      { pattern: /\bliving room\b/i, label: 'living room' },
      { pattern: /\bstudio\b/i, label: 'studio' },
      { pattern: /\bnight city\b/i, label: 'night city' },
      { pattern: /\bcity\b/i, label: 'city' },
      { pattern: /\bstreet\b/i, label: 'street' },
      { pattern: /\bapartment\b/i, label: 'apartment' },
      { pattern: /\bhallway\b/i, label: 'hallway' },
      { pattern: /\bbedroom\b/i, label: 'bedroom' },
      { pattern: /\bportrait\b/i, label: 'portrait' },
    ].find((entry) => entry.pattern.test(normalized))?.label ?? null;

  if (scene && camera === 'transition') return `${scene} transition`;
  if (scene && camera === 'drone') return `${scene} flythrough`;
  if (scene && camera) return `${scene} ${camera}`;
  if (scene) return scene;

  const compact = normalized
    .replace(/[.,;:()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(' ');
  return compact || null;
}

function buildCapabilityTags(snapshot: ParsedSnapshot, video: GalleryVideo, explicitTags: readonly string[] = []): string[] {
  const tags = new Set(explicitTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  const mode = snapshot.inputMode ?? 't2v';
  if (mode === 'i2v') tags.add('image-to-video');
  if (mode === 't2v') tags.add('text-to-video');
  if (mode === 'r2v') tags.add('reference-to-video');
  if (mode === 'a2v') tags.add('audio-to-video');
  if (snapshot.core.audio || video.hasAudio) tags.add('audio-enabled');
  if (snapshot.advanced.multiPromptCount > 1) tags.add('multi-shot');
  if (snapshot.refs.firstFrameUrl && snapshot.refs.lastFrameUrl) tags.add('first-last-frame');
  if (snapshot.refs.imageUrl) tags.add('reference-image');
  if (snapshot.refs.referenceImagesCount > 0) tags.add('reference-images');
  if (snapshot.refs.referenceVideosCount > 0) tags.add('reference-video');
  if (snapshot.refs.audioUrl) tags.add('audio-input');
  if (snapshot.advanced.cameraFixed) tags.add('camera-lock');
  if (snapshot.advanced.voiceIdsCount > 0 || snapshot.advanced.voiceControl) tags.add('voice-control');
  CAMERA_PATTERNS.forEach((entry) => {
    if (entry.patterns.some((pattern) => pattern.test(snapshot.prompt))) {
      tags.add(entry.tag);
    }
  });
  return Array.from(tags);
}

function pickPrimaryIntent(capabilityTags: string[], styleTags: string[]): WatchPageIntent {
  if (capabilityTags.includes('first-last-frame')) return 'first-last-frame';
  if (capabilityTags.includes('image-to-video')) return 'image-to-video';
  if (capabilityTags.includes('multi-shot')) return 'multi-shot';
  if (capabilityTags.includes('push-in') || capabilityTags.includes('tracking') || capabilityTags.includes('drone')) {
    return 'camera-motion';
  }
  if (styleTags.includes('commercial')) return 'product-ad';
  if (capabilityTags.includes('audio-enabled')) return 'audio-enabled';
  return 'prompt-example';
}

function titlePattern(intent: WatchPageIntent, engineLabel: string, descriptor: string): string {
  switch (intent) {
    case 'first-last-frame':
      return `${engineLabel} first and last frame example: ${descriptor}`;
    case 'image-to-video':
      return `${engineLabel} image-to-video example: ${descriptor}`;
    case 'multi-shot':
      return `${engineLabel} multi-shot prompt example: ${descriptor}`;
    case 'camera-motion':
      return `${engineLabel} camera movement example: ${descriptor}`;
    case 'product-ad':
      return `${engineLabel} product ad example: ${descriptor}`;
    case 'audio-enabled':
      return `${engineLabel} audio-enabled video example: ${descriptor}`;
    default:
      return `${engineLabel} video example: ${descriptor}`;
  }
}

function humanizeCapability(tag: string): string {
  switch (tag) {
    case 'image-to-video':
      return 'Image-to-video workflow';
    case 'text-to-video':
      return 'Text-to-video workflow';
    case 'reference-to-video':
      return 'Reference-to-video workflow';
    case 'audio-to-video':
      return 'Audio-to-video workflow';
    case 'audio-enabled':
      return 'Audio-enabled output';
    case 'multi-shot':
      return 'Multi-shot prompt structure';
    case 'first-last-frame':
      return 'First and last frame control';
    case 'reference-image':
      return 'Single reference image';
    case 'reference-images':
      return 'Reference images';
    case 'reference-video':
      return 'Reference video';
    case 'audio-input':
      return 'Audio input';
    case 'camera-lock':
      return 'Camera lock';
    case 'voice-control':
      return 'Voice controls';
    case 'push-in':
      return 'Push-in camera move';
    case 'tracking':
      return 'Tracking camera move';
    case 'drone':
      return 'Drone or flythrough move';
    case 'close-up':
      return 'Close-up framing';
    case 'transition':
      return 'Transition cue';
    default:
      return tag;
  }
}

function buildWhatThisShows(
  snapshot: ParsedSnapshot,
  capabilityTags: string[],
  styleTags: string[],
  descriptor: string | null
): string[] {
  const items: string[] = [];
  items.push(humanizeCapability(snapshot.inputMode === 'i2v' ? 'image-to-video' : snapshot.inputMode === 'r2v' ? 'reference-to-video' : 'text-to-video'));
  if (snapshot.core.durationSec) {
    const aspect = snapshot.core.aspectRatio ? ` in ${snapshot.core.aspectRatio}` : '';
    items.push(`${snapshot.core.durationSec}-second render${aspect}`);
  }
  capabilityTags
    .filter((tag) => !['text-to-video', 'image-to-video', 'reference-to-video'].includes(tag))
    .slice(0, 3)
    .forEach((tag) => items.push(humanizeCapability(tag)));
  if (styleTags.length) {
    items.push(`${styleTags[0].charAt(0).toUpperCase() + styleTags[0].slice(1)} styling`);
  }
  if (descriptor) {
    items.push(`Scene focus: ${descriptor}`);
  }
  return Array.from(new Set(items)).slice(0, 5);
}

function buildDetailRows(
  video: GalleryVideo,
  snapshot: ParsedSnapshot,
  engineLabel: string
): Array<{ key: string; label: string; value: string }> {
  const rows: Array<{ key: string; label: string; value: string }> = [
    { key: 'engine', label: 'Engine', value: engineLabel },
    { key: 'mode', label: 'Mode', value: formatModeLabel(snapshot.inputMode) },
  ];
  if (snapshot.core.durationSec) rows.push({ key: 'duration', label: 'Duration', value: `${snapshot.core.durationSec}s` });
  if (snapshot.core.aspectRatio) rows.push({ key: 'aspectRatio', label: 'Aspect ratio', value: snapshot.core.aspectRatio });
  if (snapshot.core.resolution) rows.push({ key: 'resolution', label: 'Resolution', value: snapshot.core.resolution });
  if (snapshot.core.fps) rows.push({ key: 'fps', label: 'FPS', value: `${snapshot.core.fps}` });
  rows.push({ key: 'audio', label: 'Audio', value: snapshot.core.audio || video.hasAudio ? 'Enabled' : 'Off' });
  if (typeof video.finalPriceCents === 'number' && video.currency) {
    rows.push({
      key: 'cost',
      label: 'Render cost',
      value: new Intl.NumberFormat('en-US', { style: 'currency', currency: video.currency }).format(video.finalPriceCents / 100),
    });
  }
  rows.push({ key: 'created', label: 'Created', value: new Date(video.createdAt).toISOString().slice(0, 10) });
  return rows;
}

function buildPromptRows(snapshot: ParsedSnapshot): Array<{ key: string; label: string; value: string }> {
  const rows: Array<{ key: string; label: string; value: string }> = [];
  if (snapshot.negativePrompt) rows.push({ key: 'negative', label: 'Negative prompt', value: snapshot.negativePrompt });
  if (snapshot.advanced.shotType) rows.push({ key: 'shotType', label: 'Shot type', value: snapshot.advanced.shotType });
  if (typeof snapshot.advanced.cameraFixed === 'boolean') {
    rows.push({ key: 'cameraFixed', label: 'Camera lock', value: snapshot.advanced.cameraFixed ? 'On' : 'Off' });
  }
  if (snapshot.advanced.multiPromptCount > 1) {
    rows.push({ key: 'multiPrompt', label: 'Multi-prompt scenes', value: `${snapshot.advanced.multiPromptCount}` });
  }
  if (snapshot.advanced.seed != null) rows.push({ key: 'seed', label: 'Seed', value: `${snapshot.advanced.seed}` });
  return rows;
}

function buildInputRows(snapshot: ParsedSnapshot): Array<{ key: string; label: string; value: string }> {
  const rows: Array<{ key: string; label: string; value: string }> = [];
  if (snapshot.refs.imageUrl) rows.push({ key: 'image', label: 'Reference image', value: 'Provided' });
  if (snapshot.refs.referenceImagesCount > 0) {
    rows.push({
      key: 'referenceImages',
      label: 'Reference images',
      value: `${snapshot.refs.referenceImagesCount}`,
    });
  }
  if (snapshot.refs.referenceVideosCount > 0) {
    rows.push({
      key: 'referenceVideos',
      label: 'Reference videos',
      value: `${snapshot.refs.referenceVideosCount}`,
    });
  }
  if (snapshot.refs.firstFrameUrl) rows.push({ key: 'firstFrame', label: 'First frame', value: 'Provided' });
  if (snapshot.refs.lastFrameUrl) rows.push({ key: 'lastFrame', label: 'Last frame', value: 'Provided' });
  if (snapshot.refs.endImageUrl) rows.push({ key: 'endImage', label: 'End frame', value: 'Provided' });
  if (snapshot.refs.audioUrl) rows.push({ key: 'audioInput', label: 'Audio input', value: 'Provided' });
  return rows;
}

function likelyExpiringMediaUrl(value?: string | null): boolean {
  if (!value) return false;
  return /[?&](x-amz-|expires=|signature=|token=|googleaccessid=)/i.test(value);
}

function buildEngineBadges(engineEntry: FalEngineEntry | null): string[] {
  if (!engineEntry) return [];
  const guide = DEFAULT_ENGINE_GUIDE[engineEntry.modelSlug];
  if (guide?.badges?.length) return guide.badges.slice(0, 3);

  const badges: string[] = [];
  if (engineEntry.engine.modes.includes('i2v')) badges.push('Image input');
  if (engineEntry.engine.modes.includes('r2v')) badges.push('Reference video');
  if (engineEntry.engine.audio) badges.push('Audio option');
  if (engineEntry.engine.motionControls) badges.push('Motion controls');
  if (engineEntry.engine.maxDurationSec) badges.push(`${engineEntry.engine.maxDurationSec}s max`);
  return badges.slice(0, 3);
}

export function deriveWatchPageSignals(params: {
  entry?: SeoWatchVideoConfig | null;
  video: GalleryVideo;
}): WatchPageDerivedSignals {
  const { entry, video } = params;
  const snapshot = parseSnapshot(video);
  const engineEntry = resolveEngineEntry(entry?.engineSlug ?? snapshot.engineId ?? video.engineId);
  const engineSlug = engineEntry?.modelSlug ?? entry?.engineSlug ?? normalizeEngineId(video.engineId ?? '') ?? null;
  const engineLabel = engineEntry?.marketingName ?? entry?.engineLabel ?? video.engineLabel ?? 'AI video engine';
  const exampleFamily = entry?.exampleFamily ?? resolveExampleCanonicalSlug(entry?.engineSlug ?? engineSlug ?? video.engineId ?? null);
  const exampleFamilyLabel = formatClusterLabel(exampleFamily ?? entry?.engineFamily ?? null);
  const modelPath = engineEntry?.seo.canonicalPath ?? (entry?.sourceType === 'models' ? entry.sourcePath : null);
  const parentPath = exampleFamily ? `/examples/${exampleFamily}` : modelPath ?? entry?.sourcePath ?? '/examples';
  const parentLabel = exampleFamilyLabel ? `Browse ${exampleFamilyLabel} video examples` : 'Browse video examples';
  const modelLabel = `Open ${engineLabel} model page`;
  const promptText = snapshot.prompt || video.prompt || '';
  const promptPreview = formatPromptPreview(promptText);
  const styleTags = extractStyleTags(promptText, entry?.styleTags ?? []);
  const capabilityTags = buildCapabilityTags(snapshot, video, entry?.capabilityTags ?? []);
  const primaryIntent = (entry?.videoPrimaryIntent as WatchPageIntent | undefined) ?? pickPrimaryIntent(capabilityTags, styleTags);
  const descriptor = extractDescriptor(promptText) ?? 'generated scene';
  const title = truncateText(entry?.seoTitleOverride ?? titlePattern(primaryIntent, engineLabel, descriptor), 86);
  const metaTitle = truncateText(entry?.seoTitleOverride ?? entry?.seoTitle ?? title, 86);
  const introSentences = [
    `This ${engineLabel} ${formatModeLabel(snapshot.inputMode).toLowerCase()} example shows ${descriptor}.`,
    (() => {
      const claims: string[] = [];
      if (capabilityTags.includes('multi-shot')) claims.push('multi-shot prompting');
      if (capabilityTags.includes('first-last-frame')) claims.push('first and last frame control');
      if (capabilityTags.includes('reference-images')) claims.push('reference images');
      if (capabilityTags.includes('audio-enabled')) claims.push('audio-enabled output');
      if (capabilityTags.includes('drone') || capabilityTags.includes('push-in') || capabilityTags.includes('tracking')) {
        claims.push('camera motion control');
      }
      const head = claims.length ? `It highlights ${claims.slice(0, 2).join(' and ')}` : `It shows how ${engineLabel} handles this prompt`;
      const tailParts = [
        snapshot.core.durationSec ? `${snapshot.core.durationSec}-second timing` : null,
        snapshot.core.aspectRatio ? snapshot.core.aspectRatio : null,
        snapshot.core.resolution ? snapshot.core.resolution : null,
      ].filter(Boolean);
      return tailParts.length ? `${head} with ${tailParts.join(' · ')} output.` : `${head}.`;
    })(),
  ];
  const intro = truncateText(entry?.seoSummaryOverride ?? introSentences.join(' '), 240);
  const metaDescription = truncateText(`${intro} Prompt: ${promptPreview}`, 170);
  const videoDescription = truncateText(`${intro} ${promptPreview}`, 280);
  const badges = [
    engineLabel,
    formatModeLabel(snapshot.inputMode),
    snapshot.core.durationSec ? `${snapshot.core.durationSec}s` : null,
    snapshot.core.aspectRatio ?? null,
    capabilityTags.includes('audio-enabled') ? 'Audio' : null,
    capabilityTags.includes('multi-shot') ? 'Multi-shot' : null,
    capabilityTags.includes('first-last-frame') ? 'First/Last frame' : null,
  ]
    .filter((value): value is string => Boolean(value))
    .slice(0, 5);
  const whatThisShows = buildWhatThisShows(snapshot, capabilityTags, styleTags, descriptor);
  const detailRows = buildDetailRows(video, snapshot, engineLabel);
  const promptRows = buildPromptRows(snapshot);
  const inputRows = buildInputRows(snapshot);
  const completenessScore = [
    video.videoUrl ? 25 : 0,
    video.thumbUrl ? 15 : 0,
    promptText.trim().length >= 24 ? 10 : 0,
    snapshot.surface === 'video' ? 10 : 0,
    modelPath ? 10 : 0,
    parentPath ? 10 : 0,
    detailRows.length >= 6 ? 10 : 0,
    whatThisShows.length >= 3 ? 10 : 0,
  ].reduce((sum, value) => sum + value, 0);
  const differentiationScore = [
    descriptor && descriptor !== 'generated scene' ? 25 : 0,
    styleTags.length ? 15 : 0,
    capabilityTags.filter((tag) => !['text-to-video', 'image-to-video'].includes(tag)).length >= 1 ? 20 : 0,
    inputRows.length ? 20 : 0,
    promptRows.length ? 10 : 0,
    snapshot.core.resolution ? 10 : 0,
  ].reduce((sum, value) => sum + value, 0);
  const auditNotes: string[] = [];
  if (!video.videoUrl) auditNotes.push('Missing primary video asset.');
  if (!video.thumbUrl) auditNotes.push('Missing thumbnail asset.');
  if (promptText.trim().length < 24) auditNotes.push('Prompt is too thin for a differentiated watch page.');
  if (whatThisShows.length < 3) auditNotes.push('Derived summary is still too sparse.');
  const stabilityWarnings = [
    likelyExpiringMediaUrl(video.videoUrl) ? 'Video URL looks signed or temporary.' : null,
    likelyExpiringMediaUrl(video.thumbUrl) ? 'Thumbnail URL looks signed or temporary.' : null,
  ].filter((value): value is string => Boolean(value));
  const indexable =
    Boolean(video.videoUrl) &&
    Boolean(video.thumbUrl) &&
    promptText.trim().length >= 24 &&
    completenessScore >= 50 &&
    (entry?.watchPageEligible ?? true);
  const engineGuide = engineEntry && DEFAULT_ENGINE_GUIDE[engineEntry.modelSlug];
  const engineDescription = engineGuide?.description ?? engineEntry?.seo.description ?? 'Open the engine page for specs, controls, and pricing.';
  const engineBadges = buildEngineBadges(engineEntry);

  return {
    title,
    metaTitle,
    metaDescription,
    videoDescription,
    intro,
    promptText,
    promptPreview,
    negativePrompt: snapshot.negativePrompt,
    engineLabel,
    engineSlug,
    engineFamily: entry?.engineFamily ?? exampleFamily ?? null,
    exampleFamily,
    exampleFamilyLabel,
    mode: snapshot.inputMode,
    modeLabel: formatModeLabel(snapshot.inputMode),
    durationSec: snapshot.core.durationSec,
    aspectRatio: snapshot.core.aspectRatio,
    resolution: snapshot.core.resolution,
    fps: snapshot.core.fps,
    hasAudio: Boolean(snapshot.core.audio ?? video.hasAudio),
    primaryIntent,
    capabilityTags,
    styleTags,
    badges,
    whatThisShows,
    detailRows,
    promptRows,
    inputRows,
    parentPath,
    parentLabel,
    modelPath,
    modelLabel,
    recreatePath: `/app?from=${encodeURIComponent(video.id)}`,
    breadcrumbs: exampleFamilyLabel
      ? [
          { label: 'Home', href: '/' },
          { label: 'Examples', href: '/examples' },
          { label: exampleFamilyLabel, href: parentPath },
          { label: title },
        ]
      : [
          { label: 'Home', href: '/' },
          { label: 'Models', href: '/models' },
          { label: engineLabel, href: modelPath ?? undefined },
          { label: title },
        ],
    engineDescription,
    engineBadges,
    completenessScore,
    differentiationScore,
    indexable,
    auditNotes,
    stabilityWarnings,
  };
}

function overlapCount(left: string[], right: string[]): number {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).length;
}

export function pickRelatedWatchPages(params: {
  currentId: string;
  currentSignals: WatchPageDerivedSignals;
  candidates: CandidateRow[];
  limit?: number;
}): WatchPageRelatedLink[] {
  const { currentId, currentSignals, candidates, limit = 4 } = params;
  const scored = candidates
    .filter((candidate) => candidate.entry.id !== currentId)
    .map((candidate) => {
      let score = 0;
      const reasons: string[] = [];

      if (candidate.signals.exampleFamily && candidate.signals.exampleFamily === currentSignals.exampleFamily) {
        score += 4;
        reasons.push('Same example family');
      }
      if (candidate.signals.primaryIntent === currentSignals.primaryIntent) {
        score += 3;
        reasons.push('Same watch-page intent');
      }
      const capabilityOverlap = overlapCount(candidate.signals.capabilityTags, currentSignals.capabilityTags);
      if (capabilityOverlap > 0) {
        score += Math.min(3, capabilityOverlap * 1.5);
        reasons.push('Shared capability');
      }
      if (candidate.signals.engineSlug && candidate.signals.engineSlug === currentSignals.engineSlug) {
        score += 2;
        reasons.push('Same engine');
      }
      if (candidate.signals.mode && candidate.signals.mode === currentSignals.mode) {
        score += 1.5;
      }
      const styleOverlap = overlapCount(candidate.signals.styleTags, currentSignals.styleTags);
      if (styleOverlap > 0) {
        score += Math.min(2, styleOverlap);
      }

      return {
        id: candidate.entry.id,
        href: `/video/${encodeURIComponent(candidate.entry.id)}`,
        title: candidate.signals.title,
        subtitle: candidate.signals.intro,
        engineLabel: candidate.signals.engineLabel,
        thumbUrl: candidate.video.thumbUrl,
        score,
        reason: reasons[0] ?? 'Related example',
        engineSlug: candidate.signals.engineSlug,
        exampleFamily: candidate.signals.exampleFamily,
      };
    })
    .filter((candidate) => candidate.score >= 3)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'en'));

  const picked: WatchPageRelatedLink[] = [];
  const engineCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();

  for (const candidate of scored) {
    if (picked.length >= limit) break;
    const engineCount = candidate.engineSlug ? engineCounts.get(candidate.engineSlug) ?? 0 : 0;
    const familyCount = candidate.exampleFamily ? familyCounts.get(candidate.exampleFamily) ?? 0 : 0;
    if (candidate.engineSlug && engineCount >= 2) continue;
    if (candidate.exampleFamily && familyCount >= 2) continue;
    picked.push(candidate);
    if (candidate.engineSlug) engineCounts.set(candidate.engineSlug, engineCount + 1);
    if (candidate.exampleFamily) familyCounts.set(candidate.exampleFamily, familyCount + 1);
  }

  return picked;
}
