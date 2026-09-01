import type { EngineCaps, Mode } from '@/types/engines';

export function resolveWalletDirectGenerationMode(
  engine: EngineCaps,
  value: unknown,
): Mode {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return engine.modes.includes(normalized as Mode) ? (normalized as Mode) : 't2v';
}

export function getWalletDirectPricingRefusal(
  engine: EngineCaps,
  mode: Mode,
): 'validated_reference_count_required' | 'trusted_input_audio_duration_required' | null {
  if (engine.pricingDetails?.referenceImages?.modes.includes(mode)) {
    return 'validated_reference_count_required';
  }
  if (engine.pricingDetails?.byMode?.[mode]?.durationBasis === 'input_audio') {
    return 'trusted_input_audio_duration_required';
  }
  return null;
}

export function resolveWalletDirectPricingGate(engine: EngineCaps, value: unknown): {
  mode: Mode;
  refusal: ReturnType<typeof getWalletDirectPricingRefusal>;
} {
  const mode = resolveWalletDirectGenerationMode(engine, value);
  return { mode, refusal: getWalletDirectPricingRefusal(engine, mode) };
}
