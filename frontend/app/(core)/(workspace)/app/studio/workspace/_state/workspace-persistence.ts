import {
  STORAGE_KEY,
  STUDIO_PROJECTS_STORAGE_KEY,
  type PersistedWorkspaceState,
  type StudioProjectStorageRecord,
} from './workspace-state';
import { isWorkspaceTemplateId } from '../_lib/workspace-templates';
import { studioWorkspaceSnapshotFingerprint } from './workspace-media-access';

export function workspaceStorageKeyForProject(projectId?: string): string {
  return projectId ? `${STORAGE_KEY}.${projectId}` : STORAGE_KEY;
}

export function normalizeStudioProjectStorageRecord(value: unknown): StudioProjectStorageRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<StudioProjectStorageRecord>;
  if (typeof record.id !== 'string') return null;
  return {
    id: record.id,
    name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : 'Untitled edit',
    settings: record.settings,
    canvasTemplateId: isWorkspaceTemplateId(record.canvasTemplateId) ? record.canvasTemplateId : 'product-ad',
    workspaceState: record.workspaceState,
    revision: Number.isSafeInteger(record.revision) && (record.revision ?? -1) >= 0 ? record.revision : undefined,
    persistenceMode: record.persistenceMode === 'local-only'
      ? 'local-only'
      : record.persistenceMode === 'connected'
        ? 'connected'
        : record.persistenceMode === 'legacy'
          ? 'legacy'
          : undefined,
  };
}

export function workspaceStorageKeyForConnectedProject(accountId: string, projectId: string): string {
  return `${STORAGE_KEY}.connected.${encodeURIComponent(accountId)}.${encodeURIComponent(projectId)}`;
}

export type StudioConnectedWorkspaceDraft = {
  dirty: boolean;
  revision: number;
  state: PersistedWorkspaceState;
};

export function readStudioConnectedWorkspaceDraft(
  storage: Pick<Storage, 'getItem'>,
  storageKey: string,
  normalizeState: (value: unknown) => PersistedWorkspaceState | null,
): StudioConnectedWorkspaceDraft | null {
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) ?? 'null') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as { revision?: unknown; state?: unknown };
    if (!Number.isSafeInteger(record.revision) || (record.revision as number) < 0) return null;
    const state = normalizeState(record.state);
    return state ? { dirty: (record as { dirty?: unknown }).dirty !== false, revision: record.revision as number, state } : null;
  } catch {
    return null;
  }
}

export function resolveStudioConnectedWorkspaceHydration(params: {
  serverRevision: number;
  serverState: PersistedWorkspaceState;
  draft: StudioConnectedWorkspaceDraft | null;
}): { state: PersistedWorkspaceState; baseRevision: number; conflict: boolean; source: 'server' | 'draft' } {
  if (!params.draft || !params.draft.dirty || studioWorkspaceSnapshotFingerprint(params.draft.state)
    === studioWorkspaceSnapshotFingerprint(params.serverState)) {
    return { state: params.serverState, baseRevision: params.serverRevision, conflict: false, source: 'server' };
  }
  return {
    state: params.draft.state,
    baseRevision: params.draft.revision,
    conflict: params.draft.revision !== params.serverRevision,
    source: 'draft',
  };
}

export function shouldClearStudioWorkspaceForAccountChange(
  previousAccountId: string | null,
  nextAccountId: string | null,
  projectId?: string,
): boolean {
  return Boolean(projectId) && previousAccountId !== nextAccountId;
}

export function readStudioProject(projectId?: string): StudioProjectStorageRecord | null {
  if (!projectId || typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STUDIO_PROJECTS_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return null;
    const project = parsed.find((item) => (
      Boolean(item) && typeof item === 'object' && (item as { id?: unknown }).id === projectId
    ));
    return normalizeStudioProjectStorageRecord(project);
  } catch {
    return null;
  }
}

export function readPersistedWorkspaceState(
  storageKey: string,
  normalizeState: (value: unknown) => PersistedWorkspaceState | null
): PersistedWorkspaceState | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeState(JSON.parse(window.localStorage.getItem(storageKey) ?? 'null'));
  } catch {
    return null;
  }
}
