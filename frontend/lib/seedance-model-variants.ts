/** Exact variants, not a prefix match: Flash must not inherit flagship-only options. */
export function isSeedance25EngineId(engineId: string | null | undefined): boolean {
  return engineId === 'seedance-2-5' || engineId === 'seedance-2-5-flash';
}

export function seedanceModelArkReferenceLimits(engineId: string) {
  if (engineId === 'seedance-2-5-flash') return { image: 10, video: 5, audio: 5 };
  if (engineId === 'seedance-2-5') return { image: 30, video: 10, audio: 10 };
  return { image: 9, video: 3, audio: 3 };
}
