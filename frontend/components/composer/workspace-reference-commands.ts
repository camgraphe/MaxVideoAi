import type { AssetFieldConfig } from '@/components/AssetDropzone';
import type { EngineCaps, EngineInputField } from '@/types/engines';
import { getVideoWorkflowSourceField, isVideoSourceWorkflow, type VideoSourceWorkflow } from '@/lib/video-source-workflow';
import type { PromptPickerRole } from '@/lib/prompt-assistance/contract';

export function showCompactPickerField(field: EngineInputField, sourceWorkflow?: VideoSourceWorkflow) {
  return Boolean(sourceWorkflow) || field.type !== 'video' || !field.modes?.length || !field.modes.every(isVideoSourceWorkflow);
}

export function availablePickerRoles(engine: EngineCaps, fields: AssetFieldConfig[], sourceWorkflow?: VideoSourceWorkflow): PromptPickerRole[] {
  const roles = new Set<PromptPickerRole>();
  const source = sourceWorkflow && getVideoWorkflowSourceField(engine.inputSchema, sourceWorkflow);
  for (const entry of fields) {
    const { field, disabled } = entry;
    if (disabled || !showCompactPickerField(field, sourceWorkflow)) continue;
    if (field.type === 'image') {
      const frame = getWorkspaceFrameCommand(entry, engine);
      if (frame === 'start') roles.add('startImage');
      else if (frame === 'end') roles.add('endImage');
      else if (isWorkspaceModifyGuide(field)) roles.add('guideImage');
      else if (field.id === 'mask_url') roles.add('mask');
      else roles.add('image');
    } else if (field.type === 'audio') roles.add('audio');
    else if (field.type === 'video') roles.add(field.id === source?.id ? 'sourceVideo' : 'video');
  }
  return [...roles];
}

export function isWorkspaceModifyGuide(field: EngineInputField): boolean {
  return field.id === 'start_image_url' && field.modes?.length === 1 && field.modes[0] === 'v2v';
}

/** Only actual video keyframe identities receive Start/End labels. */
export function getWorkspaceFrameCommand({ field, role }: AssetFieldConfig, engine: EngineCaps): 'start' | 'end' | null {
  if (field.type !== 'image' || (field.maxCount ?? 1) > 1 || role === 'reference') return null;
  if (isWorkspaceModifyGuide(field)) return null;
  if (!engine.modes.some((mode) => mode === 't2v' || mode === 'i2v')) return null;
  if (['end_image_url', 'end_image', 'last_frame_url'].includes(field.id)) return 'end';
  if (['image_url', 'start_image_url', 'start_image', 'first_frame_url', 'input_image'].includes(field.id)) return 'start';
  return null;
}
