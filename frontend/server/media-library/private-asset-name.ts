/** Private library presentation only; never derive publication titles from upload names. */
export function privateMediaAssetName(metadata: Record<string, unknown>): string | null {
  for (const key of ['label', 'fileName', 'filename', 'originalName']) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}
