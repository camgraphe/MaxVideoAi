import {
  decodeWorkspaceModelSetups,
  encodeWorkspaceModelSetups,
  parseWorkspaceSavedModelSetup,
  type WorkspaceSavedModelSetup,
  type WorkspaceModelSetupError,
} from './workspace-model-setups';
import { parkedCreateReferenceKey } from './workspace-create-continuity';
import type { WorkspaceModelSetup } from './workspace-model-candidate';

export function activeDraftReferenceSlotKey(fieldId: string, index: number, assetId: string) {
  return JSON.stringify([fieldId, index, assetId]);
}

/** Keep the last complete setup while applying explicit removals from an incomplete edit. */
export function applyActiveDraftReferenceRemovals(
  stored: WorkspaceModelSetup,
  current: WorkspaceModelSetup,
  removals: ReadonlySet<string>,
): WorkspaceModelSetup {
  if (!removals.size || stored.form.engineId !== current.form.engineId) return stored;
  let changed = false;
  const inputAssets = Object.fromEntries(Object.entries(stored.inputAssets).map(([fieldId, assets]) => [
    fieldId,
    assets.map((asset, index) => {
      if (!asset || !removals.has(activeDraftReferenceSlotKey(fieldId, index, asset.id))
        || current.inputAssets[fieldId]?.[index]?.id === asset.id) return asset;
      changed = true;
      return null;
    }),
  ]));
  const parkedCreateReferences = stored.parkedCreateReferences?.filter(reference => {
    const key = parkedCreateReferenceKey(reference);
    if (!removals.has(key) || current.parkedCreateReferences?.some(value => parkedCreateReferenceKey(value) === key)) return true;
    changed = true;
    return false;
  });
  return changed ? { ...stored, inputAssets, parkedCreateReferences } : stored;
}

export function workspaceActiveDraftKey(accountId: string) {
  return `maxvideoai:active-video-draft:v1:${encodeURIComponent(accountId)}`;
}
export type WorkspaceActiveDraftRecord = {
  current: WorkspaceSavedModelSetup | null;
  recovery: WorkspaceSavedModelSetup | null;
};
export function decodeWorkspaceActiveDraft(
  raw: string | null,
  accountId: string,
): WorkspaceActiveDraftRecord & { error?: WorkspaceModelSetupError } {
  const decoded = decodeWorkspaceModelSetups(raw, accountId);
  const record: WorkspaceActiveDraftRecord = { current: null, recovery: null };
  if (decoded.error) return { ...record, error: decoded.error };
  for (const [key, value] of Object.entries(decoded.entries)) {
    if (
      (key !== 'current' && key !== 'recovery') ||
      !value ||
      typeof value !== 'object' ||
      !('modelId' in value) ||
      typeof value.modelId !== 'string'
    )
      return { ...record, error: 'invalid' };
    const saved = parseWorkspaceSavedModelSetup(value, value.modelId);
    if (!saved) return { ...record, error: 'invalid' };
    record[key] = saved;
  }
  return record;
}
export function encodeWorkspaceActiveDraft(record: WorkspaceActiveDraftRecord, accountId: string) {
  return encodeWorkspaceModelSetups(
    accountId,
    Object.fromEntries(
      Object.entries({
        current: record.current,
        recovery: record.recovery,
      }).filter(([, value]) => value !== null),
    ),
  );
}
