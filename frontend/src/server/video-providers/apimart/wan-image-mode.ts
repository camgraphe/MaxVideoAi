/** images counts reference images plus the start frame, excluding the optional last frame. */
export function wanImageMode(mode: string, images: number, startFrame: boolean, endFrame: boolean) {
  if (mode === 't2v' && images === 0 && !startFrame && !endFrame) return 'text';
  if (mode === 'i2v' && startFrame && images === 1) return 'frame';
  if (mode === 'ref2v' && !startFrame && !endFrame && Number.isInteger(images) && images >= 1 && images <= 10)
    return 'reference';
  return null;
}

/** Other extra options have no reviewed mapping to the APIMart request. */
export const WAN_REVIEWED_EXTRA_KEYS = ['enable_prompt_expansion', 'file_url', 'web_url'];
export function hasUnreviewedWanOptions(extras: Record<string, unknown> | undefined) {
  return Object.entries(extras ?? {}).some(([key, value]) => value != null && !WAN_REVIEWED_EXTRA_KEYS.includes(key))
    || (extras?.enable_prompt_expansion != null && typeof extras.enable_prompt_expansion !== 'boolean');
}
