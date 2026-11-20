import flashHero from '@/config/model-cinematic-flash-hero.json';
import startFrames from '@/config/model-cinematic-start-frames.json';
import createMedia from '@/config/model-cinematic-create-media.json';
import finalMedia from '@/config/model-cinematic-final-media.json';
import boards from '@/config/model-cinematic-workflow-boards.json';
import publicProofs from '@/config/model-cinematic-public-proofs.json';
import klingShotStills from '@/config/model-kling-v4-shot-stills.json';
import klingWorkflowVisuals from '@/config/model-kling-v4-workflow-visuals.json';

export type CinematicClip = Pick<typeof createMedia.create, 'src' | 'poster' | 'width' | 'height' | 'durationSeconds' | 'audio'> & { displayFormat?: string };
export type CinematicShotStill = (typeof klingShotStills.frames)[number];
export type CinematicMotionProof = {
  character: Pick<typeof createMedia.character, 'display' | 'width' | 'height'>;
  source: CinematicClip; result: CinematicClip;
};
export type CinematicVideoMedia = {
  modelSlug: string; modelLabel: string; frameSourceLabel: string;
  openingRecipe?: Pick<typeof flashHero, 'id' | 'mode' | 'prompt' | 'original'>;
  frames: readonly unknown[];
  heroAutoplay?: boolean;
  publicProofs?: readonly (typeof publicProofs)[number][];
  create: CinematicClip;
  createStills?: readonly CinematicShotStill[];
  promptingFrame?: {
    id: string;
    proofId: string;
    image: { url: string; width: number; height: number; sha256: string };
  };
  modify?: { source: CinematicClip; result: CinematicClip };
  focuses: Record<string, CinematicMotionProof>;
  boards: readonly Pick<typeof boards[number], 'id' | 'display'>[];
  examples: Record<string, CinematicClip>;
};

/** Reviewed media registration, separate from model identity/publication policy.
 * New video models register their own bundle here; renderers never inherit Flash media.
 */
const videoMedia: Record<string, CinematicVideoMedia> = {
  ...Object.fromEntries([
    { modelSlug: 'seedance-2-5', modelLabel: 'Seedance 2.5' },
    { modelSlug: 'flux-3-max', modelLabel: 'FLUX 3 Max' },
    { modelSlug: 'kling-v4', modelLabel: 'Kling 4.0', heroAutoplay: false },
  ].map(model => {
    const proofs = publicProofs.filter(proof => proof.modelSlug === model.modelSlug);
    const create = proofs.find(proof => proof.id.endsWith('-create'));
    if (!create) throw new Error(`Missing reviewed Create proof: ${model.modelSlug}`);
    const createStills = create.id === klingShotStills.sourceProofId && create.clip.src === klingShotStills.sourceUrl
      ? klingShotStills.frames : undefined;
    const promptingFrame = model.modelSlug === klingWorkflowVisuals.modelSlug && create.id === klingWorkflowVisuals.sourceProofId
      && create.clip.src.endsWith(`${klingWorkflowVisuals.sourceSha256}.mp4`)
      ? { id: klingWorkflowVisuals.promptGuide.id, proofId: create.id,
        image: klingWorkflowVisuals.frames[klingWorkflowVisuals.promptGuide.frameId as keyof typeof klingWorkflowVisuals.frames] }
      : undefined;
    return [model.modelSlug, { ...model, frameSourceLabel: '', frames: [], publicProofs: proofs, create: create.clip, createStills, promptingFrame,
      focuses: {}, boards: [], examples: Object.fromEntries(proofs.map(proof => [proof.id, proof.clip])) }];
  })),
  [finalMedia.modelSlug]: {
    modelSlug: finalMedia.modelSlug, modelLabel: 'Seedance 2.5 Flash', frameSourceLabel: 'GPT Image 2.6 Sunburst',
    openingRecipe: flashHero, frames: startFrames, create: createMedia.create,
    modify: { source: finalMedia.clips.modifySource, result: finalMedia.clips.modifyResult },
    focuses: { 'focus-motion-control': { character: createMedia.character, source: createMedia.motionSource, result: createMedia.motionResult } },
    boards, examples: { [flashHero.id]: flashHero.clip, 'the-blue-hour': finalMedia.clips['the-blue-hour'], 'where-gravity-ends': finalMedia.clips['where-gravity-ends'] },
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
