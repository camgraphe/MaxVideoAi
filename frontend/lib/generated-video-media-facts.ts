/** Measurements of the original file, never the requested generation duration. */
export type GeneratedVideoFacts = {
  source: 'probe';
  version: 1;
  probe: 'ffprobe';
  original: { url: string; sha256: string; sizeBytes: number };
  durationSec: number;
  videoDurationSec: number | null;
  audioDurationSec: number | null;
  containerDurationSec: number | null;
};
export type VideoProbeResult = {
  streams?: Array<{ codec_type?: string; duration?: string; disposition?: { attached_pic?: number } }>;
  format?: { duration?: string };
};
function positive(value: unknown): number | null {
  const number = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number > 0 ? number : null;
}
export function factsFromProbe(probe: VideoProbeResult, original: GeneratedVideoFacts['original']): GeneratedVideoFacts | null {
  const video = probe.streams?.find((stream) => stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1);
  if (!video) return null;
  const videoDurationSec = positive(video.duration);
  const audioDurationSec = positive(probe.streams?.find((stream) => stream.codec_type === 'audio')?.duration);
  const containerDurationSec = positive(probe.format?.duration);
  // Matches the existing upload file-duration contract; retain all stream facts.
  const durationSec = containerDurationSec ?? videoDurationSec;
  return durationSec === null ? null : { source: 'probe', version: 1, probe: 'ffprobe', original,
    durationSec, videoDurationSec, audioDurationSec, containerDurationSec };
}
export function readGeneratedVideoFacts(value: unknown, originalUrl: string): GeneratedVideoFacts | null {
  if (!value || typeof value !== 'object') return null;
  const facts = value as GeneratedVideoFacts;
  if (facts.version !== 1 || facts.source !== 'probe' || facts.probe !== 'ffprobe'
    || facts.original?.url !== originalUrl || !/^https?:\/\//i.test(originalUrl)
    || !/^[a-f0-9]{64}$/.test(facts.original?.sha256 ?? '')
    || !Number.isSafeInteger(facts.original?.sizeBytes) || facts.original.sizeBytes <= 0
    || positive(facts.durationSec) === null
    || [facts.videoDurationSec, facts.audioDurationSec, facts.containerDurationSec]
      .some((duration) => duration !== null && (typeof duration !== 'number' || positive(duration) === null))
    || facts.durationSec !== (facts.containerDurationSec ?? facts.videoDurationSec)) return null;
  return facts;
}
export function videoDuration(metadata: Record<string, unknown>, originalUrl: string, fallback: number | null): number | null {
  const facts = metadata.mediaFacts;
  if (facts && typeof facts === 'object' && 'version' in facts) {
    return readGeneratedVideoFacts(facts, originalUrl)?.durationSec ?? null;
  }
  return positive(fallback);
}
