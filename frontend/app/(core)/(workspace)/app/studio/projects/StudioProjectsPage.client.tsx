'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  Copy,
  Film,
  FolderOpen,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { authFetch } from '@/lib/authFetch';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  coerceWorkspaceProjectSettings,
} from '../workspace/_lib/workspace-project-settings';
import {
  studioApiSyncStatusFromResponse,
  type StudioApiResult,
  type StudioApiSyncStatus,
} from '../workspace/_state/workspace-api-persistence';
import { WORKSPACE_TEMPLATE_SUMMARIES } from '../workspace/_lib/workspace-templates';
import type { WorkspaceProjectSettings, WorkspaceTemplateId } from '../workspace/_lib/workspace-types';
import {
  formatStudioProjectDate,
  resolveStudioCopy,
  type StudioCopy,
} from '../_lib/studio-copy';
import styles from './studio-projects.module.css';

const STUDIO_PROJECTS_STORAGE_KEY = 'maxvideoai.editor.projects.v1';
const DEFAULT_STUDIO_PROJECT_TEMPLATE_ID: WorkspaceTemplateId = 'product-ad';

type StudioProjectRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: WorkspaceProjectSettings;
  canvasTemplateId: WorkspaceTemplateId;
};

function createStudioProjectId(): string {
  if (globalThis.crypto?.randomUUID) return `project_${globalThis.crypto.randomUUID()}`;
  return `project_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readStudioProjects(): StudioProjectRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STUDIO_PROJECTS_STORAGE_KEY) ?? '[]') as StudioProjectRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((project) => (
      typeof project?.id === 'string' &&
      typeof project.name === 'string' &&
      project.settings &&
      typeof project.canvasTemplateId === 'string'
    ));
  } catch {
    return [];
  }
}

function writeStudioProjects(projects: StudioProjectRecord[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STUDIO_PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

function normalizeStudioProjectTemplateId(value: unknown): WorkspaceTemplateId {
  if (typeof value === 'string' && WORKSPACE_TEMPLATE_SUMMARIES.some((template) => template.id === value)) {
    return value as WorkspaceTemplateId;
  }
  return 'product-ad';
}

function normalizeStudioProjectRecord(value: unknown, studioCopy: StudioCopy): StudioProjectRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<StudioProjectRecord>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null;
  const now = new Date().toISOString();
  return {
    id: record.id,
    name: record.name.trim() || studioCopy.projects.untitledProject,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
    settings: coerceWorkspaceProjectSettings(record.settings),
    canvasTemplateId: normalizeStudioProjectTemplateId(record.canvasTemplateId),
  };
}

function studioProjectsApiNotice(status: StudioApiSyncStatus, notices: StudioCopy['notices']): string | null {
  if (status === 'ready') return null;
  if (status === 'unauthorized') return notices.studioApiUnauthorized;
  if (status === 'unavailable') return notices.studioApiUnavailable;
  return notices.studioLocalFallbackActive;
}

async function readStudioProjectsFromApi(studioCopy: StudioCopy): Promise<StudioApiResult<StudioProjectRecord[]>> {
  try {
    const response = await authFetch('/api/studio/projects', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const status = studioApiSyncStatusFromResponse(response);
    if (status !== 'ready') return { data: null, status };
    const payload = await response.json().catch(() => null);
    if (!payload?.ok || !Array.isArray(payload.projects)) return { data: null, status: 'error' };
    return {
      data: payload.projects
        .map((project: unknown) => normalizeStudioProjectRecord(project, studioCopy))
        .filter((project: StudioProjectRecord | null): project is StudioProjectRecord => Boolean(project)),
      status: 'ready',
    };
  } catch {
    return { data: null, status: 'error' };
  }
}

async function saveStudioProjectToApi(
  project: StudioProjectRecord,
  studioCopy: StudioCopy
): Promise<StudioApiResult<StudioProjectRecord>> {
  try {
    const response = await authFetch('/api/studio/projects', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project }),
    });
    const status = studioApiSyncStatusFromResponse(response);
    if (status !== 'ready') return { data: null, status };
    const payload = await response.json().catch(() => null);
    if (!payload?.ok) return { data: null, status: 'error' };
    return { data: normalizeStudioProjectRecord(payload.project, studioCopy), status: 'ready' };
  } catch {
    return { data: null, status: 'error' };
  }
}

async function updateStudioProjectInApi(
  project: StudioProjectRecord,
  studioCopy: StudioCopy
): Promise<StudioApiResult<StudioProjectRecord>> {
  try {
    const response = await authFetch(`/api/studio/projects/${encodeURIComponent(project.id)}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project }),
    });
    const status = studioApiSyncStatusFromResponse(response);
    if (status !== 'ready') return { data: null, status };
    const payload = await response.json().catch(() => null);
    if (!payload?.ok) return { data: null, status: 'error' };
    return { data: normalizeStudioProjectRecord(payload.project, studioCopy), status: 'ready' };
  } catch {
    return { data: null, status: 'error' };
  }
}

async function deleteStudioProjectFromApi(projectId: string): Promise<StudioApiSyncStatus> {
  try {
    const response = await authFetch(`/api/studio/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
    const status = studioApiSyncStatusFromResponse(response);
    if (status !== 'ready') return status;
    const payload = await response.json().catch(() => null);
    return payload?.ok ? 'ready' : 'error';
  } catch {
    return 'error';
  }
}

function studioProjectTemplateThumbnail(templateId: WorkspaceTemplateId): string {
  return WORKSPACE_TEMPLATE_SUMMARIES.find((template) => template.id === templateId)?.thumbnailUrl ?? '/assets/marketing/app-dashboard.webp';
}

export default function StudioProjectsPageClient() {
  const router = useRouter();
  const { locale, dictionary } = useI18n();
  const studioCopy = useMemo(() => resolveStudioCopy(dictionary), [dictionary]);
  const appLocale = locale as AppLocale;
  const [isHydrated, setIsHydrated] = useState(false);
  const [projects, setProjects] = useState<StudioProjectRecord[]>([]);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(null);
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameProjectName, setRenameProjectName] = useState('');
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const visibleProjects = useMemo(() => (showAllProjects ? projects : projects.slice(0, 1)), [projects, showAllProjects]);
  const latestProject = projects[0] ?? null;
  const renameProject = useMemo(
    () => projects.find((project) => project.id === renameProjectId) ?? null,
    [projects, renameProjectId]
  );
  const deleteProject = useMemo(
    () => projects.find((project) => project.id === deleteProjectId) ?? null,
    [deleteProjectId, projects]
  );

  const persistProjects = (nextProjects: StudioProjectRecord[]) => {
    setProjects(nextProjects);
    writeStudioProjects(nextProjects);
  };

  useEffect(() => {
    setIsHydrated(true);
    const localProjects = readStudioProjects();
    setProjects(localProjects);

    let cancelled = false;
    void readStudioProjectsFromApi(studioCopy).then((serverResult) => {
      if (cancelled) return;
      const nextNotice = studioProjectsApiNotice(serverResult.status, studioCopy.notices);
      setApiNotice(nextNotice);
      if (!serverResult.data) return;
      setProjects(serverResult.data);
      writeStudioProjects(serverResult.data);
    });

    return () => {
      cancelled = true;
    };
  }, [studioCopy]);

  const createProject = async () => {
    const now = new Date().toISOString();
    const project: StudioProjectRecord = {
      id: createStudioProjectId(),
      name: studioCopy.projects.untitledProject,
      createdAt: now,
      updatedAt: now,
      settings: { ...DEFAULT_WORKSPACE_PROJECT_SETTINGS },
      canvasTemplateId: DEFAULT_STUDIO_PROJECT_TEMPLATE_ID,
    };
    const nextProjects = [project, ...projects].slice(0, 20);
    setProjects(nextProjects);
    writeStudioProjects(nextProjects);
    const savedProjectResult = await saveStudioProjectToApi(project, studioCopy);
    setApiNotice(studioProjectsApiNotice(savedProjectResult.status, studioCopy.notices));
    const savedProject = savedProjectResult.data;
    if (savedProject) {
      const syncedProject = savedProject;
      const serverProjects = [syncedProject, ...nextProjects.filter((candidate) => candidate.id !== syncedProject.id)].slice(0, 20);
      setProjects(serverProjects);
      writeStudioProjects(serverProjects);
    }
    router.push(`/app/studio/workspace/${savedProject?.id ?? project.id}`);
  };

  const openLatestProject = () => {
    if (!latestProject) return;
    router.push(`/app/studio/workspace/${latestProject.id}`);
  };

  const openRenameDialog = (project: StudioProjectRecord) => {
    setOpenProjectMenuId(null);
    setRenameProjectId(project.id);
    setRenameProjectName(project.name);
  };

  const renameSelectedProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameProject) return;
    const trimmedName = renameProjectName.trim();
    if (!trimmedName) return;
    const updatedProject = {
      ...renameProject,
      name: trimmedName,
      updatedAt: new Date().toISOString(),
    };
    const nextProjects = projects.map((project) => (project.id === updatedProject.id ? updatedProject : project));
    persistProjects(nextProjects);
    setRenameProjectId(null);
    const savedProject = await updateStudioProjectInApi(updatedProject, studioCopy);
    setApiNotice(studioProjectsApiNotice(savedProject.status, studioCopy.notices));
    if (savedProject.data) {
      const syncedProject = savedProject.data;
      persistProjects(nextProjects.map((project) => (project.id === syncedProject.id ? syncedProject : project)));
    }
  };

  const duplicateProject = async (project: StudioProjectRecord) => {
    setOpenProjectMenuId(null);
    const now = new Date().toISOString();
    const duplicate: StudioProjectRecord = {
      ...project,
      id: createStudioProjectId(),
      name: `${project.name} ${studioCopy.projects.duplicateSuffix}`,
      createdAt: now,
      updatedAt: now,
    };
    const nextProjects = [duplicate, ...projects].slice(0, 20);
    persistProjects(nextProjects);
    const savedProject = await saveStudioProjectToApi(duplicate, studioCopy);
    setApiNotice(studioProjectsApiNotice(savedProject.status, studioCopy.notices));
    if (savedProject.data) {
      const syncedProjects = [savedProject.data, ...nextProjects.filter((candidate) => candidate.id !== duplicate.id)].slice(0, 20);
      persistProjects(syncedProjects);
    }
  };

  const requestDeleteProject = (project: StudioProjectRecord) => {
    setOpenProjectMenuId(null);
    setDeleteProjectId(project.id);
  };

  const confirmDeleteProject = async () => {
    if (!deleteProject) return;
    const projectId = deleteProject.id;
    const nextProjects = projects.filter((project) => project.id !== projectId);
    persistProjects(nextProjects);
    setDeleteProjectId(null);
    const status = await deleteStudioProjectFromApi(projectId);
    setApiNotice(studioProjectsApiNotice(status, studioCopy.notices));
  };

  return (
    <div className={styles.projectsShell}>
      <section className={styles.projectsHero} aria-labelledby="studio-projects-title">
        <div className={styles.projectsHeaderBar}>
          <div className={styles.brandLockup}>
            <Film size={24} />
            <span>{studioCopy.projects.heroBadge}</span>
          </div>
          <button
            type="button"
            className={styles.openProjectButton}
            onClick={openLatestProject}
            disabled={!isHydrated || !latestProject}
          >
            <FolderOpen size={19} />
            {studioCopy.projects.openProject}
          </button>
        </div>
        <div className={styles.projectsHeroCopy}>
          <h1 id="studio-projects-title">{studioCopy.projects.title}</h1>
          <p>{studioCopy.projects.subtitle}</p>
        </div>
        {apiNotice ? (
          <div className={styles.syncNotice} role="status" aria-live="polite">
            {apiNotice}
          </div>
        ) : null}
      </section>

      <section className={styles.projectsGrid}>
        <button
          type="button"
          className={styles.newProjectLaunchCard}
          onClick={() => void createProject()}
          disabled={!isHydrated}
        >
          <span className={styles.newProjectPlus}>
            <Plus size={34} />
          </span>
          <strong>{studioCopy.projects.createTitle}</strong>
          <span>{studioCopy.projects.createSubtitle}</span>
        </button>

        <section className={styles.recentProjectsPanel} aria-label={studioCopy.projects.recentTitle}>
          <div className={styles.recentProjectsHeader}>
            <h2>{studioCopy.projects.recentTitle}</h2>
            <span>{studioCopy.projects.recentSubtitle}</span>
          </div>

          <div className={styles.projectList} id="studio-project-list">
            {projects.length ? (
              visibleProjects.map((project) => {
                const projectActionsLabel = studioCopy.projects.projectActionsAria.replace('{name}', project.name);
                return (
                  <div key={project.id} className={styles.projectCard}>
                    <button
                      type="button"
                      className={styles.projectCardMain}
                      onClick={() => router.push(`/app/studio/workspace/${project.id}`)}
                    >
                      <img src={studioProjectTemplateThumbnail(project.canvasTemplateId)} alt="" />
                      <span className={styles.projectCardCopy}>
                        <strong>{project.name}</strong>
                        <span>{formatStudioProjectDate(appLocale, project.updatedAt, studioCopy)}</span>
                      </span>
                    </button>
                    <span className={styles.projectActions}>
                      <button
                        type="button"
                        className={styles.projectActionButton}
                        aria-label={projectActionsLabel}
                        aria-haspopup="menu"
                        aria-expanded={openProjectMenuId === project.id}
                        onClick={() => setOpenProjectMenuId((current) => (current === project.id ? null : project.id))}
                      >
                        <MoreVertical size={18} aria-hidden />
                      </button>
                      {openProjectMenuId === project.id ? (
                        <span className={styles.projectActionMenu} role="menu" aria-label={projectActionsLabel}>
                          <button type="button" role="menuitem" onClick={() => openRenameDialog(project)}>
                            <Pencil size={14} />
                            {studioCopy.projects.rename}
                          </button>
                          <button type="button" role="menuitem" onClick={() => void duplicateProject(project)}>
                            <Copy size={14} />
                            {studioCopy.projects.duplicate}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className={styles.projectActionDanger}
                            onClick={() => requestDeleteProject(project)}
                          >
                            <Trash2 size={14} />
                            {studioCopy.projects.delete}
                          </button>
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className={styles.emptyProjects}>
                <strong>{studioCopy.projects.emptyRecent}</strong>
                <span>{studioCopy.projects.createSubtitle}</span>
              </div>
            )}
          </div>
          {projects.length > visibleProjects.length ? (
            <button type="button" className={styles.viewAllProjects} onClick={() => setShowAllProjects(true)}>
              {studioCopy.projects.viewAllProjects}
              <ChevronRight size={16} />
            </button>
          ) : null}
        </section>
      </section>
      {renameProject ? (
        <div className={styles.dialogBackdrop}>
          <form className={styles.projectDialog} role="dialog" aria-modal="true" aria-labelledby="rename-project-title" onSubmit={renameSelectedProject}>
            <div className={styles.dialogTitleRow}>
              <div>
                <h2 id="rename-project-title">{studioCopy.projects.renameTitle}</h2>
                <p>{studioCopy.projects.projectNameLabel}</p>
              </div>
              <button type="button" aria-label={studioCopy.projects.closeDialog} onClick={() => setRenameProjectId(null)}>
                <X size={17} />
              </button>
            </div>
            <label className={styles.projectField}>
              <span>{studioCopy.projects.projectNameLabel}</span>
              <input
                value={renameProjectName}
                maxLength={60}
                autoFocus
                onChange={(event) => setRenameProjectName(event.target.value)}
              />
            </label>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.dialogSecondaryButton} onClick={() => setRenameProjectId(null)}>
                {studioCopy.projects.cancel}
              </button>
              <button type="submit" className={styles.dialogPrimaryButton} disabled={!renameProjectName.trim()}>
                {studioCopy.projects.renameSubmit}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {deleteProject ? (
        <div className={styles.dialogBackdrop}>
          <div className={styles.projectDialog} role="dialog" aria-modal="true" aria-labelledby="delete-project-title">
            <div className={styles.dialogTitleRow}>
              <div>
                <h2 id="delete-project-title">{studioCopy.projects.deleteTitle}</h2>
                <p>{studioCopy.projects.deleteBody}</p>
              </div>
              <button type="button" aria-label={studioCopy.projects.closeDialog} onClick={() => setDeleteProjectId(null)}>
                <X size={17} />
              </button>
            </div>
            <p className={styles.deleteWarning}>{deleteProject.name}</p>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.dialogSecondaryButton} onClick={() => setDeleteProjectId(null)}>
                {studioCopy.projects.cancel}
              </button>
              <button type="button" className={styles.dialogDangerButton} onClick={() => void confirmDeleteProject()}>
                {studioCopy.projects.deleteConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
