import type { ImageGenerationResponse } from '@/types/image-generation';
import type { StoryboardRecentOutput } from '../_hooks/useStoryboardRecentOutputs';

export type StoryboardGeneratedImage = ImageGenerationResponse['images'][number];

export type KlingFirstFrameState = {
  storyboardJobId: string | null;
  storyboardUrl: string;
  image: StoryboardGeneratedImage;
  jobId: string | null;
};

export const KLING_FIRST_FRAME_STORAGE_KEY = 'maxvideoai.storyboard.klingFirstFrames.v1';

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  return typeof window === 'undefined' ? null : window.localStorage;
}

export function readStoredKlingFirstFrames(
  storage?: Storage | null,
  userId?: string
): Record<string, KlingFirstFrameState> {
  try {
    const targetStorage = resolveStorage(storage);
    if (!targetStorage) return {};
    const key = userId ? `${KLING_FIRST_FRAME_STORAGE_KEY}:${userId}` : KLING_FIRST_FRAME_STORAGE_KEY;
    const parsed = JSON.parse(targetStorage.getItem(key) ?? '{}') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, KlingFirstFrameState>;
  } catch {
    return {};
  }
}

export function writeStoredKlingFirstFrame(
  frame: KlingFirstFrameState,
  storage?: Storage | null,
  userId?: string
): void {
  if (!frame.storyboardJobId) return;
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return;
  const frames = readStoredKlingFirstFrames(targetStorage, userId);
  frames[frame.storyboardJobId] = frame;
  const key = userId ? `${KLING_FIRST_FRAME_STORAGE_KEY}:${userId}` : KLING_FIRST_FRAME_STORAGE_KEY;
  targetStorage.setItem(key, JSON.stringify(frames));
}

export function getStoredKlingFirstFrame(
  storyboardJobId: string | null,
  storyboardUrl: string,
  storage?: Storage | null,
  userId?: string
): KlingFirstFrameState | null {
  if (!storyboardJobId) return null;
  const frame = readStoredKlingFirstFrames(storage, userId)[storyboardJobId];
  if (!frame?.image?.url || frame.storyboardUrl !== storyboardUrl) return null;
  return frame;
}

export function buildKlingFirstFrameFromRecentOutput(
  output: StoryboardRecentOutput
): KlingFirstFrameState | null {
  const firstFrame = output.klingFirstFrame;
  if (!firstFrame?.url) return null;
  return {
    storyboardJobId: output.jobId,
    storyboardUrl: output.url,
    image: {
      url: firstFrame.url,
      thumbUrl: firstFrame.thumbUrl ?? firstFrame.previewUrl ?? null,
      width: firstFrame.width,
      height: firstFrame.height,
      mimeType: firstFrame.mime,
    },
    jobId: firstFrame.jobId,
  };
}
