import type { VideoOperationCaps } from './video-operation';

export type H3SourceOperation = 'h3-recast' | 'h3-relight';
export function isH3SourceOperation(value: unknown): value is H3SourceOperation {
  return value === 'h3-recast' || value === 'h3-relight';
}
export type H3SourceFacts = { durationSec?: number | null; fps?: number; decodedFrameCount?: number; constantFrameRate?: boolean };
/** Facts must come from the owned byte probe, never request metadata or duration × fps. */
export function validateH3Source(operation: H3SourceOperation, facts?: H3SourceFacts): string | undefined {
  const duration = facts?.durationSec;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < (operation === 'h3-recast' ? 5 : 56/24 - 0.000001) || duration > (operation === 'h3-recast' ? 30 : 15)) {
    return operation === 'h3-recast' ? 'Recast requires a verified 5–30 second source; each shot must be at most 15 seconds.' : 'Relight requires a verified source between 56 frames and 15 seconds.';
  }
  if (operation === 'h3-relight' && (facts?.fps !== 24 || facts.constantFrameRate !== true
    || !Number.isSafeInteger(facts.decodedFrameCount) || facts.decodedFrameCount! < 56
    || (facts.decodedFrameCount! - 5) % 17 !== 0 || Math.abs(duration - facts.decodedFrameCount! / 24) > 0.000001)) {
    return 'Relight requires decoded constant 24 fps and 17n+5 frames. Prepare a compatible copy and review its actual timing.';
  }
}
export function planH3RelightCopy(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 56/24 || seconds > 15) throw new Error('Choose between 56/24 and 15 seconds for Relight.');
  const frameCount = Math.floor((Math.floor(seconds * 24) - 5) / 17) * 17 + 5;
  return { fps: 24 as const, frameCount, durationSec: frameCount / 24, removedEndSec: seconds - frameCount / 24 };
}
/** Published endpoint reference rates in cents; not a future supplier invoice. */
export function h3OperationRate(operation: H3SourceOperation, resolution: string): number {
  const rates: Record<string, number> = operation === 'h3-recast' ? { '768P': 30, '1080P': 45 } : { '480P': 5, '768P': 8, '1080P': 16, '2K': 32 };
  if (!Object.hasOwn(rates,resolution)) throw new Error('Unsupported H3 operation resolution.');
  return rates[resolution]!;
}
export function buildH3SourceRequest(input: {
  operation: H3SourceOperation; videoUrl: string; portraitUrls?: string[]; lightingImageUrl?: string;
  prompt?: string; resolution?: string; aspectRatio?: string; enhanceRealism?: boolean; seed?: number; enableSafetyChecker?: boolean;
}): Record<string, unknown> {
  if (!input.videoUrl?.trim()) throw new Error('Owned source video is required.');
  const resolution = input.resolution ?? (input.operation === 'h3-recast' ? '1080P' : '768P');
  h3OperationRate(input.operation,resolution);
  const body: Record<string,unknown> = { video_url: input.videoUrl, resolution, enable_safety_checker: input.enableSafetyChecker ?? true };
  if (input.seed !== undefined) {
    if (!Number.isSafeInteger(input.seed) || input.seed < 0) throw new Error('Seed must be a nonnegative integer.');
    body.seed = input.seed;
  }
  if (input.operation === 'h3-recast') {
    if (!input.portraitUrls?.length || input.portraitUrls.length > 4 || input.portraitUrls.some(url=>!url.trim())) throw new Error('Recast requires 1–4 ordered portraits.');
    if (input.aspectRatio || input.lightingImageUrl) throw new Error('Recast inherits source framing.');
    if ((input.prompt?.length ?? 0) > 2000) throw new Error('Recast prompt must be at most 2000 characters.');
    body.reference_image_urls = input.portraitUrls;
    body.enhance_realism = input.enhanceRealism ?? false;
    if (input.prompt?.trim()) body.prompt = input.prompt.trim();
  } else {
    if (input.prompt?.trim() || input.portraitUrls?.length || input.enhanceRealism !== undefined) throw new Error('Relight uses a lighting sphere image, without prompt or portraits.');
    if (!input.lightingImageUrl?.trim()) throw new Error('Relight requires a lighting sphere image.');
    const ratio = input.aspectRatio === 'auto' ? 'adaptive' : input.aspectRatio ?? 'adaptive';
    if (!['adaptive','21:9','16:9','4:3','1:1','3:4','9:16'].includes(ratio)) throw new Error('Unsupported Relight framing.');
    body.reference_image_url = input.lightingImageUrl;
    body.aspect_ratio = ratio;
  }
  return body;
}
export function buildH3OperationCaps(): Record<H3SourceOperation, VideoOperationCaps> {
  const build = (operation: H3SourceOperation): VideoOperationCaps => {
    const recast = operation === 'h3-recast';
    const resolution = recast ? ['768P','1080P'] : ['480P','768P','1080P','2K'];
    return { operation, mode: 'v2v', ...(recast ? {defaultForMode:true} : {}), label: recast ? 'Recast' : 'Relight', promptRequired: false,
      transport: 'fal', endpoint: `minimax/h3-max/${recast ? 'recast' : 'relight'}`,
      inputSchema: { required: [
        { id: 'video_url', type:'video', label:'Source video', modes:['v2v'], requiredInModes:['v2v'], source:'either', minCount:1, maxCount:1,
          minDurationSec:recast ? 5 : 56/24, maxDurationSec:recast ? 30 : 15,
          description:recast ? '5–30 seconds total. Each shot must be at most 15 seconds; the provider checks this content constraint.' : 'Prepared constant 24 fps video with 17n+5 decoded frames; at least 56 frames and at most 15 seconds.' },
        { id: recast ? 'reference_image_urls' : 'reference_image_url', type:'image', label:recast ? 'Ordered character portraits' : 'Lighting sphere', modes:['v2v'], requiredInModes:['v2v'], source:'either', minCount:1, maxCount:recast ? 4 : 1,
          description: recast ? 'One portrait per person, replacing people from left to right in each shot.' : 'Sphere render showing the target lighting.' },
      ], optional:[
        ...(recast ? [{id:'prompt',type:'text' as const,label:'Optional replacement instruction',modes:['v2v' as const]}, {id:'enhance_realism',type:'boolean' as const,label:'Enhance realism',modes:['v2v' as const],default:false}] : [{id:'aspect_ratio',type:'enum' as const,label:'Framing',modes:['v2v' as const],values:['auto','21:9','16:9','4:3','1:1','3:4','9:16'],default:'auto'}]),
        {id:'resolution',type:'enum',label:'Resolution',modes:['v2v'],values:resolution,default:recast?'1080P':'768P'},
        {id:'seed',type:'number',label:'Seed',modes:['v2v'],min:0,step:1},
        {id:'enable_safety_checker',type:'boolean',label:'Safety checker',modes:['v2v'],default:true},
      ], constraints:{ownedAssetModes:['v2v']} },
      ui:{modes:['v2v'],durationPolicy:'source_video',resolution,audioToggle:false,audioPresentation:'source',
        ...(!recast ? {aspectRatio:['auto','21:9','16:9','4:3','1:1','3:4','9:16']} : {}),
        notes:recast ? 'Replace people with ordered portraits; preserves source motion, cuts and audio. Each shot must be at most 15 seconds.' : 'Relight from a sphere render. Prepared source timing and audio are retained; review any compatible-copy trim.'} };
  };
  return {'h3-recast':build('h3-recast'),'h3-relight':build('h3-relight')};
}
