/** UI projection only: saved inactive values remain intact for reuse. Servers validate effective requests. */
export function lumaEditStrategy(values: Record<string, unknown>): 'automatic' | 'manual' {
  if (values.edit_control_mode === 'automatic' || values.edit_control_mode === 'manual') return values.edit_control_mode;
  return (typeof values.edit_strength === 'string' && values.edit_strength !== 'auto')
    || values.edit_face === true || ['precise', 'coarse'].includes(String(values.edit_pose_strength))
    || ['depth_blur', 'normals_augmentation', 'trajectory_sparsity'].some(key => values[`edit_${key}`] != null && values[`edit_${key}`] !== '')
    || ['pose', 'depth', 'normals', 'trajectory', 'face'].some(key => ['on', 'off'].includes(String(values[`edit_${key}_mode`])))
    ? 'manual' : 'automatic';
}
export function effectiveLumaEditValues(values: Record<string, unknown>): Record<string, unknown> {
  if (values.edit_control_mode !== 'automatic') return values;
  return Object.fromEntries(Object.entries(values).filter(([key]) => !key.startsWith('edit_') || key === 'edit_control_mode' || key.startsWith('edit_keyframe')));
}
export function visibleLumaEditField(id: string, values: Record<string, unknown>): boolean {
  if (id === 'edit_face') return false; // Legacy boolean stays readable, new UI has default/on/off.
  if (!id.startsWith('edit_') || id === 'edit_control_mode' || id.startsWith('edit_keyframe')) return true;
  return lumaEditStrategy(values) === 'manual';
}
