/** Normal generation only; Draft/final keep their independent tariffs. */
export function seedanceInputTariffMaximum(modelId: string): number | null {
  return modelId === 'seedance-2-5' ? 30
    : ['seedance-2-0', 'seedance-2-0-mini', 'seedance-2-0-fast'].includes(modelId) ? 15 : null;
}

export function supportsSeedanceInputTariff(modelId: string, mode: string, billingInputType?: string): boolean {
  return seedanceInputTariffMaximum(modelId) !== null && ['ref2v', 'v2v', 'extend'].includes(mode)
    && billingInputType === 'video_input';
}

export function validateSeedanceInputTariffDuration(modelId: string, seconds: number): number {
  const maximum = seedanceInputTariffMaximum(modelId);
  if (maximum === null || !Number.isFinite(seconds) || seconds <= 0 || seconds > maximum) {
    throw new Error(`Verified input-video duration must be positive and at most ${maximum ?? 0} seconds.`);
  }
  return maximum;
}
