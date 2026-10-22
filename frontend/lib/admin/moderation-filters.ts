import type { JobSurface } from '@/types/billing';
import type { FinishingToolId } from '@/lib/toolbox/finishing';
import type { CreatorToolId } from '@/lib/toolbox/catalogue';

export type ModerationSurface = JobSurface | FinishingToolId | CreatorToolId;
type ModerationFilter = { id: ModerationSurface; label: string; by: 'surface' | 'tool-id' | 'creator' };

export const PRIMARY_MODERATION_FILTERS = [
  { id: 'video', label: 'Video', by: 'surface' },
  { id: 'image', label: 'Image', by: 'surface' },
  { id: 'audio', label: 'Audio', by: 'surface' },
] as const satisfies readonly ModerationFilter[];

export const TOOL_MODERATION_FILTERS = [
  { id: 'upscale', label: 'Upscale', by: 'surface' },
  { id: 'background-removal', label: 'Background removal', by: 'surface' },
  { id: 'character', label: 'Character', by: 'surface' },
  { id: 'storyboard', label: 'Storyboard', by: 'surface' },
  { id: 'angle', label: 'Angle', by: 'surface' },
  { id: 'restore-video', label: 'Restore video', by: 'tool-id' },
  { id: 'denoise', label: 'Denoise', by: 'tool-id' },
  { id: 'fix-blur', label: 'Fix blur', by: 'tool-id' },
  { id: 'smooth-motion', label: 'Smooth motion', by: 'tool-id' },
  { id: 'subtitles', label: 'Subtitles', by: 'creator' },
  { id: 'lip-sync', label: 'Lip Sync', by: 'creator' },
  { id: 'product-photo-editor', label: 'Product Photo Editor', by: 'creator' },
  { id: 'product-video-editor', label: 'Product Video Editor', by: 'creator' },
  { id: 'motion-transfer', label: 'Motion Transfer', by: 'creator' },
] as const satisfies readonly ModerationFilter[];

export function isCreatorModerationSurface(surface: ModerationSurface): boolean {
  return TOOL_MODERATION_FILTERS.some(option => option.id === surface && option.by === 'creator');
}

export function parseModerationSurface(value: string | null): ModerationSurface {
  const id = (value ?? '').trim().toLowerCase();
  const option = [...PRIMARY_MODERATION_FILTERS, ...TOOL_MODERATION_FILTERS].find(option => option.id === id);
  return option?.id ?? (id === 'tool' ? 'tool' : 'video');
}
