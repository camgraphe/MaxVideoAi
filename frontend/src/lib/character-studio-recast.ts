/** Portable brief: no browser object URLs, signed media or account identifiers. */
export function buildRecastBrief(input: {
  source: string;
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
    sourceVideo: input.source,
    images: [
      { role: 'character', file: input.character },
      ...(input.product ? [{ role: 'product', file: input.product }] : []),
    ],
    dialogue: dialogue || null,
    referenceAudio: input.audio || null,
    generateAudio: Boolean(dialogue || input.audio),
    prompt: [
      'Use the supplied video as the source of motion, staging and camera. Replace the main performer with the person in the character portrait; preserve their identity and wardrobe.',
      input.product &&
        'The separate product photograph defines the actual object. Keep its silhouette, details and colors consistent. The performer presents the product naturally in the scene.',
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
