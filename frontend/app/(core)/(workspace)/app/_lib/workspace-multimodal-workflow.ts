import type { EngineCaps, EngineInputField, Mode } from '@/types/engines';
import type { ReferenceAsset } from './workspace-assets';

type InputAssets = Record<string, (ReferenceAsset | null)[]>;

export function hasMultimodalReferenceFields(fields: readonly EngineInputField[]): boolean {
  return fields.some((field) => field.type === 'audio' && field.modes?.includes('ref2v'));
}

export function getWorkspaceMediaFields(engine: EngineCaps | null): EngineInputField[] {
  return [...(engine?.inputSchema?.required ?? []), ...(engine?.inputSchema?.optional ?? [])]
    .filter((field) => field.type === 'image' || field.type === 'video' || field.type === 'audio');
}

export function fieldAcceptsMode(field: EngineInputField, mode: Mode): boolean {
  return !field.modes?.length || field.modes.includes(mode);
}

export function workspaceAssetsSupportMode(
  fields: readonly EngineInputField[],
  inputAssets: InputAssets,
  mode: Mode,
  kind?: ReferenceAsset['kind'],
): boolean {
  return Object.entries(inputAssets).every(([fieldId, assets]) => assets.every((asset) =>
    !asset || (kind && asset.kind !== kind) || fields.some((field) =>
      field.id === fieldId && field.type === asset.kind && fieldAcceptsMode(field, mode))));
}

/** Infer from the actual slots: reference videos are not source videos, and a soundtrack is not a2v. */
export function resolveMultimodalReferenceMode(engine: EngineCaps, inputAssets: InputAssets): Mode | null {
  const fields = getWorkspaceMediaFields(engine);
  const populatedFields = fields.filter((field) =>
    (inputAssets[field.id] ?? []).some((asset) => asset?.kind === field.type));
  const preference: Mode[] = ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'];
  return preference.find((mode) => engine.modes.includes(mode)
    && populatedFields.every((field) => fieldAcceptsMode(field, mode))) ?? null;
}
