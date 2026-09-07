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
