import type {
  WorkspaceOutputCount,
  WorkspaceShotSettings,
} from './workspace-types';

function outputCountBounds(outputCount: WorkspaceOutputCount | null | undefined): {
  min: number;
  max: number;
} {
  if (typeof outputCount === 'number') {
    const fixed = Math.max(1, Math.floor(outputCount));
    return { min: fixed, max: fixed };
  }
  const min = Math.max(1, Math.floor(outputCount?.min ?? 1));
  const max = Math.max(min, Math.floor(outputCount?.max ?? min));
  return { min, max };
}

export function resolveWorkspaceSelectedOutputCount(
  settings: WorkspaceShotSettings,
  supportedOutputCount?: WorkspaceOutputCount | null
): number {
  const requested = settings.toolKind === 'character-builder'
    ? settings.toolSettings?.characterBuilder?.generateCount ?? 1
    : settings.toolKind === 'angle'
      ? settings.toolSettings?.angle?.generateBestAngles ? 4 : 1
      : settings.outputCount ?? 1;
  const bounds = supportedOutputCount == null
    ? { min: 1, max: Math.max(1, Math.floor(requested)) }
    : outputCountBounds(supportedOutputCount);
  return Math.min(bounds.max, Math.max(bounds.min, Math.floor(requested)));
}

export function workspaceOutputCountOptions(
  outputCount?: WorkspaceOutputCount | null
): number[] {
  const bounds = outputCountBounds(outputCount);
  return Array.from({ length: bounds.max - bounds.min + 1 }, (_, index) => bounds.min + index);
}
