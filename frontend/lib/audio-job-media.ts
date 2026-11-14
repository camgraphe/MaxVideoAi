/** Stable, authenticated display URL. Never use as a generation input or stored source. */
export function audioJobMediaUrl(jobId: string, kind: 'audio' | 'video' | 'source'): string {
  return `/api/audio/media/${encodeURIComponent(jobId)}?kind=${kind}`;
}
