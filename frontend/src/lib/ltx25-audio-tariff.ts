/** Reviewed source-audio bounds from the generation catalog; charging reads owned media. */
export function ltx25AudioTariffBounds(modelId: string, mode: string) {
  if (mode !== 'a2v' || !['ltx-2-5-fast', 'ltx-2-5-pro'].includes(modelId)) return null;
  return { min: 2, max: modelId === 'ltx-2-5-fast' ? 20 : 10 };
}

export function validateLtx25AudioTariffDuration(modelId: string, mode: string, seconds: number) {
  const bounds = ltx25AudioTariffBounds(modelId, mode);
  if (!bounds || !Number.isFinite(seconds) || seconds < bounds.min || seconds > bounds.max) {
    throw new Error('Unsupported source-audio duration for this LTX model.');
  }
  return bounds;
}
