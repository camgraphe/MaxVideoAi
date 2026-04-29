export const ADMIN_EXCLUDED_USER_IDS = ['301cc489-d689-477f-94c4-0b051deda0bc'];

export function resolveExcludeAdminParam(value: string | string[] | undefined): boolean {
  const resolved = Array.isArray(value) ? value[value.length - 1] : value;
  if (resolved == null) return true;
  const normalized = resolved.trim().toLowerCase();
  if (!normalized) return true;
  return !['0', 'false', 'no', 'off'].includes(normalized);
}
