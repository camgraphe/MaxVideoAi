import {
  STORAGE_KEY,
  STUDIO_PROJECTS_STORAGE_KEY,
  type PersistedWorkspaceState,
  type StudioProjectStorageRecord,
} from './workspace-state';
import { isWorkspaceTemplateId } from '../_lib/workspace-templates';

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
  };
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
