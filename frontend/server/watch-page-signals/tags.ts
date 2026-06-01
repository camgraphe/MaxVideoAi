import type { GalleryVideo } from '@/server/videos';
import { CAMERA_PATTERNS, STYLE_PATTERNS } from './constants';
import type { ParsedSnapshot, WatchPageIntent } from './types';

export function extractStyleTags(prompt: string, explicitTags: readonly string[] = []): string[] {
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

export function buildCapabilityTags(
  snapshot: ParsedSnapshot,
  video: GalleryVideo,
  explicitTags: readonly string[] = []
): string[] {
  const tags = new Set(explicitTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  const mode = snapshot.inputMode ?? 't2v';
  if (mode === 'i2v') tags.add('image-to-video');
  if (mode === 'fl2v') tags.add('first-last-frame');
  if (mode === 't2v') tags.add('text-to-video');
  if (mode === 'r2v' || mode === 'ref2v') tags.add('reference-to-video');
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

export function pickPrimaryIntent(capabilityTags: string[], styleTags: string[]): WatchPageIntent {
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
