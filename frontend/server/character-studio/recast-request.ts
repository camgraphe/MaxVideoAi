import { z } from 'zod';
import { mediaExcerptDuration } from '@/lib/media-excerpt-timing';
import { RECAST_FRAMINGS, RECAST_RESOLUTIONS } from '@/lib/character-studio-recast-format';
const assetId = z.string().regex(/^ma_[a-f0-9]{32}$/);
const range = z
  .object({ startSec: z.number().finite().nonnegative(), endSec: z.number().finite().positive() })
  .strict()
  .refine((r) => r.endSec > r.startSec && mediaExcerptDuration(r) <= 15);
const track = z.object({ assetId, range }).strict();
const saved = z.object({ jobId: z.string().min(1).max(160), imageUrl: z.string().min(1).max(4096) }).strict();
export const recastSettingsObject = z
  .object({
    portrait: z.union([z.object({ assetId }).strict(), saved]),
    product: assetId.optional(),
    video: track.optional(),
    audio: track.optional(),
    direction: z.string().trim().max(2000),
    dialogue: z.string().trim().max(500),
    seconds: z.number().int().min(2).max(30),
    resolution: z.enum(RECAST_RESOLUTIONS),
    aspectRatio: z.enum(RECAST_FRAMINGS),
  })
  .strict();
export function validRecastDirection(s: {direction: string; dialogue: string; video?: unknown; audio?: unknown}) {
  return Boolean(s.direction || s.dialogue || s.video || s.audio);
}
export function validRecastDuration(s: {seconds: number; video?: {range: {startSec:number;endSec:number}}}) {
  return !s.video || s.seconds + mediaExcerptDuration(s.video.range) <= 30;
}
export const recastSettings = recastSettingsObject.refine(validRecastDirection).refine(validRecastDuration);
