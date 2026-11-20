import type { EngineCaps, EngineInputField, Mode } from '@/types/engines';
import { resolveActiveVideoInputField, VIDEO_MEDIA_FIELD_CANDIDATES } from '@/lib/video-input-schema';
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

/** The generation path can use a two-frame start slot as the i2v opening image. */
export function getAlternateCreateOpeningFrame(engine: EngineCaps, mode: Mode) {
  if (mode !== 'i2v' || !engine.modes.includes('fl2v')) return null;
  const fields = { inputSchema: engine.inputSchema, candidateFieldIds: VIDEO_MEDIA_FIELD_CANDIDATES.firstFrame, type: 'image' as const };
  const primary = resolveActiveVideoInputField({ ...fields, mode: 'i2v' });
  const alternate = resolveActiveVideoInputField({ ...fields, mode: 'fl2v' });
  return primary && alternate && primary.id !== alternate.id ? { primary, alternate } : null;
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
  const preference: Mode[] = ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'];
  return preference.find((mode) => engine.modes.includes(mode)
    && workspaceAssetsSupportMode(fields, inputAssets, mode)) ?? null;
}
