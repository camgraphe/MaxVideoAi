import { z } from 'zod';
import { getUpscaleToolEngine } from '@/config/tools-upscale-engines';
import { getBackgroundRemovalToolEngine } from '@/config/tools-background-removal-engines';
import { clampUpscaleFactor, resolveUpscaleTargetResolution } from '@/lib/tools-upscale';
import { resolveOutputCodec, validateBackgroundRemovalDuration } from '@/lib/tools-background-removal';
import { readToolVideoMetadata } from './toolbox-video-metadata';
import { resolveUpscalePricingContext } from './upscale-pricing-context';
import { resolveBackgroundRemovalPricingContext } from './background-removal-pricing-context';

const number = z.number().finite().nonnegative().nullable().optional();
const url = z.string().url().max(8192).refine(value => /^https?:\/\//i.test(value));
const quoteInput = z.discriminatedUnion('toolId', [
  z.object({ toolId: z.literal('upscale'), mediaType: z.enum(['image', 'video']), mediaUrl: url, engineId: z.string(), mode: z.enum(['factor', 'target']), upscaleFactor: z.number(), targetResolution: z.enum(['720p', '1080p', '1440p', '2160p']), outputFormat: z.string(), imageWidth: number, imageHeight: number }),
  z.object({ toolId: z.literal('background-removal'), videoUrl: url, outputContainerAndCodec: z.string(), backgroundColor: z.string(), preserveAudio: z.boolean(), videoWidth: number, videoHeight: number, durationSec: number, fps: number }),
]);
/** Read-only adapter. Uses the same pricing owners and normalization as execution. */
export async function quoteToolboxRequest(value: unknown, account: string) {
  const input = quoteInput.parse(value);
  if (input.toolId === 'upscale') {
    const engine = getUpscaleToolEngine(input.engineId, input.mediaType);
    if (engine.id !== input.engineId) throw new Error('Unsupported processing method.');
    const videoMetadata = input.mediaType === 'video' ? await readToolVideoMetadata(input.mediaUrl, account) : null;
    if (input.mediaType === 'video' && !videoMetadata) throw new Error('Unable to read video metadata.');
    const { pricing } = await resolveUpscalePricingContext({ billingProductKey: engine.billingProductKey, engine, input, targetResolution: resolveUpscaleTargetResolution(engine, input.targetResolution), upscaleFactor: clampUpscaleFactor(engine, input.upscaleFactor), videoMetadata });
    return { totalCents: pricing.totalCents, currency: pricing.currency };
  }
  const durationError = validateBackgroundRemovalDuration(input.durationSec);
  if (durationError) throw new Error(durationError);
  const engine = getBackgroundRemovalToolEngine();
  const { pricing } = await resolveBackgroundRemovalPricingContext({ engine, billingProductKey: engine.billingProductKey, outputCodec: resolveOutputCodec(input.outputContainerAndCodec), videoMetadata: { width: input.videoWidth ?? null, height: input.videoHeight ?? null, durationSec: Math.ceil(input.durationSec!), fps: input.fps ?? null } });
  return { totalCents: pricing.totalCents, currency: pricing.currency };
}
