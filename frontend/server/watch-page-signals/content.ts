import type { GalleryVideo } from '@/server/videos';
import { isStablePublicMediaUrl } from '@/lib/media';
import { CAMERA_PATTERNS, DESCRIPTOR_PATTERNS } from './constants';
import { formatModeLabel, truncateText } from './formatting';
import type { ParsedSnapshot, WatchPageIntent, WatchPageSourceImage } from './types';

export function extractDescriptor(prompt: string): string | null {
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

export function titlePattern(intent: WatchPageIntent, engineLabel: string, descriptor: string): string {
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

export function buildWhatThisShows(
  snapshot: ParsedSnapshot,
  capabilityTags: string[],
  styleTags: string[],
  descriptor: string | null
): string[] {
  const items: string[] = [];
  items.push(
    humanizeCapability(
      snapshot.inputMode === 'i2v' ? 'image-to-video' : snapshot.inputMode === 'r2v' ? 'reference-to-video' : 'text-to-video'
    )
  );
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

export function buildDetailRows(
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

export function buildPromptRows(snapshot: ParsedSnapshot): Array<{ key: string; label: string; value: string }> {
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

export function buildInputRows(snapshot: ParsedSnapshot): Array<{ key: string; label: string; value: string }> {
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

export function buildSourceImages(
  snapshot: ParsedSnapshot,
  options: {
    enabled: boolean;
    title: string;
    altContext?: string | null;
  }
): WatchPageSourceImage[] {
  if (!options.enabled) return [];

  const candidates = [
    { key: 'firstFrame', label: 'First frame', url: snapshot.refs.firstFrameUrl },
    { key: 'lastFrame', label: 'Last frame', url: snapshot.refs.lastFrameUrl },
    { key: 'referenceImage', label: 'Reference image', url: snapshot.refs.imageUrl },
    { key: 'endFrame', label: 'End frame', url: snapshot.refs.endImageUrl },
    ...snapshot.refs.referenceImages.map((url, index) => ({
      key: `storyboardFrame${index + 1}`,
      label: snapshot.refs.referenceImages.length > 1 ? `Storyboard frame ${index + 1}` : 'Storyboard frame',
      url,
    })),
  ];
  const seen = new Set<string>();
  const altContext = options.altContext ? truncateText(options.altContext, 140) : null;

  return candidates
    .flatMap((candidate) => {
      const url = candidate.url?.trim();
      if (!url || !isStablePublicMediaUrl(url) || seen.has(url)) return [];
      seen.add(url);
      return [
        {
          key: candidate.key,
          label: candidate.label,
          url,
          alt: altContext
            ? `${candidate.label} for ${options.title}. ${altContext}`
            : `${candidate.label} for ${options.title}`,
        },
      ];
    })
    .slice(0, 4);
}
