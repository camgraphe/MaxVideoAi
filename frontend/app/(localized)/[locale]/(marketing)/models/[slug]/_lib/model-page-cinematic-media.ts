import startFrames from '@/config/model-cinematic-start-frames.json';
import createMedia from '@/config/model-cinematic-create-media.json';
import finalMedia from '@/config/model-cinematic-final-media.json';
import boards from '@/config/model-cinematic-workflow-boards.json';
import publicProofs from '@/config/model-cinematic-public-proofs.json';

export type CinematicClip = Pick<typeof createMedia.create, 'src' | 'poster' | 'width' | 'height' | 'durationSeconds' | 'audio'> & { displayFormat?: string };
export type CinematicMotionProof = {
  character: Pick<typeof createMedia.character, 'display' | 'width' | 'height'>;
  source: CinematicClip; result: CinematicClip;
};
export type CinematicVideoMedia = {
  modelSlug: string; modelLabel: string; frameSourceLabel: string;
  frames: readonly unknown[];
  publicProofs?: readonly (typeof publicProofs)[number][];
  create: CinematicClip;
  modify?: { source: CinematicClip; result: CinematicClip };
  focuses: Record<string, CinematicMotionProof>;
  boards: readonly Pick<typeof boards[number], 'id' | 'display'>[];
  examples: Record<string, CinematicClip>;
};

/** Reviewed media registration, separate from model identity/publication policy.
 * New video models register their own bundle here; renderers never inherit Flash media.
 */
const videoMedia: Record<string, CinematicVideoMedia> = {
  ...Object.fromEntries(['seedance-2-5', 'flux-3-max'].map(modelSlug => {
    const proofs = publicProofs.filter(proof => proof.modelSlug === modelSlug);
    const create = proofs.find(proof => proof.id.endsWith('-create'));
    if (!create) throw new Error(`Missing reviewed Create proof: ${modelSlug}`);
    return [modelSlug, { modelSlug, modelLabel: modelSlug === 'seedance-2-5' ? 'Seedance 2.5' : 'FLUX 3 Max',
      frameSourceLabel: '', frames: [], publicProofs: proofs, create: create.clip,
      focuses: {}, boards: [], examples: Object.fromEntries(proofs.map(proof => [proof.id, proof.clip])) }];
  })),
  [finalMedia.modelSlug]: {
    modelSlug: finalMedia.modelSlug, modelLabel: 'Seedance 2.5 Flash', frameSourceLabel: 'GPT Image 2.6 Sunburst',
    frames: startFrames, create: createMedia.create,
    modify: { source: finalMedia.clips.modifySource, result: finalMedia.clips.modifyResult },
    focuses: { 'focus-motion-control': { character: createMedia.character, source: createMedia.motionSource, result: createMedia.motionResult } },
    boards, examples: { 'the-blue-hour': finalMedia.clips['the-blue-hour'], 'where-gravity-ends': finalMedia.clips['where-gravity-ends'] },
  },
};

export function getCinematicVideoMedia(modelSlug: string): CinematicVideoMedia | undefined {
  return videoMedia[modelSlug];
}

export function cinematicVideoMetadata(media: CinematicVideoMedia, clip: CinematicClip, soundLabel: string) {
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const divisor = gcd(clip.width, clip.height);
  return [media.modelLabel, `${Math.round(clip.durationSeconds)}s`,
    ...(clip.displayFormat ? [clip.displayFormat] : [`${Math.min(clip.width, clip.height)}p`, `${clip.width / divisor}:${clip.height / divisor}`]),
    ...(clip.audio ? [soundLabel] : [])].join(' · ');
}
