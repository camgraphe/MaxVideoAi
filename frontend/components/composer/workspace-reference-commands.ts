import type { AssetFieldConfig } from '@/components/AssetDropzone';
import type { EngineCaps } from '@/types/engines';

/** Only actual video keyframe identities receive Start/End labels. */
export function getWorkspaceFrameCommand({ field, role }: AssetFieldConfig, engine: EngineCaps): 'start' | 'end' | null {
  if (field.type !== 'image' || (field.maxCount ?? 1) > 1 || role === 'reference') return null;
  if (!engine.modes.some((mode) => mode === 't2v' || mode === 'i2v')) return null;
  if (['end_image_url', 'end_image', 'last_frame_url'].includes(field.id)) return 'end';
  if (['image_url', 'start_image_url', 'start_image', 'first_frame_url', 'input_image'].includes(field.id)) return 'start';
  return null;
}
