import { z } from 'zod';

export const FINISHING_TOOL_IDS = ['restore-video', 'denoise', 'fix-blur', 'smooth-motion'] as const;
export type FinishingToolId = typeof FINISHING_TOOL_IDS[number];
export type ToolQuality = 'standard' | 'pro';
const quality = z.enum(['standard', 'pro']).default('standard');

/** Product controls only. Provider/model names never enter a saved block. */
export const finishingSettingsSchemas = {
  'restore-video': z.object({ quality, resolution: z.enum(['1080p', '4k']).default('1080p') }).strict(),
  denoise: z.object({ quality, strength: z.enum(['auto', 'light', 'strong']).default('auto') }).strict(),
  'fix-blur': z.object({ quality: z.literal('standard').default('standard') }).strict(),
  'smooth-motion': z.object({ quality, fps: z.union([z.literal(60), z.literal(120)]).default(60) }).strict(),
};
export type FinishingSettings = z.infer<typeof finishingSettingsSchemas[FinishingToolId]>;
export function isFinishingToolId(value: string): value is FinishingToolId {
  return (FINISHING_TOOL_IDS as readonly string[]).includes(value);
}
export function defaultFinishingSettings(toolId: FinishingToolId): FinishingSettings {
  return finishingSettingsSchemas[toolId].parse({});
}
export const FINISHING_QUALITY_CHOICES: Record<FinishingToolId, readonly ToolQuality[]> = {
  'restore-video': ['standard', 'pro'], denoise: ['standard', 'pro'],
  'fix-blur': ['standard'], 'smooth-motion': ['standard', 'pro'],
};
