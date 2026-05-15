export const KLING_DIRECT_ONLY_FAL_EXTRA_KEYS = new Set([
  'camera_control',
  'dynamic_masks',
  'element_list',
  'static_mask',
  'watermark_enabled',
  'watermark_info',
]);

export function stripKlingDirectOnlyExtraInputValues(
  extraInputValues: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
  if (!extraInputValues) return undefined;
  const sanitized = Object.entries(extraInputValues).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (!KLING_DIRECT_ONLY_FAL_EXTRA_KEYS.has(key)) {
      acc[key] = value;
    }
    return acc;
  }, {});
  return Object.keys(sanitized).length ? sanitized : undefined;
}
