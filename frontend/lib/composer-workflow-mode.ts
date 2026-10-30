import type { Mode } from '@/types/engines';

/** Visible workflow groups do not replace the model's generation mode or schema. */
export function resolveComposerWorkflowMode(
  modes: readonly { mode: Mode | null }[] | null | undefined,
  generationMode: Mode | null | undefined,
): Mode | null {
  const current = generationMode ?? null;
  if (!modes?.some(entry => entry.mode === null)) return current;
  return modes.some(entry => entry.mode === current) ? current : null;
}
