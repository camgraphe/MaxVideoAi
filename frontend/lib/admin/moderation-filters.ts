import type { JobSurface } from '@/types/billing';
import type { FinishingToolId } from '@/lib/toolbox/finishing';

export type ModerationSurface = JobSurface | FinishingToolId;
type ModerationFilter = { id: ModerationSurface; label: string; surface: JobSurface };

export const PRIMARY_MODERATION_FILTERS = [
  { id: 'video', label: 'Video', surface: 'video' },
  { id: 'image', label: 'Image', surface: 'image' },
  { id: 'audio', label: 'Audio', surface: 'audio' },
] as const satisfies readonly ModerationFilter[];

export const TOOL_MODERATION_FILTERS = [
  { id: 'upscale', label: 'Upscale', surface: 'upscale' },
  { id: 'background-removal', label: 'Background removal', surface: 'background-removal' },
  { id: 'character', label: 'Character', surface: 'character' },
  { id: 'storyboard', label: 'Storyboard', surface: 'storyboard' },
  { id: 'angle', label: 'Angle', surface: 'angle' },
  { id: 'restore-video', label: 'Restore video', surface: 'tool' },
  { id: 'denoise', label: 'Denoise', surface: 'tool' },
  { id: 'fix-blur', label: 'Fix blur', surface: 'tool' },
  { id: 'smooth-motion', label: 'Smooth motion', surface: 'tool' },
] as const satisfies readonly ModerationFilter[];

export function parseModerationSurface(value: string | null): ModerationSurface {
  const id = (value ?? '').trim().toLowerCase();
  const option = [...PRIMARY_MODERATION_FILTERS, ...TOOL_MODERATION_FILTERS].find(option => option.id === id);
  return option?.id ?? (id === 'tool' ? 'tool' : 'video');
}
