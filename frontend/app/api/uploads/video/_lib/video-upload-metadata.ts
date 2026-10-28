import type { MediaFacts } from '@/lib/media-identity';
import { probeMediaBuffer } from '@/server/media/detect-has-audio';

/** Measure assembled original bytes, including MOV display rotation, before publishing an upload. */
export async function readVideoUploadMetadata(bytes: Buffer, fileName: string, mime: string) {
  const probe = await probeMediaBuffer(bytes, { fileName, mimeType: mime });
  if (probe?.kind !== 'video' || !probe.width || !probe.height || typeof probe.hasAudio !== 'boolean') return null;
  const mediaFacts: MediaFacts = {
    source: 'probe', durationSec: probe.durationSec,
    width: probe.width, height: probe.height, hasAudio: probe.hasAudio,
  };
  return { width: probe.width, height: probe.height, durationSec: probe.durationSec, mediaFacts };
}
