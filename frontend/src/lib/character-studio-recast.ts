import type { VideoExcerptRange } from '@/lib/video-excerpt';

type BriefPassage = VideoExcerptRange & { originalDurationSec: number };

/** Portable brief: no browser object URLs, signed media or account identifiers. */
export function buildRecastBrief(input: {
  resolution?: string; aspectRatio?: string;
  source?: string;
  durationSec?: number;
  sourceDurationSec?: number;
  videoPassage?: BriefPassage;
  audioPassage?: BriefPassage;
  character: string;
  product?: string;
  direction?: string;
  dialogue?: string;
  audio?: string;
}) {
  const direction = input.direction?.trim();
  const dialogue = input.dialogue?.trim();
  return {
    version: 1,
    service: 'MaxVideoAI Recast',
    sourceVideo: input.source || null,
    ...(input.resolution && input.aspectRatio ? {resolution:input.resolution,aspectRatio:input.aspectRatio} : {}),
    ...(input.durationSec !== undefined
      ? { durationSec: input.durationSec, sourceDurationSec: input.sourceDurationSec ?? 0 }
      : {}),
    ...(input.source && input.videoPassage ? { videoPassage: input.videoPassage } : {}),
    ...(input.audio && input.audioPassage ? { audioPassage: input.audioPassage } : {}),
    images: [
      { role: 'character', file: input.character },
      ...(input.product ? [{ role: 'product', file: input.product }] : []),
    ],
    dialogue: dialogue || null,
    referenceAudio: input.audio || null,
    generateAudio: Boolean(dialogue || input.audio),
    prompt: [
      'Image 1 is the character portrait and defines the performer’s identity and wardrobe.',
      input.source
        ? 'Use the supplied video as the source of motion, staging and camera. Replace the main performer with the person in the character portrait; preserve their identity and wardrobe.'
        : 'Animate the character in the supplied portrait according to the scene direction, preserving their identity and wardrobe.',
      input.product &&
        'Image 2 is the separate product photograph and defines the actual object. Keep its silhouette, details and colors consistent. The performer presents the product naturally in the scene.',
      direction,
      dialogue &&
        'The performer speaks the following line on camera exactly once, in its written language, with natural lip sync: ' +
          JSON.stringify(dialogue) +
          '.',
      input.audio && 'Use the supplied audio clip as a reference for timing, phrasing and delivery.',
      'No captions, titles or added graphics.',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export function isRecastAudioFile(file: Pick<File, 'name' | 'type' | 'size'>) {
  return (
    /\.(mp3|wav)$/i.test(file.name) &&
    (!file.type ||
      ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'].includes(
        file.type,
      )) &&
    file.size > 0 &&
    file.size <= 15 * 1024 * 1024
  );
}
