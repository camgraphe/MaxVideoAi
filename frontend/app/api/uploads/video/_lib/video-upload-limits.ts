export const DEFAULT_MAX_VIDEO_UPLOAD_MB = 50;

export function getMaxVideoUploadMB(): number {
  const configured = Number(process.env.ASSET_MAX_VIDEO_MB ?? String(DEFAULT_MAX_VIDEO_UPLOAD_MB));
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_VIDEO_UPLOAD_MB;
}

export function videoUploadLimitBytes(maxMB = getMaxVideoUploadMB()): number {
  return maxMB * 1024 * 1024;
}

export function isSupportedVideoMime(mime: string): boolean {
  return mime.trim().toLowerCase().startsWith('video/');
}
