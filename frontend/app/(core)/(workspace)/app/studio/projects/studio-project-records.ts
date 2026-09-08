import {
  coerceWorkspaceProjectSettings,
} from '../workspace/_lib/workspace-project-settings';
import { isWorkspaceTemplateId } from '../workspace/_lib/workspace-templates';
import type {
  WorkspaceProjectSettings,
  WorkspaceTemplateId,
} from '../workspace/_lib/workspace-types';

export type StudioProjectRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: WorkspaceProjectSettings;
  canvasTemplateId: WorkspaceTemplateId;
  persistenceMode?: 'local-only' | 'legacy' | 'connected';
};

type StudioProjectNormalizationOptions = {
  now?: string;
  untitledProject: string;
};

function normalizeStudioProjectTemplateId(value: unknown): WorkspaceTemplateId {
  return isWorkspaceTemplateId(value) ? value : 'product-ad';
}

export function normalizeStudioProjectRecord(
  value: unknown,
  options: StudioProjectNormalizationOptions
): StudioProjectRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<StudioProjectRecord>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null;
  const now = options.now ?? new Date().toISOString();
  return {
    id: record.id,
    name: record.name.trim() || options.untitledProject,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
    settings: coerceWorkspaceProjectSettings(record.settings),
    canvasTemplateId: normalizeStudioProjectTemplateId(record.canvasTemplateId),
    persistenceMode: record.persistenceMode === 'local-only'
      ? 'local-only'
      : record.persistenceMode === 'connected'
        ? 'connected'
        : record.persistenceMode === 'legacy'
          ? 'legacy'
          : undefined,
  };
}

export function normalizeStudioProjectRecords(
  values: unknown[],
  options: StudioProjectNormalizationOptions
): StudioProjectRecord[] {
  const now = options.now ?? new Date().toISOString();
  return values
    .map((value) => normalizeStudioProjectRecord(value, { ...options, now }))
    .filter((project): project is StudioProjectRecord => project !== null);
}

export function mergeStudioProjectRecords(
  serverProjects: StudioProjectRecord[],
  cachedProjects: StudioProjectRecord[],
  limit = 20,
): StudioProjectRecord[] {
  const serverIds = new Set(serverProjects.map((project) => project.id));
  const unmatchedLocalProjects = cachedProjects.filter((project) => (
    project.persistenceMode === 'local-only' && !serverIds.has(project.id)
  ));
  return [...serverProjects, ...unmatchedLocalProjects].slice(0, limit);
}
