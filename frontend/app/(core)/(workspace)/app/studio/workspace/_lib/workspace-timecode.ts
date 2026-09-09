export function secondsToWorkspaceFrame(seconds: number, fps: number): number {
  const safeFps = Number.isFinite(fps) && fps > 0 ? Math.round(fps) : 24;
  return Math.max(0, Math.round(seconds * safeFps));
}

export function formatWorkspaceTimecode(seconds: number, fps: number): string {
  const safeFps = Number.isFinite(fps) && fps > 0 ? Math.round(fps) : 24;
  const totalFrames = secondsToWorkspaceFrame(seconds, safeFps);
  const frame = totalFrames % safeFps;
  const totalSeconds = Math.floor(totalFrames / safeFps);
  const second = totalSeconds % 60;
  const minute = Math.floor(totalSeconds / 60) % 60;
  const hour = Math.floor(totalSeconds / 3600);

  return [
    hour,
    minute,
    second,
    frame,
  ].map((part) => part.toString().padStart(2, '0')).join(':');
}
