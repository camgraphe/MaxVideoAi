import * as z from 'zod/v4';

export const MONTAGE_FPS = [24, 25, 30, 60] as const;
export const MONTAGE_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5', '21:9'] as const;
export const MONTAGE_RESOLUTIONS = ['720p', '1080p'] as const;
export const MONTAGE_AUDIO_MODES = ['preserve', 'mute'] as const;
export const MONTAGE_MIN_CLIPS = 2;
export const MONTAGE_MAX_CLIPS = 12;
export const MONTAGE_MAX_DURATION_SECONDS = 180;
export const STUDIO_MONTAGE_COMMAND_KIND = 'create_studio_montage' as const;
export const STUDIO_MONTAGE_COMMAND_VERSION = 1 as const;

const canonicalAssetIdSchema = z.string().regex(/^ma_[a-f0-9]{32}$/u);
const montageFpsSchema = z.union(
  MONTAGE_FPS.map((fps) => z.literal(fps)) as [
    z.ZodLiteral<24>,
    z.ZodLiteral<25>,
    z.ZodLiteral<30>,
    z.ZodLiteral<60>,
  ],
);

export const montageSettingsSchema = z.object({
  fps: montageFpsSchema,
  aspectRatio: z.enum(MONTAGE_ASPECT_RATIOS),
  resolution: z.enum(MONTAGE_RESOLUTIONS),
  audioMode: z.enum(MONTAGE_AUDIO_MODES),
}).strict();

export const createStudioMontageInputSchema = z.object({
  title: z.string().min(1).max(80).refine((value) => value === value.trim()),
  settings: montageSettingsSchema,
  clips: z.array(z.object({
    assetId: canonicalAssetIdSchema,
    sourceInFrame: z.number().int().nonnegative(),
    durationFrames: z.number().int().positive(),
  }).strict()).min(MONTAGE_MIN_CLIPS).max(MONTAGE_MAX_CLIPS),
  idempotencyKey: z.string().min(1).max(128).refine((value) => value === value.trim()),
}).strict();

export type MontageSettings = z.infer<typeof montageSettingsSchema>;
export type CreateStudioMontageInput = z.infer<typeof createStudioMontageInputSchema>;

export function parseCreateStudioMontageInput(input: unknown): CreateStudioMontageInput {
  const parsed = createStudioMontageInputSchema.safeParse(input);
  if (!parsed.success) throw new Error('Invalid Studio montage input.');
  return parsed.data;
}
