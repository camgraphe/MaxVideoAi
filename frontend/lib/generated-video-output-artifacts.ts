export type ReturnedVideoLastFrame = { url: string; mimeType: 'image/jpeg'; sha256: string;
  sizeBytes: number; width: number; height: number };
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export type VideoOutputPreparationState = 'active' | 'manual_review';
/** An original checkpoint is recoverable media, not a completed output projection. */
export function generatedVideoOutputPreparationState(snapshot: unknown, originalUrl: string | null | undefined,
  providerJobId: string | null | undefined, status?: string | null): VideoOutputPreparationState | undefined {
  const output = record(record(snapshot).byteplusDurableOutput);
  if (!originalUrl || output.videoUrl !== originalUrl || !providerJobId || output.providerJobId !== providerJobId) return undefined;
  if (status === 'provider_polling_stalled') return 'manual_review';
  return ['pending','queued','running','processing','in_progress'].includes(status ?? '') ? 'active' : undefined;
}
export function readReturnedVideoLastFrame(value: unknown): ReturnedVideoLastFrame | null {
  const frame = record(value);
  if (typeof frame.url !== 'string' || !/^https:\/\//i.test(frame.url) || frame.mimeType !== 'image/jpeg'
    || typeof frame.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(frame.sha256)
    || ![frame.sizeBytes, frame.width, frame.height].every(number => typeof number === 'number' && Number.isSafeInteger(number) && number > 0)) return null;
  return frame as ReturnedVideoLastFrame;
}
/** Read only artifacts bound to this original and accepted provider task. */
export function generatedVideoArtifactProjection(snapshot: unknown, originalUrl: string | null | undefined,
  providerJobId?: string | null): { playbackVideoUrl?: string; lastFrameUrl?: string } {
  const output = record(record(snapshot).byteplusDurableOutput);
  if (!originalUrl || output.videoUrl !== originalUrl || (providerJobId !== undefined && output.providerJobId !== providerJobId)) return {};
  const frame = readReturnedVideoLastFrame(output.lastFrame);
  return {
    ...(typeof output.playbackVideoUrl === 'string' && /^https:\/\//i.test(output.playbackVideoUrl) ? { playbackVideoUrl: output.playbackVideoUrl } : {}),
    ...(frame ? { lastFrameUrl: frame.url } : {}),
  };
}

type ArtifactUrls = { videoUrl?: string | null; playbackVideoUrl?: string | null; lastFrameUrl?: string | null };
/** Client artifacts never survive replacement of the original they describe. */
export function mergeVideoArtifactUrls(previous: ArtifactUrls, next: ArtifactUrls): { playbackVideoUrl?: string; lastFrameUrl?: string } {
  const changed = Boolean(next.videoUrl && previous.videoUrl && next.videoUrl !== previous.videoUrl);
  const playbackVideoUrl = next.playbackVideoUrl ?? (changed ? undefined : previous.playbackVideoUrl);
  const lastFrameUrl = next.lastFrameUrl ?? (changed ? undefined : previous.lastFrameUrl);
  return {
    ...(playbackVideoUrl || previous.playbackVideoUrl ? { playbackVideoUrl: playbackVideoUrl ?? undefined } : {}),
    ...(lastFrameUrl || previous.lastFrameUrl ? { lastFrameUrl: lastFrameUrl ?? undefined } : {}),
  };
}
