import {
  decodeWorkspaceModelSetups,
  encodeWorkspaceModelSetups,
  parseWorkspaceSavedModelSetup,
  type WorkspaceSavedModelSetup,
  type WorkspaceModelSetupError,
} from './workspace-model-setups';

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
