import {
  STORAGE_KEY,
  STUDIO_PROJECTS_STORAGE_KEY,
  USER_CANVAS_TEMPLATES_STORAGE_KEY,
  type PersistedWorkspaceState,
  type StudioProjectStorageRecord,
  type WorkspaceUserCanvasTemplate,
} from './workspace-state';

export function workspaceStorageKeyForProject(projectId?: string): string {
  return projectId ? `${STORAGE_KEY}.${projectId}` : STORAGE_KEY;
}

export function readStudioProject(projectId?: string): StudioProjectStorageRecord | null {
  if (!projectId || typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STUDIO_PROJECTS_STORAGE_KEY) ?? '[]') as StudioProjectStorageRecord[];
    const project = Array.isArray(parsed) ? parsed.find((item) => item?.id === projectId) : null;
    if (!project || typeof project.id !== 'string') return null;
    return {
      ...project,
      name: typeof project.name === 'string' && project.name.trim() ? project.name.trim() : 'Untitled edit',
    };
  } catch {
    return null;
  }
}

export function readUserCanvasTemplates(
  normalizeTemplate: (value: unknown) => WorkspaceUserCanvasTemplate | null
): WorkspaceUserCanvasTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(USER_CANVAS_TEMPLATES_STORAGE_KEY) ?? '[]') as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTemplate).filter((template): template is WorkspaceUserCanvasTemplate => Boolean(template));
  } catch {
    return [];
  }
}

export function writeUserCanvasTemplates(templates: WorkspaceUserCanvasTemplate[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USER_CANVAS_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
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
